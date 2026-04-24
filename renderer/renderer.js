'use strict';

class VoiceTypeApp {
  constructor() {
    this.isListening = false;
    this.isPaused = false;
    this.engineRunning = false;
    this.transcriptLines = [];
    this.interimText = '';
    this.waveform = null;
    this.settings = null;
    this.micStream = null;
    this.onboardingShown = false;
    this.voiceCommandBuffer = '';
    this.voiceCommandTimer = null;
    this.isMiniMode = false;

    this._init();
  }

  async _init() {
    this._bindWindowControls();
    this._bindMainControls();
    this._bindIPCListeners();
    this._initLanguageSelector();

    // Init settings manager
    this.settings = new SettingsManager();

    // Init waveform
    this.waveform = new WaveformVisualizer('waveform-canvas');
    window._waveform = this.waveform;

    // Apply saved colors
    const savedSettings = await window.voiceAPI.getSettings();
    if (savedSettings.accentColor) {
      this.settings._applyAccentColor(savedSettings.accentColor);
    }
    if (savedSettings.fontColor) {
      this.settings._applyFontColor(savedSettings.fontColor);
    }
    if (savedSettings.bgColor) {
      this.settings._applyBgColor(savedSettings.bgColor);
    }
    if (savedSettings.theme) {
      this.settings._applyTheme(savedSettings.theme);
    }

    // Check first run
    const hasSeenOnboarding = localStorage.getItem('voicetype-onboarding-done');
    if (!hasSeenOnboarding) {
      setTimeout(() => this._showOnboarding(), 800);
    }

    this._updateEngineStatus('loading', 'Starting voice engine...');
  }

  _bindWindowControls() {
    const platform = window.voiceAPI.platform;

    if (platform === 'darwin') {
      document.getElementById('mac-controls').style.display = 'flex';
      document.getElementById('win-controls').style.display = 'none';
      document.getElementById('btn-mac-close').addEventListener('click', () => window.voiceAPI.close());
      document.getElementById('btn-mac-min').addEventListener('click', () => window.voiceAPI.minimize());
      document.getElementById('btn-mac-max').addEventListener('click', () => window.voiceAPI.maximize());
    } else {
      document.getElementById('mac-controls').style.display = 'none';
      document.getElementById('win-controls').style.display = 'flex';
      document.getElementById('btn-win-min').addEventListener('click', () => window.voiceAPI.minimize());
      document.getElementById('btn-win-max').addEventListener('click', () => window.voiceAPI.maximize());
      document.getElementById('btn-win-close').addEventListener('click', () => window.voiceAPI.close());
    }
  }

  _bindMainControls() {
    // Mic button
    const micBtn = document.getElementById('mic-btn');
    if (micBtn) {
      micBtn.addEventListener('click', () => this._toggleListening());
      micBtn.setAttribute('aria-label', 'Toggle voice recognition');
    }

    // Hold button
    const holdBtn = document.getElementById('hold-btn');
    if (holdBtn) {
      holdBtn.addEventListener('mousedown', () => this._pause());
      holdBtn.addEventListener('mouseup', () => this._resume());
      holdBtn.addEventListener('mouseleave', () => {
        if (this.isPaused) this._resume();
      });
      holdBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this._pause(); });
      holdBtn.addEventListener('touchend', () => this._resume());
      holdBtn.setAttribute('aria-label', 'Hold to pause voice recognition');
    }

    // Language selector
    const langSelect = document.getElementById('lang-select');
    if (langSelect) {
      langSelect.addEventListener('change', (e) => {
        window.voiceAPI.changeLanguage(e.target.value);
        this._updateStatusLang(e.target.value);
      });
    }

    // Settings button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.settings.open();
      });
    }

    // Settings overlay close
    const overlay = document.getElementById('settings-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.settings.close();
      });
    }

    const settingsCloseBtn = document.getElementById('settings-close-btn');
    if (settingsCloseBtn) {
      settingsCloseBtn.addEventListener('click', () => this.settings.close());
    }

    // Transcript actions
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this._copyTranscript());
    }

    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this._clearTranscript());
    }

    // Collapse/Expand controls
    const collapseBtn = document.getElementById('btn-collapse');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => this._toggleMiniMode(true));
    }

    const expandBtn = document.getElementById('btn-expand');
    if (expandBtn) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleMiniMode(false);
      });
    }

    const miniBar = document.getElementById('mini-bar');
    if (miniBar) {
      miniBar.addEventListener('click', () => {
        if (this.isMiniMode) this._toggleMiniMode(false);
      });
    }

    // Onboarding
    const onboardingBtn = document.getElementById('onboarding-permit-btn');
    if (onboardingBtn) {
      onboardingBtn.addEventListener('click', async () => {
        await window.voiceAPI.requestMicPermission();
        this._hideOnboarding();
        this._initMicStream();
      });
    }

    const onboardingSkip = document.getElementById('onboarding-skip');
    if (onboardingSkip) {
      onboardingSkip.addEventListener('click', () => {
        this._hideOnboarding();
        this._initMicStream();
      });
    }

    // Keyboard shortcuts for accessibility
    document.addEventListener('keydown', (e) => this._handleKeyDown(e));
    document.addEventListener('keyup', (e) => this._handleKeyUp(e));
  }

  _bindIPCListeners() {
    window.voiceAPI.onTranscript((data) => {
      this._handleTranscript(data);
    });

    window.voiceAPI.onAmplitude((data) => {
      if (this.waveform) {
        this.waveform.setExternalAmplitude(data.value);
      }
    });

    window.voiceAPI.onListeningState((data) => {
      this.isListening = data.listening;
      this.isPaused = data.paused;
      this._updateMicUI();
    });

    window.voiceAPI.onEngineStatus((data) => {
      if (data.running) {
        this.engineRunning = true;
        this._updateEngineStatus('ok', 'Voice engine ready');
      } else {
        this.engineRunning = false;
        this._updateEngineStatus('error', `Engine stopped (code ${data.code ?? '?'})`);
      }
    });

    window.voiceAPI.onEngineError((data) => {
      this._updateEngineStatus('error', data.message || 'Engine error');
    });
  }

  _initLanguageSelector() {
    const languages = [
      { code: 'en-US', name: 'English (US)' },
      { code: 'bn-BD', name: 'Bengali' },
      { code: 'hi-IN', name: 'Hindi' },
      { code: 'ur-PK', name: 'Urdu' },
      { code: 'ar-SA', name: 'Arabic' },
      { code: 'fr-FR', name: 'French' },
      { code: 'es-ES', name: 'Spanish' },
      { code: 'zh-CN', name: 'Chinese' },
      { code: 'ja-JP', name: 'Japanese' }
    ];
    const select = document.getElementById('lang-select');
    if (!select) return;
    languages.forEach(lang => {
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = lang.name;
      select.appendChild(opt);
    });
    window.voiceAPI.getSetting('language').then(lang => {
      if (lang) {
        select.value = lang;
        this._updateStatusLang(lang);
      } else {
        select.value = 'en-US';
        this._updateStatusLang('en-US');
      }
    });
  }

  async _initMicStream() {
    try {
      const constraints = { audio: { echoCancellation: true, noiseSuppression: true } };
      const savedMic = await window.voiceAPI.getSetting('micDevice');
      if (savedMic && savedMic !== 'default') {
        constraints.audio.deviceId = { exact: savedMic };
      }
      this.micStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.waveform) {
        await this.waveform.connect(this.micStream);
      }
    } catch (err) {
      this._updateEngineStatus('error', 'Mic access denied: ' + err.message);
    }
  }

  _toggleListening() {
    if (this.isListening) {
      this._stopListening();
    } else {
      this._startListening();
    }
  }

  _startListening() {
    if (!this.micStream) {
      this._initMicStream().then(() => {
        this.isListening = true;
        this.isPaused = false;
        window.voiceAPI.startRecognition();
        this._updateMicUI();
        if (this.waveform) this.waveform.setState('listening');
      });
    } else {
      this.isListening = true;
      this.isPaused = false;
      window.voiceAPI.startRecognition();
      this._updateMicUI();
      if (this.waveform) this.waveform.setState('listening');
    }
  }

  _stopListening() {
    this.isListening = false;
    this.isPaused = false;
    window.voiceAPI.stopRecognition();
    this._updateMicUI();
    if (this.waveform) this.waveform.setState('idle');
    this.interimText = '';
    this._renderTranscript();
  }

  _pause() {
    if (!this.isListening) return;
    const holdBtn = document.getElementById('hold-btn');
    if (holdBtn) holdBtn.classList.add('held');
    this.isPaused = true;
    window.voiceAPI.pauseRecognition();
    this._updateMicUI();
    if (this.waveform) this.waveform.setState('paused');
  }

  _resume() {
    const holdBtn = document.getElementById('hold-btn');
    if (holdBtn) holdBtn.classList.remove('held');
    if (!this.isPaused) return;
    this.isPaused = false;
    window.voiceAPI.resumeRecognition();
    this._updateMicUI();
    if (this.waveform && this.isListening) this.waveform.setState('listening');
  }

  _updateMicUI() {
    const micBtn = document.getElementById('mic-btn');
    const micContainer = document.getElementById('mic-container');
    const micLabel = document.getElementById('mic-label');
    const statusPill = document.getElementById('status-pill');
    const statusDot = document.getElementById('status-dot');
    const statusState = document.getElementById('status-state');
    const appEl = document.getElementById('app');

    if (!micBtn) return;

    micBtn.classList.remove('active', 'paused');
    micContainer.classList.remove('listening');
    statusDot.classList.remove('active', 'paused', 'error');
    if (appEl) appEl.classList.remove('listening');

    if (this.isPaused) {
      micBtn.classList.add('paused');
      micLabel.textContent = 'Paused';
      statusDot.classList.add('paused');
      statusState.textContent = 'Paused';
      statusPill.classList.remove('listening');
    } else if (this.isListening) {
      micBtn.classList.add('active');
      micContainer.classList.add('listening');
      micLabel.textContent = 'Listening...';
      statusDot.classList.add('active');
      statusState.textContent = 'Listening';
      statusPill.classList.add('listening');
      if (appEl) appEl.classList.add('listening');
    } else {
      micLabel.textContent = 'Tap to speak';
      statusState.textContent = 'Idle';
      statusPill.classList.remove('listening');
    }

    micBtn.setAttribute('aria-label',
      this.isPaused ? 'Resume recognition' :
      this.isListening ? 'Stop recognition' : 'Start recognition'
    );

    // Update mic SVG icon
    const micIcon = micBtn.querySelector('#mic-icon');
    const pauseIcon = micBtn.querySelector('#pause-icon');
    if (micIcon && pauseIcon) {
      micIcon.style.display = this.isPaused ? 'none' : 'block';
      pauseIcon.style.display = this.isPaused ? 'block' : 'none';
    }
  }

  _toggleMiniMode(mini) {
    this.isMiniMode = mini;
    const appEl = document.getElementById('app');
    
    if (this.isMiniMode) {
      appEl.classList.add('collapsed');
      window.voiceAPI.setWindowSize(320, 56);
      window.voiceAPI.setAlwaysOnTop(true);
    } else {
      appEl.classList.remove('collapsed');
      window.voiceAPI.getSettings().then(settings => {
        // Use saved bounds or default if not available
        let { width, height } = settings.windowBounds || { width: 420, height: 680 };
        
        // Safety check: if width/height are too small (mini mode size), use defaults
        if (height < 100) {
          width = 420;
          height = 680;
        }
        
        window.voiceAPI.setWindowSize(width, height);
        window.voiceAPI.setAlwaysOnTop(settings.alwaysOnTop || false);
      });
    }
    
    this._updateMicUI();
  }

  _handleTranscript(data) {
    if (!this.isListening || this.isPaused) return;

    if (data.final) {
      this.interimText = '';
      if (data.text && data.text.trim()) {
        this.transcriptLines.push({ text: data.text.trim(), type: 'final' });
        if (this.transcriptLines.length > 20) {
          this.transcriptLines = this.transcriptLines.slice(-20);
        }
        this._processVoiceCommands(data.text.trim().toLowerCase());
      }
    } else {
      this.interimText = data.text || '';
    }
    this._renderTranscript();
    this._updateMiniTranscript();
  }

  _updateMiniTranscript() {
    const miniPlaceholder = document.getElementById('mini-transcript-placeholder');
    if (!miniPlaceholder) return;

    if (this.interimText) {
      miniPlaceholder.textContent = this.interimText;
      miniPlaceholder.style.color = 'var(--text-primary)';
    } else if (this.transcriptLines.length > 0) {
      miniPlaceholder.textContent = this.transcriptLines[this.transcriptLines.length - 1].text;
      miniPlaceholder.style.color = 'var(--text-primary)';
    } else {
      miniPlaceholder.textContent = 'VoiceType Pro...';
      miniPlaceholder.style.color = 'var(--text-muted)';
    }
  }

  _processVoiceCommands(text) {
    const commands = {
      'pause': () => this._pause(),
      'stop': () => this._stopListening(),
      'clear': () => this._clearTranscript(),
      'settings': () => this.settings.open(),
      'resume': () => this._resume(),
      'copy': () => this._copyTranscript()
    };

    for (const [cmd, action] of Object.entries(commands)) {
      if (text === cmd || text === `hey voice type ${cmd}`) {
        action();
        // Remove the command word from transcript
        this.transcriptLines = this.transcriptLines.filter(l => l.text.toLowerCase() !== text);
        this._renderTranscript();
        return;
      }
    }
  }

  _renderTranscript() {
    const box = document.getElementById('transcript-box');
    const placeholder = document.getElementById('transcript-placeholder');
    if (!box) return;

    const hasContent = this.transcriptLines.length > 0 || this.interimText;
    if (placeholder) placeholder.style.opacity = hasContent ? '0' : '1';

    const lastThree = this.transcriptLines.slice(-3);
    let html = lastThree.map(l => `<div class="line final">${this._escapeHtml(l.text)}</div>`).join('');
    if (this.interimText) {
      html += `<div class="line interim">${this._escapeHtml(this.interimText)}</div>`;
    }
    box.innerHTML = html;
    box.scrollTop = box.scrollHeight;
  }

  _copyTranscript() {
    const allText = this.transcriptLines.map(l => l.text).join(' ');
    if (allText) {
      navigator.clipboard.writeText(allText).catch(() => {});
    }
  }

  _clearTranscript() {
    this.transcriptLines = [];
    this.interimText = '';
    this._renderTranscript();
  }

  _updateStatusLang(langCode) {
    const el = document.getElementById('status-lang');
    if (!el) return;
    const langNames = {
      'en-US': 'English',
      'bn-BD': 'Bengali',
      'hi-IN': 'Hindi',
      'ur-PK': 'Urdu',
      'ar-SA': 'Arabic',
      'fr-FR': 'French',
      'es-ES': 'Spanish',
      'zh-CN': 'Chinese',
      'ja-JP': 'Japanese'
    };
    el.textContent = langNames[langCode] || langCode;
  }

  _updateEngineStatus(type, message) {
    const dot = document.getElementById('engine-dot');
    const text = document.getElementById('engine-status-text');
    if (dot) {
      dot.className = 'engine-dot ' + type;
    }
    if (text) {
      text.textContent = message;
    }
  }

  _showOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) overlay.classList.add('show');
    this.onboardingShown = true;
  }

  _hideOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) overlay.classList.remove('show');
    localStorage.setItem('voicetype-onboarding-done', '1');
    this.onboardingShown = false;
  }

  _handleKeyDown(e) {
    // Escape closes settings
    if (e.key === 'Escape') {
      this.settings.close();
      return;
    }

    // Prevent shortcut recording from triggering app shortcuts
    if (this.settings && this.settings.recordingShortcut) return;

    // Space as hold-to-pause when listening (outside of inputs)
    if (e.key === ' ' && this.isListening && !this._isInputFocused()) {
      e.preventDefault();
      this._pause();
    }
  }

  _handleKeyUp(e) {
    if (this.settings && this.settings.recordingShortcut) return;
    if (e.key === ' ' && this.isPaused && !this._isInputFocused()) {
      this._resume();
    }
  }

  _isInputFocused() {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }

  _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window._app = new VoiceTypeApp();
});
