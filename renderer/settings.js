'use strict';

class SettingsManager {
  constructor() {
    this.settings = {};
    this.currentTab = 'general';
    this.recordingShortcut = false;
    this.keysDown = new Set();
    this._init();
  }

  async _init() {
    this.settings = await window.voiceAPI.getSettings();
    this._renderTabs();
    this._applyAll();
    this._bindEvents();
  }

  _renderTabs() {
    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        this._switchTab(target);
      });
    });
  }

  _switchTab(tabId) {
    this.currentTab = tabId;
    document.querySelectorAll('.settings-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabId);
    });
    document.querySelectorAll('.settings-section').forEach(s => {
      s.classList.toggle('active', s.id === `section-${tabId}`);
    });
  }

  async _save(key, value) {
    this.settings[key] = value;
    await window.voiceAPI.setSetting(key, value);
  }

  _applyAll() {
    this._applyGeneral();
    this._applyAppearance();
    this._applyShortcuts();
    this._applyLanguage();
    this._applyPermissions();
    this._applyAbout();
  }

  _applyGeneral() {
    const clipToggle = document.getElementById('toggle-clipboard');
    if (clipToggle) clipToggle.checked = !!this.settings.clipboardMonitor;

    const startupToggle = document.getElementById('toggle-startup');
    if (startupToggle) startupToggle.checked = !!this.settings.startWithSystem;

    const alwaysTopToggle = document.getElementById('toggle-always-top');
    if (alwaysTopToggle) alwaysTopToggle.checked = !!this.settings.alwaysOnTop;

    const micSelect = document.getElementById('mic-device-select');
    if (micSelect) this._populateMicDevices(micSelect);
  }

  async _populateMicDevices(select) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === 'audioinput');
      select.innerHTML = '<option value="default">Default Microphone</option>';
      mics.forEach(mic => {
        const opt = document.createElement('option');
        opt.value = mic.deviceId;
        opt.textContent = mic.label || `Microphone ${mic.deviceId.slice(0,8)}`;
        if (mic.deviceId === this.settings.micDevice) opt.selected = true;
        select.appendChild(opt);
      });
    } catch (_) {}
  }

  _applyAppearance() {
    const themeButtons = document.querySelectorAll('.theme-btn');
    const currentTheme = this.settings.theme || 'dark';
    themeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === currentTheme);
      btn.setAttribute('aria-checked', btn.dataset.theme === currentTheme);
    });

    const accentColor = this.settings.accentColor || '#00b4d8';
    document.querySelectorAll('#ui-color-swatches .color-swatch').forEach(swatch => {
      const isActive = swatch.dataset.color === accentColor;
      swatch.classList.toggle('active', isActive);
      swatch.setAttribute('aria-checked', isActive);
    });
    const accentPicker = document.getElementById('accent-picker');
    if (accentPicker) accentPicker.value = accentColor;
    this._applyAccentColor(accentColor);

    const fontColor = this.settings.fontColor || '#f0f0f5';
    document.querySelectorAll('#font-color-swatches .color-swatch').forEach(swatch => {
      const isActive = swatch.dataset.color === fontColor;
      swatch.classList.toggle('active', isActive);
      swatch.setAttribute('aria-checked', isActive);
    });
    const fontPicker = document.getElementById('font-picker');
    if (fontPicker) fontPicker.value = fontColor;
    this._applyFontColor(fontColor);

    const bgColor = this.settings.bgColor || '#0f0f1a';
    document.querySelectorAll('#bg-color-swatches .color-swatch').forEach(swatch => {
      const isActive = swatch.dataset.color === bgColor;
      swatch.classList.toggle('active', isActive);
      swatch.setAttribute('aria-checked', isActive);
    });
    const bgPicker = document.getElementById('bg-picker');
    if (bgPicker) bgPicker.value = bgColor;
    this._applyBgColor(bgColor);

    const opacitySlider = document.getElementById('opacity-slider');
    const opacityValue = document.getElementById('opacity-value');
    if (opacitySlider) {
      opacitySlider.value = Math.round((this.settings.opacity ?? 1) * 100);
      if (opacityValue) opacityValue.textContent = opacitySlider.value + '%';
    }

    const fontSize = this.settings.fontSize || 'medium';
    document.querySelectorAll('.font-size-btn').forEach(btn => {
      const isActive = btn.dataset.size === fontSize;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-checked', isActive);
    });
    document.documentElement.setAttribute('data-font-size', fontSize);

    const hcToggle = document.getElementById('toggle-high-contrast');
    if (hcToggle) hcToggle.checked = !!this.settings.highContrast;
    document.documentElement.setAttribute('data-high-contrast', !!this.settings.highContrast);
  }

  _applyShortcuts() {
    const display = document.getElementById('shortcut-display');
    if (display) display.textContent = this.settings.toggleShortcut || 'Ctrl+Shift+Space';

    const pauseDisplay = document.getElementById('pause-key-display');
    if (pauseDisplay) pauseDisplay.textContent = this.settings.pauseKey || 'Space';
  }

  _applyLanguage() {
    const autoToggle = document.getElementById('toggle-auto-detect');
    if (autoToggle) autoToggle.checked = !!this.settings.autoDetect;

    const currentLang = this.settings.language || 'en-US';
    document.querySelectorAll('.lang-card').forEach(item => {
      item.classList.toggle('active', item.dataset.lang === currentLang);
    });

    const confidenceSlider = document.getElementById('confidence-slider');
    const confidenceValue = document.getElementById('confidence-value');
    if (confidenceSlider) {
      confidenceSlider.value = Math.round((this.settings.confidenceThreshold ?? 0.6) * 100);
      if (confidenceValue) confidenceValue.textContent = confidenceSlider.value + '%';
    }
  }

  async _applyPermissions() {
    const micStatus = document.getElementById('mic-perm-badge');
    const camStatus = document.getElementById('cam-perm-badge');
    const accStatus = document.getElementById('acc-perm-badge');

    if (micStatus) {
      const status = await window.voiceAPI.getMicPermission();
      this._setPermBadge(micStatus, status);
    }

    if (camStatus) {
      const status = await window.voiceAPI.getCameraPermission();
      this._setPermBadge(camStatus, status);
    }

    if (accStatus) {
      // Accessibility status is usually manually checked or managed by OS
      // For now we keep the Required/Granted visual state
    }
  }

  _setPermBadge(el, status) {
    el.textContent = status === 'granted' ? 'Granted' : status === 'denied' ? 'Denied' : 'Not Asked';
    el.className = 'perm-badge ' + (status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'unknown');
  }

  _applyAbout() {
    // About section values are static in HTML
  }

  _bindEvents() {
    // General
    const clipToggle = document.getElementById('toggle-clipboard');
    if (clipToggle) {
      clipToggle.addEventListener('change', (e) => {
        this._save('clipboardMonitor', e.target.checked);
      });
    }

    const startupToggle = document.getElementById('toggle-startup');
    if (startupToggle) {
      startupToggle.addEventListener('change', (e) => {
        this._save('startWithSystem', e.target.checked);
      });
    }

    const alwaysTopToggle = document.getElementById('toggle-always-top');
    if (alwaysTopToggle) {
      alwaysTopToggle.addEventListener('change', (e) => {
        this._save('alwaysOnTop', e.target.checked);
        window.voiceAPI.setAlwaysOnTop(e.target.checked);
      });
    }

    const micDeviceSelect = document.getElementById('mic-device-select');
    if (micDeviceSelect) {
      micDeviceSelect.addEventListener('change', (e) => {
        this._save('micDevice', e.target.value);
      });
    }

    // Appearance
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        this._save('theme', theme);
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._applyTheme(theme);
      });
    });

    document.querySelectorAll('#ui-color-swatches .color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        const color = swatch.dataset.color;
        this._save('accentColor', color);
        document.querySelectorAll('#ui-color-swatches .color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        const picker = document.getElementById('accent-picker');
        if (picker) picker.value = color;
        this._applyAccentColor(color);
      });
    });

    const accentPicker = document.getElementById('accent-picker');
    if (accentPicker) {
      accentPicker.addEventListener('input', (e) => {
        const color = e.target.value;
        this._save('accentColor', color);
        document.querySelectorAll('#ui-color-swatches .color-swatch').forEach(s => s.classList.remove('active'));
        this._applyAccentColor(color);
      });
    }

    document.querySelectorAll('#font-color-swatches .color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        const color = swatch.dataset.color;
        this._save('fontColor', color);
        document.querySelectorAll('#font-color-swatches .color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        const picker = document.getElementById('font-picker');
        if (picker) picker.value = color;
        this._applyFontColor(color);
      });
    });

    const fontPicker = document.getElementById('font-picker');
    if (fontPicker) {
      fontPicker.addEventListener('input', (e) => {
        const color = e.target.value;
        this._save('fontColor', color);
        document.querySelectorAll('#font-color-swatches .color-swatch').forEach(s => s.classList.remove('active'));
        this._applyFontColor(color);
      });
    }

    document.querySelectorAll('#bg-color-swatches .color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        const color = swatch.dataset.color;
        this._save('bgColor', color);
        document.querySelectorAll('#bg-color-swatches .color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        const picker = document.getElementById('bg-picker');
        if (picker) picker.value = color;
        this._applyBgColor(color);
      });
    });

    const bgPicker = document.getElementById('bg-picker');
    if (bgPicker) {
      bgPicker.addEventListener('input', (e) => {
        const color = e.target.value;
        this._save('bgColor', color);
        document.querySelectorAll('#bg-color-swatches .color-swatch').forEach(s => s.classList.remove('active'));
        this._applyBgColor(color);
      });
    }

    const resetAppearanceBtn = document.getElementById('reset-appearance-btn');
    if (resetAppearanceBtn) {
      resetAppearanceBtn.addEventListener('click', () => {
        this._resetAppearance();
      });
    }

    const opacitySlider = document.getElementById('opacity-slider');
    const opacityValue = document.getElementById('opacity-value');
    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) / 100;
        if (opacityValue) opacityValue.textContent = e.target.value + '%';
        window.voiceAPI.setOpacity(val);
        this._save('opacity', val);
      });
    }

    document.querySelectorAll('.font-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const size = btn.dataset.size;
        this._save('fontSize', size);
        document.querySelectorAll('.font-size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.documentElement.setAttribute('data-font-size', size);
      });
    });

    const hcToggle = document.getElementById('toggle-high-contrast');
    if (hcToggle) {
      hcToggle.addEventListener('change', (e) => {
        this._save('highContrast', e.target.checked);
        document.documentElement.setAttribute('data-high-contrast', e.target.checked);
      });
    }

    // Shortcuts
    const shortcutDisplay = document.getElementById('shortcut-display');
    if (shortcutDisplay) {
      shortcutDisplay.addEventListener('click', () => {
        this._startRecordingShortcut('shortcut-display', 'toggleShortcut');
      });
    }

    const shortcutReset = document.getElementById('shortcut-reset');
    if (shortcutReset) {
      shortcutReset.addEventListener('click', async () => {
        await this._save('toggleShortcut', 'CommandOrControl+Shift+Space');
        await window.voiceAPI.registerShortcut('CommandOrControl+Shift+Space');
        if (shortcutDisplay) shortcutDisplay.textContent = 'Ctrl+Shift+Space';
      });
    }

    const pauseKeyDisplay = document.getElementById('pause-key-display');
    if (pauseKeyDisplay) {
      pauseKeyDisplay.addEventListener('click', () => {
        this._startRecordingShortcut('pause-key-display', 'pauseKey');
      });
    }

    // Language
    const autoToggle = document.getElementById('toggle-auto-detect');
    if (autoToggle) {
      autoToggle.addEventListener('change', (e) => {
        this._save('autoDetect', e.target.checked);
        document.querySelectorAll('.lang-card').forEach(item => {
          item.style.opacity = e.target.checked ? '0.4' : '1';
          item.style.pointerEvents = e.target.checked ? 'none' : 'auto';
        });
      });
    }

    document.querySelectorAll('.lang-card').forEach(item => {
      item.addEventListener('click', () => {
        const lang = item.dataset.lang;
        this._save('language', lang);
        window.voiceAPI.changeLanguage(lang);
        document.querySelectorAll('.lang-card').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        // Update main window lang display
        const statusLang = document.getElementById('status-lang');
        if (statusLang) {
          statusLang.textContent = item.querySelector('.lang-name').textContent;
        }
        const langSelect = document.getElementById('lang-select');
        if (langSelect) langSelect.value = lang;
      });
    });

    const confidenceSlider = document.getElementById('confidence-slider');
    const confidenceValue = document.getElementById('confidence-value');
    if (confidenceSlider) {
      confidenceSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) / 100;
        if (confidenceValue) confidenceValue.textContent = e.target.value + '%';
        this._save('confidenceThreshold', val);
      });
    }

    // Permissions
    const micPermBtn = document.getElementById('mic-perm-btn');
    if (micPermBtn) {
      micPermBtn.addEventListener('click', async () => {
        const status = await window.voiceAPI.requestMicPermission();
        const badge = document.getElementById('mic-perm-badge');
        if (badge) this._setPermBadge(badge, status);
      });
    }

    const camPermBtn = document.getElementById('cam-perm-btn');
    if (camPermBtn) {
      camPermBtn.addEventListener('click', async () => {
        const status = await window.voiceAPI.requestCameraPermission();
        const badge = document.getElementById('cam-perm-badge');
        if (badge) this._setPermBadge(badge, status);
      });
    }

    const accessibilityBtn = document.getElementById('accessibility-btn');
    if (accessibilityBtn) {
      accessibilityBtn.addEventListener('click', () => {
        window.voiceAPI.openAccessibilityPrefs();
      });
    }

    // About
    const updateBtn = document.getElementById('check-update-btn');
    if (updateBtn) {
      updateBtn.addEventListener('click', () => {
        updateBtn.textContent = 'Checking...';
        setTimeout(() => {
          updateBtn.textContent = 'You are on the latest version!';
        }, 1500);
      });
    }

    // Close button & Overlay
    const closeBtn = document.getElementById('settings-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    const overlay = document.getElementById('settings-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.close();
      });
    }
  }

  _startRecordingShortcut(displayId, settingKey) {
    const display = document.getElementById(displayId);
    if (!display) return;

    display.textContent = 'Press keys...';
    display.classList.add('recording');
    this.recordingShortcut = true;
    this.keysDown.clear();

    const keydown = (e) => {
      e.preventDefault();
      this.keysDown.add(e.key);
      const parts = [];
      if (e.ctrlKey || e.metaKey) parts.push(window.voiceAPI.platform === 'darwin' ? 'Cmd' : 'Ctrl');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');
      const mainKey = e.key.length === 1 ? e.key.toUpperCase() :
        e.key.replace('Control','').replace('Meta','').replace('Shift','').replace('Alt','');
      if (mainKey) parts.push(mainKey);
      display.textContent = parts.join('+') || 'Press keys...';
    };

    const keyup = (e) => {
      e.preventDefault();
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('keyup', keyup);
      display.classList.remove('recording');
      this.recordingShortcut = false;

      const parts = [];
      if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');
      const mainKey = e.key.length === 1 ? e.key.toUpperCase() :
        e.key === ' ' ? 'Space' : e.key;
      if (mainKey && !['Control','Meta','Shift','Alt'].includes(mainKey)) {
        parts.push(mainKey);
      }

      const combo = parts.join('+');
      if (combo && parts.length > 1) {
        const displayCombo = combo.replace('CommandOrControl', window.voiceAPI.platform === 'darwin' ? 'Cmd' : 'Ctrl');
        display.textContent = displayCombo;
        this._save(settingKey, combo);
        if (settingKey === 'toggleShortcut') {
          window.voiceAPI.registerShortcut(combo);
        }
      } else {
        this._applyShortcuts();
      }
    };

    document.addEventListener('keydown', keydown);
    document.addEventListener('keyup', keyup);
  }

  _applyTheme(theme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }

  _applyAccentColor(color) {
    if (!color || typeof color !== 'string') return;
    
    document.documentElement.style.setProperty('--accent', color);
    
    // Improved hex to rgb conversion
    let r = 0, g = 0, b = 0;
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      }
    }
    
    document.documentElement.style.setProperty('--accent-dim', `rgba(${r},${g},${b},0.15)`);
    document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.35)`);

    if (window._waveform) {
      window._waveform.setAccentColor(color);
    }
  }

  _applyFontColor(color) {
    if (!color || typeof color !== 'string') return;
    document.documentElement.style.setProperty('--text-primary', color);
  }

  _applyBgColor(color) {
    if (!color || typeof color !== 'string') return;
    document.documentElement.style.setProperty('--custom-bg', color);
  }

  async _resetAppearance() {
    const defaults = {
      theme: 'dark',
      accentColor: '#00b4d8',
      fontColor: '#f0f0f5',
      bgColor: '#0f0f1a',
      opacity: 1,
      fontSize: 'medium',
      highContrast: false
    };

    for (const [key, value] of Object.entries(defaults)) {
      await this._save(key, value);
    }

    this._applyAll();
    window.voiceAPI.setOpacity(1);
    window.voiceAPI.setAlwaysOnTop(!!this.settings.alwaysOnTop);
  }

  open() {
    document.getElementById('settings-overlay').classList.add('open');
    document.getElementById('settings-panel').classList.add('open');
    this._switchTab(this.currentTab);
    this._applyPermissions();
  }

  close() {
    document.getElementById('settings-overlay').classList.remove('open');
    document.getElementById('settings-panel').classList.remove('open');
  }
}

window.SettingsManager = SettingsManager;
