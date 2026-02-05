# Installation Guide for macOS

## ⚠️ Important Notice

**AI Resume Builder** is currently distributed as an **unsigned application**. This means it is not signed with an Apple Developer certificate. macOS will show security warnings when you first try to open it.

**This is normal and safe** - the app is open source and you can verify the code on [GitHub](https://github.com/raphaelmatori/ai-resume).

---

## 📦 Choose Your Installation Method

### **Option A: DMG Installer (Recommended)**

1. **Download** the `.dmg` file from the [latest release](https://github.com/raphaelmatori/ai-resume/releases/latest)
   - For Apple Silicon Macs (M1/M2/M3): Download `AI-Resume-Builder-{version}-arm64.dmg`
   - For Intel Macs: Download `AI-Resume-Builder-{version}-x64.dmg`

2. **Open** the downloaded DMG file

3. **Drag** the app to your Applications folder

4. **First Launch** - Follow the steps in "Opening the App" section below

### **Option B: ZIP Archive**

1. **Download** the `.zip` file from the [latest release](https://github.com/raphaelmatori/ai-resume/releases/latest)
   - For Apple Silicon: Download `AI-Resume-Builder-{version}-arm64-mac.zip`
   - For Intel: Download `AI-Resume-Builder-{version}-x64-mac.zip`

2. **Extract** the ZIP file (double-click it)

3. **Move** the extracted app to your Applications folder

4. **First Launch** - Follow the steps below

---

## 🐍 Python Requirements

**IMPORTANT:** This app requires Python 3.9+ to be installed on your system.

### **Quick Setup**

```bash
# 1. Check if Python 3 is installed
python3 --version

# 2. If not installed, install via Homebrew (recommended)
brew install python@3.11

# 3. Install required Python packages
pip3 install openai langchain langchain-openai langchain-google-genai pdfplumber python-docx pandas python-dotenv pydantic tiktoken trafilatura requests
```

### **Why Python is Required**

The app uses Python scripts for:
- PDF processing and text extraction
- AI-powered content generation (via OpenAI/Google AI)
- Document creation (DOCX format)

**Note:** The app will automatically detect your system Python installation. If Python is not found, you'll see an error when trying to process documents.

---

## 🚀 Opening the App (First Time)

Because the app is unsigned, macOS Gatekeeper will block it on first launch. Here's how to open it safely:

### **Method 1: Right-Click Method (Easiest)**

1. **Locate** the app in your Applications folder
2. **Right-click** (or Control-click) on "AI Resume Builder"
3. Select **"Open"** from the context menu
4. A dialog will appear saying the app is from an unidentified developer
5. Click **"Open"** in the dialog

✅ **That's it!** You only need to do this once. After the first launch, you can open the app normally.

### **Method 2: System Settings (Alternative)**

If the right-click method doesn't work:

1. **Try to open** the app normally (it will be blocked)
2. Go to **System Settings** → **Privacy & Security**
3. Scroll down to the **Security** section
4. You'll see a message: *"AI Resume Builder was blocked from use because it is not from an identified developer"*
5. Click **"Open Anyway"**
6. Confirm by clicking **"Open"** in the next dialog

### **Method 3: Terminal (Advanced Users)**

If you're comfortable with the command line:

```bash
# Remove the quarantine attribute
xattr -cr /Applications/AI\ Resume\ Builder.app

# Then open normally
open /Applications/AI\ Resume\ Builder.app
```

---

## 🔒 Security & Privacy

### **Why is this app unsigned?**

Code signing and notarization through Apple requires:
- Enrollment in the Apple Developer Program ($99/year)
- Annual certificate renewal
- Notarization process for every release

As an open-source project, we've chosen to distribute unsigned builds to keep the project free and accessible.

### **Is it safe?**

**Yes!** Here's why you can trust this app:

✅ **Open Source**: All code is publicly available on [GitHub](https://github.com/raphaelmatori/ai-resume)  
✅ **Transparent Builds**: Built automatically via GitHub Actions (see [workflow](https://github.com/raphaelmatori/ai-resume/actions))  
✅ **No Network Access**: The app processes everything locally on your machine  
✅ **Community Verified**: You can review the code and build it yourself

### **Verify the Download**

You can verify the integrity of your download:

```bash
# Calculate SHA-256 checksum
shasum -a 256 ~/Downloads/AI-Resume-Builder-*.dmg

# Compare with the checksum in the release notes
```

---

## 🛠️ Troubleshooting

### **"App is damaged and can't be opened"**

This usually happens when the quarantine attribute is set incorrectly.

**Solution:**
```bash
xattr -cr /Applications/AI\ Resume\ Builder.app
```

### **App won't open at all**

1. Make sure you downloaded the correct version for your Mac:
   - Apple Silicon (M1/M2/M3): Use `arm64` version
   - Intel: Use `x64` version

2. Check your macOS version:
   - This app requires macOS 10.15 (Catalina) or later

3. Try removing and reinstalling:
   ```bash
   # Remove the app
   rm -rf /Applications/AI\ Resume\ Builder.app
   
   # Re-download and install
   ```

### **Still having issues?**

- Check [GitHub Issues](https://github.com/raphaelmatori/ai-resume/issues)
- Open a new issue with details about your:
  - macOS version
  - Mac model (Intel or Apple Silicon)
  - Error messages or screenshots

---

## 🏗️ Build From Source (Ultimate Security)

If you want complete control and verification:

```bash
# Clone the repository
git clone https://github.com/raphaelmatori/ai-resume.git
cd ai-resume

# Install dependencies
npm install

# Run in development mode
npm start

# Or build your own distribution
npm run dist
```

See [README.md](README.md) for full development instructions.

---

## 📝 Notes for Different macOS Versions

### **macOS Ventura (13.0+) and Sonoma (14.0+)**
The security prompts are more strict. You **must** use the right-click method or System Settings approach.

### **macOS Monterey (12.0) and earlier**
The right-click method should work immediately.

### **macOS Big Sur (11.0) and earlier**
You may see different dialog text, but the process is the same.

---

## ✨ After Installation

Once installed, the app will:
- ✅ Open normally without security warnings
- ✅ Appear in Launchpad and Spotlight
- ✅ Work like any other macOS application

Enjoy building your AI-powered resume! 🎉

---

## 🤝 Support the Project

If you find this app useful and want to see it properly signed in the future, consider:
- ⭐ Starring the [GitHub repository](https://github.com/raphaelmatori/ai-resume)
- 🐛 Reporting bugs or suggesting features
- 💬 Sharing with others who might find it useful
- 💰 Sponsoring the project (if available)

---

**Last Updated:** February 2026  
**App Version:** See [latest release](https://github.com/raphaelmatori/ai-resume/releases/latest)
