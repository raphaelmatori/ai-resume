const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    ingestVacancy: () => ipcRenderer.invoke('run-ingest-vacancy'),
    ingestCandidate: () => ipcRenderer.invoke('run-ingest-candidate'),
    generateApplication: () => ipcRenderer.invoke('run-generate'),
    selectFiles: (options) => ipcRenderer.invoke('select-files', options),
    uploadFiles: (filePaths, type, textContent = null) => {
        console.log('Preload: Uploading:', { filePaths, type, hasText: !!textContent });
        return ipcRenderer.invoke('upload-files', { filePaths, type, textContent });
    },
    analyzeMatch: () => ipcRenderer.invoke('run-analyze-match'),
    readAnalysisReport: () => ipcRenderer.invoke('read-analysis-report'),
    openPath: (path) => ipcRenderer.invoke('open-path', path),
    showInFolder: (path) => ipcRenderer.invoke('show-in-folder', path),
    clearAppData: () => ipcRenderer.invoke('clear-app-data'),
    onPythonLog: (callback) => ipcRenderer.on('python-log', (event, data) => callback(data)),
    deleteFile: (path) => ipcRenderer.invoke('delete-file', path),
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    getAppVersion: () => ipcRenderer.invoke('get-app-version')
});
