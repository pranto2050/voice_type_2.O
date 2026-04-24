# VoiceType Pro - Complete Setup & Build Guide

Real-time voice typing desktop application built with Electron + Python. Designed for users with physical disabilities who need to type hands-free.

---

## 📋 Prerequisites

### All Systems (macOS & Windows)
- **Node.js** 18 or higher
- **npm** 9 or higher  
- **Python** 3.9 or higher (3.11+ recommended)
- **Git** (optional, for cloning)

### macOS Specific
- **Xcode Command Line Tools**
- **Homebrew** (optional but recommended)

### Windows Specific
- **Visual C++ Build Tools** (for native module compilation)
- **Windows 10/11** (64-bit recommended)

---

## ⚡ Quick Start Commands

### 1️⃣ Setup (Run Once)

**macOS:**
```bash
cd /Users/md.prantoislam/Downloads/project\ 4/voicetype-pro
npm install
pip3 install --break-system-packages -r python/requirements.txt
```

**Windows:**
```bash
cd "C:\Users\YourUsername\Downloads\project 4\voicetype-pro"
npm install
pip install -r python/requirements.txt
```

### 2️⃣ Run the Application

**macOS:**
```bash
cd /Users/md.prantoislam/Downloads/project\ 4/voicetype-pro
npm start
```

**Windows:**
```bash
cd "C:\Users\YourUsername\Downloads\project 4\voicetype-pro"
npm start
```

---

## 🏗️ Building for Distribution

### Build for macOS (.app file)

```bash
cd /Users/md.prantoislam/Downloads/project\ 4/voicetype-pro
npm run build:mac
```

✅ **Output:** `dist/VoiceTypePro-*.dmg` (installer)  
✅ **App Location:** `dist/mac/VoiceTypePro.app`

**To install from DMG:**
1. Double-click the `.dmg` file
2. Drag VoiceTypePro to Applications folder
3. Launch from Applications

---

### Build for Windows (.exe file)

```bash
cd "C:\Users\YourUsername\Downloads\project 4\voicetype-pro"
npm run build:win
```

✅ **Output:** `dist/VoiceTypePro-*.exe` (installer)  
✅ **Portable:** `dist/VoiceTypePro-*.exe` (can run without installation)

**To install on Windows:**
1. Double-click the `.exe` file
2. Follow the installer wizard
3. Launch from Start Menu

---

## 📁 Project Structure

```
voicetype-pro/
├── main.js                 # Electron main process
├── preload.js             # Preload script for IPC security
├── renderer/
│   ├── index.html         # Main UI
│   ├── renderer.js        # Renderer process logic
│   ├── settings.js        # Settings UI logic
│   ├── style.css          # Main styles
│   └── waveform.js        # Audio waveform visualization
├── python/
│   ├── requirements.txt    # Python dependencies
│   └── voice_engine.py     # Python voice processing
├── assets/
│   └── mic.svg            # App icon
├── electron-builder.yml   # Build configuration
├── package.json           # npm configuration
└── README_SETUP.md        # This file
```

---

## 🔧 Detailed Setup Instructions

### macOS Setup (Step by Step)

**Step 1: Install Homebrew (if not installed)**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Step 2: Install Python**
```bash
brew install python
```

**Step 3: Verify installations**
```bash
python3 --version
pip3 --version
npm --version
node --version
```

**Step 4: Install Xcode Command Line Tools (if needed)**
```bash
xcode-select --install
```

**Step 5: Install PyAudio dependencies**
```bash
brew install portaudio
```

**Step 6: Navigate to project and install dependencies**
```bash
cd "/Users/md.prantoislam/Downloads/project 4/voicetype-pro"
npm install
pip3 install --break-system-packages -r python/requirements.txt
```

**Step 7: Run the app**
```bash
npm start
```

---

### Windows Setup (Step by Step)

**Step 1: Install Node.js**
- Download from https://nodejs.org/ (LTS version)
- Run installer and follow wizard
- Verify: Open Command Prompt and run:
```bash
node --version
npm --version
```

**Step 2: Install Python**
- Download from https://www.python.org/downloads/
- **Important:** Check "Add Python to PATH" during installation
- Verify in Command Prompt:
```bash
python --version
pip --version
```

**Step 3: Install Visual C++ Build Tools**
- Download from: https://visualstudio.microsoft.com/downloads/
- Select "Desktop development with C++"
- Install

**Step 4: Navigate to project**
```bash
cd "C:\Users\YourUsername\Downloads\project 4\voicetype-pro"
```

**Step 5: Install dependencies**
```bash
npm install
pip install -r python/requirements.txt
```

**Step 6: Run the app**
```bash
npm start
```

---

## 🎨 Features

- ✅ Real-time speech-to-text with Google Speech API
- ✅ Vosk offline fallback support
- ✅ Live audio waveform visualization
- ✅ Text injection into any active field
- ✅ Multi-language support (9 languages)
- ✅ Voice commands (pause, stop, clear, settings)
- ✅ Global keyboard shortcut (Ctrl+Shift+Space)
- ✅ Glassmorphism UI with theme support
- ✅ Customizable settings
- ✅ Full accessibility support

---

## 📝 npm Scripts

```bash
npm start              # Launch the app
npm run build          # Build for current OS
npm run build:mac      # Build macOS .dmg and .app
npm run build:win      # Build Windows .exe
npm run pack           # Create package without installer
```

---

## 🐛 Troubleshooting

### "Missing script: start"
**Solution:** Make sure you're in the `voicetype-pro` directory, not the parent `project 4` directory.
```bash
cd voicetype-pro
npm start
```

### Python packages installation fails
**macOS Solution:**
```bash
pip3 install --break-system-packages -r python/requirements.txt
```

**Windows Solution:**
```bash
pip install --user -r python/requirements.txt
```

### PyAudio installation errors
**macOS:**
```bash
brew install portaudio
pip3 install --break-system-packages PyAudio
```

**Windows:**
```bash
pip install pipwin
pipwin install pyaudio
```

### Electron app won't start
- Ensure Python is installed and accessible
- Check that all npm dependencies are installed: `npm install`
- Try clearing cache: `rm -rf node_modules && npm install`

### Build errors on Windows
- Install Visual C++ Build Tools
- Ensure Python is in your PATH
- Run Command Prompt as Administrator

---

## 🔗 Useful Links

- **Electron:** https://www.electronjs.org/
- **Electron Builder:** https://www.electron.build/
- **Python-shell:** https://github.com/extrabits/python-shell
- **Vosk Speech Recognition:** https://github.com/alphacep/vosk-api

---

## 📦 Distribution Files

After building, you'll find:

**macOS:**
- `dist/VoiceTypePro-1.0.0.dmg` - Installer for macOS
- `dist/mac/VoiceTypePro.app` - Application bundle

**Windows:**
- `dist/VoiceTypePro Setup 1.0.0.exe` - Installer
- `dist/VoiceTypePro 1.0.0.exe` - Portable executable

---

## ✨ Tips

1. **First time setup takes 5-10 minutes** due to dependency installation
2. **Subsequent runs are much faster**
3. **For development:** Use `npm start` to test changes
4. **For distribution:** Use `npm run build:mac` or `npm run build:win`
5. **Keep Python in your system PATH** for easier terminal commands

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🆘 Need Help?

If you encounter issues:
1. Check the troubleshooting section above
2. Verify all prerequisites are installed
3. Check the terminal error messages carefully
4. Ensure you're in the correct directory (`voicetype-pro`)

---

**Last Updated:** April 2026  
**Version:** 1.0.0
