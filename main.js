const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { PythonShell } = require('python-shell');

// Helper to determine storage path (UserData in prod, __dirname in dev)
function getStoragePath() {
    return app.isPackaged ? app.getPath('userData') : __dirname;
}

let mainWindow;

process.on('uncaughtException', (error) => {
    console.error('CRITICAL ERROR:', error);
    dialog.showErrorBox('Application Error', error.stack || error.message);
});

function createWindow() {
    try {
        // Ensure required directories exist
        const baseDir = app.isPackaged ? path.dirname(app.getPath('exe')) : __dirname;
        // In macOS .app bundle, getPath('exe') is deep inside.
        // Better to use userData for persistent storage in production
        const storageDir = app.isPackaged ? app.getPath('userData') : __dirname;

        console.log("Storage Directory:", storageDir);

        const requiredDirs = [
            path.join(storageDir, 'sources', 'candidate'),
            path.join(storageDir, 'sources', 'vacancy'),
            path.join(storageDir, 'data', 'processed'),
            path.join(storageDir, 'output')
        ];

        requiredDirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`Created directory: ${dir}`);
            }
        });

        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
                devTools: true
            }
        });

        mainWindow.loadFile('index.html');

        // OPEN DEV TOOLS TO SEE ERRORS
        mainWindow.webContents.openDevTools();

    } catch (e) {
        console.error("Window Creation Failed:", e);
        dialog.showErrorBox("Startup Error", e.message);
    }
}

// Helper to run python script with streaming logs
async function runPythonScriptStream(scriptName, options) {
    return new Promise((resolve) => {
        let messages = [];
        let shell = new PythonShell(scriptName, options);

        const sendLog = (m, isError = false) => {
            messages.push(m);
            console.log(`[Python ${isError ? 'ERR' : 'OUT'}] ${m}`);
            if (mainWindow) {
                mainWindow.webContents.send('python-log', { message: m, isError });
            }
        };

        shell.on('message', (m) => sendLog(m));
        shell.on('stderr', (s) => sendLog("STDERR: " + s, true));
        shell.end((err) => {
            if (err) {
                resolve({ status: 'error', error: err.message, output: messages });
            } else {
                resolve({ status: 'success', output: messages });
            }
        });
    });
}

app.whenReady().then(() => {
    createWindow();

    ipcMain.handle('select-files', async (event, { multi, type }) => {
        const filters = type === 'candidate'
            ? [{ name: 'PDF Documents', extensions: ['pdf'] }]
            : [{ name: 'Job Description', extensions: ['txt', 'pdf', 'docx'] }];

        const result = await dialog.showOpenDialog({
            properties: multi ? ['openFile', 'multiSelections'] : ['openFile'],
            filters: filters
        });

        if (result.canceled) {
            return { status: 'canceled' };
        }
        return { status: 'success', filePaths: result.filePaths };
    });



    // Helper for clearing data (Internal and IPC)
    const clearDataInternal = () => {
        try {
            const storage = getStoragePath();
            const dirs = [
                path.join(storage, 'sources/candidate'),
                path.join(storage, 'sources/vacancy'),
                path.join(storage, 'data/processed'),
                path.join(storage, 'output')
            ];

            for (const dir of dirs) {
                if (fs.existsSync(dir)) {
                    const files = fs.readdirSync(dir);
                    for (const file of files) {
                        try {
                            const filePath = path.join(dir, file);
                            // Don't delete .gitkeep
                            if (file !== '.gitkeep') {
                                fs.unlinkSync(filePath);
                            }
                        } catch (e) { console.error(`Failed to delete ${file}:`, e); }
                    }
                }
            }
            return { status: 'success' };
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    };

    ipcMain.handle('clear-app-data', async () => {
        return clearDataInternal();
    });

    // AUTO-RESET ON LAUNCH
    console.log("App Launch: Clearing local data...");
    clearDataInternal();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

function copyFile(source, targetDir) {
    const fileName = path.basename(source);
    const targetPath = path.join(targetDir, fileName);
    fs.copyFileSync(source, targetPath);
    return targetPath;
}

// IPC Handlers

ipcMain.handle('upload-files', async (event, { filePaths, type, textContent }) => {
    try {
        const baseDir = path.join(getStoragePath(), 'sources');
        const targetDir = type === 'candidate' ? path.join(baseDir, 'candidate') : path.join(baseDir, 'vacancy');

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const handledFiles = [];

        // Handle raw text content (e.g. from Step 2 paste)
        if (textContent) {
            const fileName = 'job_description.txt';
            const filePath = path.join(targetDir, fileName);
            fs.writeFileSync(filePath, textContent);
            handledFiles.push({
                name: fileName,
                path: filePath,
                size: Buffer.byteLength(textContent)
            });
            console.log(`Saved raw text content to ${filePath}`);
        }

        // Handle actual file paths (Step 1 browse/drop)
        for (const file of filePaths) {
            if (!file) continue;
            console.log(`Copying ${file} to ${targetDir}`);
            const targetPath = copyFile(file, targetDir);
            const stats = fs.statSync(targetPath);
            handledFiles.push({
                name: path.basename(targetPath),
                path: targetPath,
                size: stats.size
            });
        }

        return { status: 'success', files: handledFiles };
    } catch (error) {
        console.error("Upload error:", error);
        return { status: 'error', error: error.message };
    }
});

ipcMain.handle('open-path', async (event, filePath) => {
    const fullPath = path.join(getStoragePath(), filePath);
    shell.openPath(fullPath);
    return { status: 'success' };
});

ipcMain.handle('show-in-folder', async (event, filePath) => {
    const fullPath = path.join(getStoragePath(), filePath);
    shell.showItemInFolder(fullPath);
    return { status: 'success' };
});

ipcMain.handle('delete-file', async (event, filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return { status: 'success' };
        }
        return { status: 'error', error: 'File not found' };
    } catch (e) {
        return { status: 'error', error: e.message };
    }
});

// Settings Management (.env based)
ipcMain.handle('get-config', async () => {
    // Try user config first (in userData), then default (in app bundle)
    const userEnvPath = path.join(getStoragePath(), '.env');
    if (fs.existsSync(userEnvPath)) {
        return parseEnv(userEnvPath);
    }

    // Fallback to default .env in bundle if not in production
    const defaultEnvPath = path.join(__dirname, '.env');
    if (fs.existsSync(defaultEnvPath) && !app.isPackaged) {
        return parseEnv(defaultEnvPath);
    }

    return {};
});

function parseEnv(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const config = {};
    content.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) config[key.trim()] = value.trim();
    });
    return config;
}

ipcMain.handle('get-app-version', async () => {
    return app.getVersion();
});

ipcMain.handle('save-config', async (event, newConfig) => {
    try {
        const envPath = path.join(getStoragePath(), '.env');
        let content = "";

        if (fs.existsSync(envPath)) {
            content = fs.readFileSync(envPath, 'utf8');
        } else if (fs.existsSync(path.join(__dirname, '.env'))) {
            content = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
        }

        const lines = content.split('\n');
        const updatedLines = [];
        const seenKeys = new Set();

        // Update existing keys
        lines.forEach(line => {
            const match = line.match(/^([^#=]+)=/);
            if (match) {
                const key = match[1].trim();
                if (newConfig[key] !== undefined) {
                    updatedLines.push(`${key}=${newConfig[key]}`);
                    seenKeys.add(key);
                } else {
                    updatedLines.push(line);
                }
            } else {
                updatedLines.push(line);
            }
        });

        // Add new keys
        Object.keys(newConfig).forEach(key => {
            if (!seenKeys.has(key)) {
                updatedLines.push(`${key}=${newConfig[key]}`);
            }
        });

        fs.writeFileSync(envPath, updatedLines.join('\n'));
        return { status: 'success' };
    } catch (e) {
        return { status: 'error', error: e.message };
    }
});

// Helper to get platform-specific python path
ipcMain.handle('read-analysis-report', async () => {
    try {
        const reportPath = path.join(getStoragePath(), 'data', 'processed', 'analysis_report.md');
        if (fs.existsSync(reportPath)) {
            return { status: 'success', content: fs.readFileSync(reportPath, 'utf8') };
        }
        return { status: 'error', error: 'Report file does not exist' };
    } catch (e) {
        return { status: 'error', error: e.message };
    }
});

function getPythonPath() {
    // 1. Determine the venv base path
    let venvPath;
    if (app.isPackaged) {
        // In production, venv is in the Resources folder
        venvPath = path.join(process.resourcesPath, 'venv');
    } else {
        // In development, venv is in the root directory
        venvPath = path.join(__dirname, 'venv');
    }

    // 2. Determine the executable path within the venv
    let pythonPath;
    if (process.platform === 'win32') {
        pythonPath = path.join(venvPath, 'Scripts', 'python.exe');
    } else {
        pythonPath = path.join(venvPath, 'bin', 'python3');
    }

    // 3. If venv exists at this path, use it
    if (fs.existsSync(pythonPath)) {
        console.log(`Using venv Python: ${pythonPath}`);
        return pythonPath;
    }

    // 4. Fallback to system Python if venv is missing
    console.log('Venv not found, searching for system Python...');
    if (process.platform === 'win32') return 'python';

    const possiblePaths = [
        '/opt/homebrew/bin/python3',
        '/usr/local/bin/python3',
        '/usr/bin/python3'
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) return p;
    }

    return 'python3';
}

// Helper to locate python scripts (unpacked in prod)
function getScriptPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'app.asar.unpacked', 'execution');
    }
    return path.join(__dirname, 'execution');
}

ipcMain.handle('run-ingest-vacancy', async (event, args) => {
    let options = {
        mode: 'text',
        pythonPath: getPythonPath(),
        scriptPath: getScriptPath(),
        cwd: getStoragePath()
    };
    return runPythonScriptStream('ingest_vacancy.py', options);
});

ipcMain.handle('run-ingest-candidate', async (event, args) => {
    let options = {
        mode: 'text',
        pythonPath: getPythonPath(),
        scriptPath: getScriptPath(),
        cwd: getStoragePath()
    };
    return runPythonScriptStream('ingest_candidate.py', options);
});

ipcMain.handle('run-generate', async (event, args) => {
    let options = {
        mode: 'text',
        pythonPath: getPythonPath(),
        scriptPath: getScriptPath(),
        cwd: getStoragePath()
    };
    return runPythonScriptStream('generate_application.py', options);
});

ipcMain.handle('run-analyze-match', async (event, args) => {
    let options = {
        mode: 'text',
        pythonPath: getPythonPath(),
        scriptPath: getScriptPath(),
        cwd: getStoragePath()
    };
    return runPythonScriptStream('analyze_match.py', options);
});
