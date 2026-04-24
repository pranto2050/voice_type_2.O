'use strict';

const { app, BrowserWindow, ipcMain, globalShortcut, systemPreferences, clipboard, nativeImage, shell, Menu, Tray } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const Store = require('electron-store');

const store = new Store({
  defaults: {
    language: 'en-US',
    autoDetect: false,
    theme: 'dark',
    accentColor: '#00b4d8',
    opacity: 1.0,
    fontSize: 'medium',
    startWithSystem: false,
    clipboardMonitor: false,
    toggleShortcut: 'CommandOrControl+Shift+Space',
    pauseKey: 'Space',
    confidenceThreshold: 0.6,
    micDevice: 'default',
    alwaysOnTop: false,
    pttShortcut: 'CommandOrControl+Alt+S',
    useMiniWave: true,
    pttHideMain: true,
    windowBounds: { width: 420, height: 680 }
  }
});

let mainWindow = null;
let pythonProcess = null;
let tray = null;
let isListening = false;
let isPaused = false;

function createWindow() {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 360,
    minHeight: 580,
    frame: false,
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    alwaysOnTop: store.get('alwaysOnTop'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    backgroundColor: '#00000000'
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    const opacity = store.get('opacity');
    mainWindow.setOpacity(opacity);
  });

  mainWindow.on('close', (e) => {
    if (process.platform === 'darwin') {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('resize', () => {
    const [width, height] = mainWindow.getSize();
    // Only save bounds if not in mini mode
    if (height > 100) {
      store.set('windowBounds', { width, height });
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function getPythonExecutable() {
  const bundledPath = path.join(process.resourcesPath, 'python', 'voice_engine');
  const fs = require('fs');
  if (fs.existsSync(bundledPath) || fs.existsSync(bundledPath + '.exe')) {
    return { exe: bundledPath, args: [] };
  }
  const scriptPath = path.join(__dirname, 'python', 'voice_engine.py');
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  return { exe: pythonCmd, args: [scriptPath] };
}

function startPythonEngine() {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }

  const { exe, args } = getPythonExecutable();

  try {
    const p = spawn(exe, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    pythonProcess = p;

    let buffer = '';
    p.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed);
          handlePythonMessage(msg);
        } catch (_) {
          // non-JSON output, ignore
        }
      }
    });

    p.stderr.on('data', (data) => {
      const text = data.toString();
      console.error('[PYTHON ERROR]:', text);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('python-log', text);
      }
    });

    p.on('close', (code, signal) => {
      if (pythonProcess === p) {
        pythonProcess = null;
        if (mainWindow && !mainWindow.isDestroyed()) {
          const reason = code !== null ? code : (signal || 'unknown');
          let msg = `Engine stopped (code ${reason})`;
          if (reason === 'SIGABRT' || reason === 'SIGTRAP') {
            msg += ' - Usually caused by missing Microphone permissions in macOS. Please check System Settings > Privacy & Security > Microphone.';
          }
          mainWindow.webContents.send('engine-error', { message: msg });
          mainWindow.webContents.send('engine-status', { running: false, code: reason });
        }
      }
    });

    p.on('error', (err) => {
      if (pythonProcess === p) {
        pythonProcess = null;
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('engine-error', { message: 'Failed to start python engine: ' + err.message });
      }
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('engine-status', { running: true });
    }

    // Send initial settings
    sendToPython(`SET_LANG:${store.get('language')}`);
    sendToPython(`SET_CONFIDENCE:${store.get('confidenceThreshold')}`);
  } catch (err) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('engine-error', { message: err.message });
    }
  }
}

let lastInjectionTime = 0;

function handlePythonMessage(msg) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  switch (msg.type) {
    case 'transcript':
      mainWindow.webContents.send('transcript', msg);
      if (msg.final && msg.text) {
        // Add a space if the last injection was recent (within 60 seconds)
        // and doesn't already start with a space/punctuation
        const now = Date.now();
        let textToInject = msg.text;
        
        if (now - lastInjectionTime < 60000 && lastInjectionTime !== 0) {
          if (!textToInject.startsWith(' ') && !textToInject.match(/^[.,!?;:]/)) {
            textToInject = ' ' + textToInject;
          }
        }
        
        injectText(textToInject);
        lastInjectionTime = now;
      }
      break;
    case 'amplitude':
      mainWindow.webContents.send('amplitude', msg);
      break;
    case 'error':
      mainWindow.webContents.send('engine-error', msg);
      break;
    case 'status':
      mainWindow.webContents.send('engine-status', msg);
      break;
    default:
      mainWindow.webContents.send('python-msg', msg);
  }
}

function sendToPython(command) {
  if (pythonProcess && pythonProcess.stdin.writable) {
    pythonProcess.stdin.write(command + '\n');
  }
}

function injectText(text) {
  clipboard.writeText(text);

  const { exec } = require('child_process');
  let cmd = '';
  if (process.platform === 'darwin') {
    cmd = `osascript -e 'tell application "System Events" to keystroke "v" using command down'`;
  } else if (process.platform === 'win32') {
    cmd = 'powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'^v\')"';
  } else {
    cmd = 'xdotool key ctrl+v';
  }

  exec(cmd, (error) => {
    if (error) {
      console.error('Injection error:', error.message);
      if (process.platform === 'darwin' && error.message.includes('not allowed to send keystrokes')) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('engine-error', { 
            message: 'Permission denied: Please grant Accessibility permissions to your Terminal in System Settings.' 
          });
        }
      }
    }
  });
}

function registerShortcuts() {
  globalShortcut.unregisterAll();

  const shortcut = store.get('toggleShortcut');
  try {
    globalShortcut.register(shortcut, () => {
      if (isListening) {
        stopListening();
      } else {
        startListening();
      }
    });
  } catch (e) {
    console.error('Failed to register toggle shortcut:', e);
  }

  const pttShortcut = store.get('pttShortcut');
  try {
    globalShortcut.register(pttShortcut, () => {
      // Toggle PTT state
      const newState = !isListening;
      if (newState) {
        startListening();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ptt-state', { active: true });
        }
      } else {
        stopListening();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ptt-state', { active: false });
        }
      }
    });
  } catch (e) {
    console.error('Failed to register PTT shortcut:', e);
  }
}

function startListening() {
  isListening = true;
  isPaused = false;
  sendToPython('START');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('listening-state', { listening: true, paused: false });
  }
}

function stopListening() {
  isListening = false;
  isPaused = false;
  sendToPython('STOP');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('listening-state', { listening: false, paused: false });
  }
}

function pauseListening() {
  isPaused = true;
  sendToPython('PAUSE');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('listening-state', { listening: true, paused: true });
  }
}

function resumeListening() {
  isPaused = false;
  sendToPython('RESUME');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('listening-state', { listening: true, paused: false });
  }
}

// IPC handlers
ipcMain.handle('get-settings', () => store.store);

ipcMain.handle('set-setting', (_, key, value) => {
  store.set(key, value);
  applySettingEffect(key, value);
  return true;
});

ipcMain.handle('get-setting', (_, key) => store.get(key));

ipcMain.on('start-recognition', () => startListening());
ipcMain.on('stop-recognition', () => stopListening());
ipcMain.on('pause-recognition', () => pauseListening());
ipcMain.on('resume-recognition', () => resumeListening());

ipcMain.on('change-language', (_, lang) => {
  store.set('language', lang);
  sendToPython(`SET_LANG:${lang}`);
});

ipcMain.on('restart-engine', () => startPythonEngine());

ipcMain.on('window-minimize', () => mainWindow && mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window-close', () => {
  if (process.platform === 'darwin') {
    mainWindow && mainWindow.hide();
  } else {
    app.quit();
  }
});

ipcMain.on('set-window-size', (_, width, height) => {
  if (mainWindow) {
    if (height < 100) {
      mainWindow.setMinimumSize(200, 40);
      mainWindow.setResizable(false);
      mainWindow.setSize(width, height);
    } else {
      mainWindow.setResizable(true);
      mainWindow.setMinimumSize(360, 580);
      mainWindow.setSize(width, height);
      mainWindow.center(); // Center the window when returning to full mode
    }
  }
});

ipcMain.handle('request-mic-permission', async () => {
  if (process.platform === 'darwin') {
    const status = await systemPreferences.askForMediaAccess('microphone');
    return status ? 'granted' : 'denied';
  }
  return 'granted';
});

ipcMain.handle('request-camera-permission', async () => {
  if (process.platform === 'darwin') {
    const status = await systemPreferences.askForMediaAccess('camera');
    return status ? 'granted' : 'denied';
  }
  return 'granted';
});

ipcMain.handle('get-mic-permission', () => {
  if (process.platform === 'darwin') {
    return systemPreferences.getMediaAccessStatus('microphone');
  }
  return 'granted';
});

ipcMain.handle('get-camera-permission', () => {
  if (process.platform === 'darwin') {
    return systemPreferences.getMediaAccessStatus('camera');
  }
  return 'granted';
});

ipcMain.on('open-accessibility-prefs', () => {
  if (process.platform === 'darwin') {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
  } else if (process.platform === 'win32') {
    const { exec } = require('child_process');
    exec('start ms-settings:easeofaccess');
  }
});

ipcMain.handle('register-shortcut', (_, shortcut) => {
  store.set('toggleShortcut', shortcut);
  registerShortcuts();
  return true;
});

ipcMain.on('set-always-on-top', (_, value) => {
  store.set('alwaysOnTop', value);
  mainWindow && mainWindow.setAlwaysOnTop(value);
});

ipcMain.on('set-opacity', (_, value) => {
  store.set('opacity', value);
  mainWindow && mainWindow.setOpacity(value);
});

ipcMain.handle('inject-text', (_, text) => {
  injectText(text);
  return true;
});

ipcMain.on('hide-window', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on('show-window', () => {
  if (mainWindow) mainWindow.show();
});

function applySettingEffect(key, value) {
  switch (key) {
    case 'alwaysOnTop':
      mainWindow && mainWindow.setAlwaysOnTop(value);
      break;
    case 'opacity':
      mainWindow && mainWindow.setOpacity(value);
      break;
    case 'toggleShortcut':
      registerShortcuts();
      break;
    case 'language':
      sendToPython(`SET_LANG:${value}`);
      break;
    case 'confidenceThreshold':
      sendToPython(`SET_CONFIDENCE:${value}`);
      break;
    case 'startWithSystem':
      app.setLoginItemSettings({ openAtLogin: value });
      break;
  }
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    const fs = require('fs');
    if (!fs.existsSync(iconPath)) return;
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show VoiceType Pro', click: () => { mainWindow && mainWindow.show(); } },
      { label: 'Start Listening', click: () => startListening() },
      { label: 'Stop Listening', click: () => stopListening() },
      { type: 'separator' },
      { label: 'Quit', click: () => { tray && tray.destroy(); app.exit(0); } }
    ]);
    tray.setToolTip('VoiceType Pro');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      }
    });
  } catch (_) {}
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerShortcuts();

  // Prompt for macOS accessibility permissions automatically on startup
  if (process.platform === 'darwin') {
    setTimeout(() => {
      const isTrusted = systemPreferences.isTrustedAccessibilityClient(true);
      if (!isTrusted) {
        console.log('Prompting for macOS Accessibility permissions...');
      }
    }, 1000);
  }

  setTimeout(() => {
    startPythonEngine();
  }, 1500);

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (pythonProcess) {
    pythonProcess.kill();
  }
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
}
