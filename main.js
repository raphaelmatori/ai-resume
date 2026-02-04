const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { PythonShell } = require('python-shell');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile('index.html');
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
            const dirs = [
                path.join(__dirname, 'sources/candidate'),
                path.join(__dirname, 'sources/vacancy'),
                path.join(__dirname, 'data/processed'),
                path.join(__dirname, 'output')
            ];

            for (const dir of dirs) {
                if (fs.existsSync(dir)) {
                    const files = fs.readdirSync(dir);
                    for (const file of files) {
                        try {
                            fs.unlinkSync(path.join(dir, file));
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
        const baseDir = path.join(__dirname, 'sources');
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
    const fullPath = path.join(__dirname, filePath);
    shell.openPath(fullPath);
    return { status: 'success' };
});

ipcMain.handle('show-in-folder', async (event, filePath) => {
    const fullPath = path.join(__dirname, filePath);
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
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return {};

    const content = fs.readFileSync(envPath, 'utf8');
    const config = {};
    content.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) config[key.trim()] = value.trim();
    });
    return config;
});

ipcMain.handle('get-app-version', async () => {
    return app.getVersion();
});

ipcMain.handle('save-config', async (event, newConfig) => {
    try {
        const envPath = path.join(__dirname, '.env');
        let content = "";
        if (fs.existsSync(envPath)) {
            content = fs.readFileSync(envPath, 'utf8');
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
        const reportPath = path.join(__dirname, 'data', 'processed', 'analysis_report.md');
        if (fs.existsSync(reportPath)) {
            return { status: 'success', content: fs.readFileSync(reportPath, 'utf8') };
        }
        return { status: 'error', error: 'Report file does not exist' };
    } catch (e) {
        return { status: 'error', error: e.message };
    }
});

function getPythonPath() {
    const venvPath = path.join(__dirname, 'venv');
    if (process.platform === 'win32') {
        return path.join(venvPath, 'Scripts', 'python.exe');
    }
    return path.join(venvPath, 'bin', 'python3');
}

ipcMain.handle('run-ingest-vacancy', async (event, args) => {
    let options = {
        mode: 'text',
        pythonPath: getPythonPath(),
        scriptPath: path.join(__dirname, 'execution'),
    };
    return runPythonScriptStream('ingest_vacancy.py', options);
});

ipcMain.handle('run-ingest-candidate', async (event, args) => {
    let options = {
        mode: 'text',
        pythonPath: getPythonPath(),
        scriptPath: path.join(__dirname, 'execution'),
    };
    return runPythonScriptStream('ingest_candidate.py', options);
});

ipcMain.handle('run-generate', async (event, args) => {
    let options = {
        mode: 'text',
        pythonPath: getPythonPath(),
        scriptPath: path.join(__dirname, 'execution'),
    };
    return runPythonScriptStream('generate_application.py', options);
});

ipcMain.handle('run-analyze-match', async (event, args) => {
    let options = {
        mode: 'text',
        pythonPath: getPythonPath(),
        scriptPath: path.join(__dirname, 'execution'),
    };
    return runPythonScriptStream('analyze_match.py', options);
});
