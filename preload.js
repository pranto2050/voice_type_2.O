'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('voiceAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getSetting: (key) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),

  // Recognition control
  startRecognition: () => ipcRenderer.send('start-recognition'),
  stopRecognition: () => ipcRenderer.send('stop-recognition'),
  pauseRecognition: () => ipcRenderer.send('pause-recognition'),
  resumeRecognition: () => ipcRenderer.send('resume-recognition'),
  changeLanguage: (lang) => ipcRenderer.send('change-language', lang),
  restartEngine: () => ipcRenderer.send('restart-engine'),

  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  setWindowSize: (width, height) => ipcRenderer.send('set-window-size', width, height),
  setAlwaysOnTop: (val) => ipcRenderer.send('set-always-on-top', val),
  setOpacity: (val) => ipcRenderer.send('set-opacity', val),

  // Permissions
  requestMicPermission: () => ipcRenderer.invoke('request-mic-permission'),
  requestCameraPermission: () => ipcRenderer.invoke('request-camera-permission'),
  getMicPermission: () => ipcRenderer.invoke('get-mic-permission'),
  getCameraPermission: () => ipcRenderer.invoke('get-camera-permission'),
  openAccessibilityPrefs: () => ipcRenderer.send('open-accessibility-prefs'),

  // Shortcuts
  registerShortcut: (shortcut) => ipcRenderer.invoke('register-shortcut', shortcut),

  // Text injection
  injectText: (text) => ipcRenderer.invoke('inject-text', text),

  // Event listeners
  onTranscript: (cb) => {
    ipcRenderer.on('transcript', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('transcript');
  },
  onAmplitude: (cb) => {
    ipcRenderer.on('amplitude', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('amplitude');
  },
  onListeningState: (cb) => {
    ipcRenderer.on('listening-state', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('listening-state');
  },
  onEngineStatus: (cb) => {
    ipcRenderer.on('engine-status', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('engine-status');
  },
  onEngineError: (cb) => {
    ipcRenderer.on('engine-error', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('engine-error');
  },
  onPythonLog: (cb) => {
    ipcRenderer.on('python-log', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('python-log');
  },

  platform: process.platform
});
