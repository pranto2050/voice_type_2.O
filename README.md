# VoiceType Pro

Real-time voice typing desktop application built with Electron + Python. Designed for users with physical disabilities who need to type hands-free.

## Features

- Real-time speech-to-text with Google Speech API (+ Vosk offline fallback)
- Live audio waveform visualization reacting to voice amplitude
- Text injection into any active input field on screen
- Multi-language support: English, Bengali, Hindi, Urdu, Arabic, French, Spanish, Chinese, Japanese
- Voice command control: say "pause", "stop", "clear", "settings"
- Global keyboard shortcut (Ctrl+Shift+Space by default)
- Hold-to-pause with spacebar
- Glassmorphism UI with dark/light/system themes
- Customizable accent color, opacity, font size
- Full accessibility: ARIA labels, keyboard navigation, high contrast mode
- Settings persisted between sessions

---

## Requirements

### System
- **Node.js** 18+ and **npm** 9+
- **Python** 3.9+ (3.11 recommended)
- Internet connection for Google Speech API (or download Vosk model for offline use)

### macOS additional
- Xcode Command Line Tools: `xcode-select --install`
- For PyAudio: `brew install portaudio`

### Windows additional
- Visual C++ Build Tools (for PyAudio native compilation)
- Or install a pre-built PyAudio wheel: `pip install pipwin && pipwin install pyaudio`

---

## Setup — macOS

```bash
# 1. Clone or extract the project
cd voicetype-pro

# 2. Install Node dependencies
npm install

# 3. Install Python dependencies
cd python
pip3 install -r requirements.txt
cd ..

# 4. Run in development mode
npm start
```

### Permissions (macOS)
On first launch, macOS will ask for:
- **Microphone access** — required for speech recognition
- **Accessibility access** — required for text injection into other apps

To grant Accessibility access:
1. Open **System Preferences** → **Privacy & Security** → **Accessibility**
2. Add **VoiceType Pro** (or Terminal during development)

---

## Setup — Windows

```cmd
:: 1. Open Command Prompt as Administrator
:: 2. Navigate to project folder
cd voicetype-pro

:: 3. Install Node dependencies
npm install

:: 4. Install Python dependencies
cd python
pip install -r requirements.txt
cd ..

:: 5. Run in development mode
npm start
```

If PyAudio fails to install:
```cmd
pip install pipwin
pipwin install pyaudio
```

---

## Offline Speech Recognition (Vosk)

For offline use without internet:

1. Download a Vosk model from https://alphacephei.com/vosk/models
2. Extract it and rename the folder to `vosk-model`
3. Place it at `python/vosk-model/`

The engine will automatically use Vosk when Google API is unavailable.

---

## Building Distributables

### Prerequisites
```bash
npm install
```

### macOS (.dmg)
```bash
# Build Python engine first
cd python
pip3 install pyinstaller
pyinstaller --onefile --name voice_engine voice_engine.py
cd ..

# Build Electron app
npm run build:mac
```
Output: `dist/VoiceType Pro-1.0.0.dmg`

### Windows (.exe installer)
```cmd
cd python
pip install pyinstaller
pyinstaller --onefile --name voice_engine voice_engine.py
cd ..

npm run build:win
```
Output: `dist\VoiceType Pro Setup 1.0.0.exe`

---

## App Icons

Place the following files in `assets/`:
- `icon.png` — 512×512 PNG (used for Linux + Windows fallback)
- `icon.ico` — Multi-size ICO file (used for Windows)
- `icon.icns` — macOS icon file

To generate from a 1024×1024 PNG source, use tools like `electron-icon-builder`:
```bash
npx electron-icon-builder --input=assets/source.png --output=assets/
```

---

## File Structure

```
voicetype-pro/
├── main.js                  Electron main process
├── preload.js               Context bridge (IPC security)
├── package.json
├── electron-builder.yml     Packaging config
├── renderer/
│   ├── index.html           Main window UI
│   ├── renderer.js          App logic & state management
│   ├── waveform.js          Web Audio API canvas animation
│   ├── settings.js          Settings panel interactions
│   └── style.css            Complete UI styles
├── python/
│   ├── voice_engine.py      Speech recognition + amplitude streaming
│   └── requirements.txt
└── assets/
    ├── mic.svg              Microphone SVG icon
    └── icon.png             App icon (add your own)
```

---

## Keyboard Shortcuts

| Action | Default |
|--------|---------|
| Toggle listening | Ctrl+Shift+Space (Cmd on macOS) |
| Hold to pause | Hold Spacebar (configurable) |
| Close settings | Escape |

All shortcuts are configurable in **Settings → Shortcuts**.

---

## Voice Commands

While listening, say these words to control the app:
- **"pause"** — pause recognition
- **"resume"** — resume recognition
- **"stop"** — stop recognition
- **"clear"** — clear transcript
- **"copy"** — copy transcript to clipboard
- **"settings"** — open settings panel

---

## Architecture

```
Renderer (index.html + JS)
        ↕ contextBridge (preload.js)
Main Process (main.js)
        ↕ child_process stdin/stdout
Python Engine (voice_engine.py)
        ↕ PyAudio
Microphone
```

The Python engine streams JSON lines to stdout:
- `{"type":"transcript","text":"...","final":true,"confidence":0.95}`
- `{"type":"amplitude","value":0.73}`
- `{"type":"status","message":"..."}`
- `{"type":"error","message":"..."}`

Main process reads stdout, parses JSON, forwards to renderer via IPC.

---

## Troubleshooting

**"Engine stopped" immediately:**
- Verify Python 3.9+ is installed and accessible as `python3` (macOS/Linux) or `python` (Windows)
- Install requirements: `pip3 install -r python/requirements.txt`

**No speech recognized:**
- Check microphone is not muted
- Verify internet for Google Speech API
- Check microphone permissions in System Preferences / Windows Settings

**Text not injecting into other apps (macOS):**
- Grant Accessibility permission in System Preferences → Privacy & Security → Accessibility

**PyAudio install fails on macOS:**
```bash
brew install portaudio
pip3 install pyaudio
```

---

## License

MIT License — free for personal and commercial use.






## Demo run
cd voicetype-pro && npm start



## Quick Copy-Paste Commands
To run the app:
cd /Users/md.prantoislam/Downloads/project\ 4/voicetype-pro
npm start




## To build for macOS (.app + .dmg):
npm run build:mac



## To build for Windows (.exe):
npm run build:win




## To build for Linux (.deb + .AppImage):
npm run build:linux
