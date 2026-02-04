/**
 * Renderer logic for Agentic Resume Builder
 * 
 * Handles multi-step navigation, file ingestion, 
 * progressive generation, and UI state management.
 */

// --- DOM Elements ---
const views = {
    1: document.getElementById('view-step-1'),
    2: document.getElementById('view-step-2'),
    3: document.getElementById('view-step-3'),
    4: document.getElementById('view-step-4')
};

// --- Initialize IPC Listeners Early ---
window.electronAPI.onPythonLog((data) => {
    console.log("Python Log Received:", data);
    log(data.message, data.isError);
});

const navSteps = {
    1: document.getElementById('step-nav-1'),
    2: document.getElementById('step-nav-2'),
    3: document.getElementById('step-nav-3'),
    4: document.getElementById('step-nav-4')
};

const elements = {
    fileList: document.getElementById('candidate-file-list'),
    toStep2Btn: document.getElementById('btn-to-step-2'),
    backTo1Btn: document.getElementById('btn-back-to-1'),
    vacancyText: document.getElementById('vacancy-text'),
    pasteBtn: document.getElementById('btn-paste'),
    generateBtn: document.getElementById('btn-generate-app'),
    backToEditBtn: document.getElementById('btn-back-to-gen'),
    restartBtn: document.getElementById('btn-restart'),
    resetAppBtn: document.getElementById('btn-reset-app'),
    statusLog: document.getElementById('status-log'),
    dropZone: document.getElementById('drop-zone'),
    dropIcon: document.getElementById('drop-icon'),
    configBtn: document.getElementById('btn-config'),
    configModal: document.getElementById('config-modal'),
    closeConfigBtn: document.getElementById('btn-close-config'),
    saveConfigBtn: document.getElementById('btn-save-config'),
    cancelConfigBtn: document.getElementById('btn-cancel-config'),
    inputs: {
        googleKey: document.getElementById('input-google-key'),
        openaiKey: document.getElementById('input-openai-key'),
        model: document.getElementById('select-model')
    },
    tasks: {
        candidate: document.getElementById('task-candidate'),
        vacancy: document.getElementById('task-vacancy'),
        logic: document.getElementById('task-logic'),
        resume: document.getElementById('task-resume'),
        coverletter: document.getElementById('task-coverletter')
    },
    appVersion: document.getElementById('app-version'),
    results: {
        previewResume: document.getElementById('btn-preview-resume'),
        downloadResume: document.getElementById('btn-download-resume'),
        previewCL: document.getElementById('btn-preview-cl'),
        downloadCL: document.getElementById('btn-download-cl')
    },
    analysis: {
        container: document.getElementById('analysis-container'),
        toResultsBtn: document.getElementById('btn-to-results'),
        backToGenBtn: document.getElementById('btn-back-to-gen')
    },
    nav: {
        step3Results: document.getElementById('step-3-results'),
        runAnalysisBtn: document.getElementById('btn-run-analysis'),
        backToAnalysisBtn: document.getElementById('btn-back-to-analysis')
    }
};

// --- App State ---
const state = {
    currentStep: 1,
    uploadedFiles: [], // [{ name, size, path }]
    isGenerating: false,
    isAnalyzing: false,
    analysisReport: null,
    config: {}
};

// --- Navigation Logic ---
function showStep(step) {
    // Hide all views
    Object.values(views).forEach(v => {
        if (v) v.classList.remove('active');
    });
    // Show target view
    if (views[step]) views[step].classList.add('active');

    // Update Stepper UI
    Object.keys(navSteps).forEach(s => {
        const stepNum = parseInt(s);
        const navEl = navSteps[s];

        // Remove active and clickable classes
        navEl.classList.remove('active', 'clickable');

        // Step is active if it's the current view
        if (stepNum === step) {
            navEl.classList.add('active');
        }

        // Make completed steps clickable (both before AND after current step)
        // Auto-complete previous steps
        if (stepNum < step) {
            navEl.classList.add('completed', 'clickable');
        } else if (navEl.classList.contains('completed')) {
            // Keep already completed steps as clickable even if they're ahead of current step
            navEl.classList.add('clickable');
        }
    });

    // Reset generation state when returning to Step 2
    // This ensures the Generate button is responsive after backward navigation
    if (step === 2 && state.isGenerating) {
        state.isGenerating = false;
    }

    state.currentStep = step;
}

function markStepCompleted(stepNum) {
    const navEl = navSteps[stepNum];
    if (navEl) navEl.classList.add('completed');
}

// --- Simple Markdown Renderer ---
function renderMarkdown(text) {
    if (!text) return "";

    // 1. Handle double newlines as paragraph breaks
    let html = text.trim();

    // 2. Headers
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');

    // 3. Bold
    html = html.replace(/\*\*(.*)\*\*/gim, '<b>$1</b>');

    // 4. Bullet Points (handle multi-line items by NOT consuming trailing newlines)
    // This allows the next step to treat newlines within items correctly if needed
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');

    // Wrap consecutive <li> in <ul>
    html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/gim, '');

    // 5. Line breaks for simple text (convert single \n to <br> if not inside other tags)
    // But better to just replace double \n with paragraphs first
    html = html.split('\n\n').map(p => {
        if (p.startsWith('<h') || p.startsWith('<ul')) return p;
        return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    return html;
}

// --- Logger Helper ---
function log(message, isError = false) {
    const timestamp = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.style.color = isError ? '#FF5555' : '#55FF55';
    line.textContent = `[${timestamp}] ${message}`;
    elements.statusLog.appendChild(line);
    elements.statusLog.scrollTop = elements.statusLog.scrollHeight;
}

// --- Task Helper ---
function setTaskStatus(taskId, status) {
    const el = elements.tasks[taskId];
    if (!el) return;

    el.classList.remove('active', 'completed');
    if (status === 'active') el.classList.add('active');
    if (status === 'completed') {
        el.classList.add('completed');
        const icon = el.querySelector('.task-status-icon');
        icon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    }
}

// --- Step 1: Candidate Ingestion ---
async function handleFileSelection() {
    log("Opening file picker...");
    const selection = await window.electronAPI.selectFiles({ multi: true, type: 'candidate' });

    if (selection.status === 'canceled') {
        log("Selection canceled.");
        return;
    }

    if (selection.status === 'success' && selection.filePaths.length > 0) {
        log(`Uploading ${selection.filePaths.length} files...`);
        const uploadResult = await window.electronAPI.uploadFiles(selection.filePaths, 'candidate');

        if (uploadResult.status === 'success') {
            const newFiles = uploadResult.files.map(f => ({
                name: f.name,
                size: (f.size / 1024).toFixed(1) + ' KB',
                path: f.path
            }));
            state.uploadedFiles = [...state.uploadedFiles, ...newFiles];
            updateFileList();
            elements.toStep2Btn.disabled = false;
            elements.dropIcon.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
            log("Upload complete.");
        } else {
            log("Upload failed: " + uploadResult.error, true);
        }
    }
}

function updateFileList() {
    elements.fileList.innerHTML = '';
    state.uploadedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <div class="file-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14.5 2 14.5 7 20 7"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="m9 9 1-1"/></svg>
            </div>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${file.size}</div>
            </div>
            <button class="btn-delete" title="Remove file" data-index="${index}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
        `;
        elements.fileList.appendChild(item);
    });

    // Add delete listeners
    elements.fileList.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const idx = btn.getAttribute('data-index');
            const file = state.uploadedFiles[idx];

            log(`Deleting file: ${file.name}...`);
            const delResult = await window.electronAPI.deleteFile(file.path);

            if (delResult.status === 'success') {
                state.uploadedFiles.splice(idx, 1);
                updateFileList();
                if (state.uploadedFiles.length === 0) {
                    elements.toStep2Btn.disabled = true;
                    elements.dropIcon.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
                }
                log("Deleted successfully.");
            } else {
                log("Delete failed: " + delResult.error, true);
            }
        });
    });
}

// Interaction
elements.dropZone.classList.add('clickable');
elements.dropZone.addEventListener('click', handleFileSelection);

elements.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.dropZone.classList.add('dragover');
});

elements.dropZone.addEventListener('dragleave', () => {
    elements.dropZone.classList.remove('dragover');
});

elements.dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    elements.dropZone.classList.remove('dragover');

    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (files.length === 0) {
        log("No valid PDF files dropped.", true);
        return;
    }

    const paths = files.map(f => f.path);
    log(`Dropped ${paths.length} files. Uploading...`);

    const uploadResult = await window.electronAPI.uploadFiles(paths, 'candidate');
    if (uploadResult.status === 'success') {
        const newFiles = uploadResult.files.map(f => ({
            name: f.name,
            size: (f.size / 1024).toFixed(1) + ' KB',
            path: f.path
        }));
        state.uploadedFiles = [...state.uploadedFiles, ...newFiles];
        updateFileList();
        elements.toStep2Btn.disabled = false;
        elements.dropIcon.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    }
});

// --- Configuration Logic ---
async function loadConfig() {
    state.config = await window.electronAPI.getConfig();
    elements.inputs.googleKey.value = state.config.GOOGLE_API_KEY || '';
    elements.inputs.openaiKey.value = state.config.OPENAI_API_KEY || '';
    elements.inputs.model.value = state.config.DEFAULT_MODEL || 'gemini-2.5-flash';

    // Load Version
    const version = await window.electronAPI.getAppVersion();
    if (elements.appVersion) elements.appVersion.textContent = version;
}

// Load on startup
loadConfig();

elements.configBtn.addEventListener('click', () => {
    loadConfig();
    elements.configModal.classList.add('active');
});

elements.closeConfigBtn.addEventListener('click', () => elements.configModal.classList.remove('active'));
elements.cancelConfigBtn.addEventListener('click', () => elements.configModal.classList.remove('active'));

elements.saveConfigBtn.addEventListener('click', async () => {
    const newConfig = {
        GOOGLE_API_KEY: elements.inputs.googleKey.value.trim(),
        OPENAI_API_KEY: elements.inputs.openaiKey.value.trim(),
        DEFAULT_MODEL: elements.inputs.model.value
    };

    log("Saving configuration...");
    const result = await window.electronAPI.saveConfig(newConfig);
    if (result.status === 'success') {
        elements.configModal.classList.remove('active');
        log("Changes saved to .env");
        alert("Configuration saved! Some changes may require an app restart.");
    } else {
        log("Save failed: " + result.error, true);
        alert("Error saving config: " + result.error);
    }
});

elements.toStep2Btn.addEventListener('click', () => showStep(2));

// Analysis Buttons
elements.analysis.backToGenBtn.addEventListener('click', () => showStep(3));

// Manual Logic for new navigation
elements.nav.runAnalysisBtn.addEventListener('click', runAnalysis);

async function runAnalysis() {
    if (state.isAnalyzing) return;

    showStep(4);

    // Use cached report if available
    if (state.analysisReport) {
        log("Restoring cached analysis report.");
        elements.analysis.container.innerHTML = renderMarkdown(state.analysisReport);
        markStepCompleted(4);
        return;
    }

    state.isAnalyzing = true;
    log("Analyzing match chances...");
    elements.analysis.container.innerHTML = `
        <div class="analysis-placeholder">
            <div class="spinner"></div>
            <p>Evaluating your profile against the job requirements...</p>
        </div>
    `;

    try {
        const analysisResult = await window.electronAPI.analyzeMatch();
        if (analysisResult.status === 'success') {
            log("Analysis complete.");
            const response = await window.electronAPI.readAnalysisReport();
            if (response.status === 'success') {
                state.analysisReport = response.content;
                elements.analysis.container.innerHTML = renderMarkdown(state.analysisReport);
                markStepCompleted(4);
            } else {
                throw new Error(response.error || "Could not read report file");
            }
        } else {
            log("Analysis failed: " + (analysisResult.error || "Unknown error"), true);
            elements.analysis.container.innerHTML = "<p class='error'>Analysis could not be completed at this time.</p>";
        }
    } catch (e) {
        log("Analysis crash: " + e.message, true);
        elements.analysis.container.innerHTML = `<p class='error'>Error: ${e.message}</p>`;
    } finally {
        state.isAnalyzing = false;
    }
}

// --- Step 2: Vacancy ---
elements.backTo1Btn.addEventListener('click', () => showStep(1));

elements.pasteBtn.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        elements.vacancyText.value = text;
        log("Text pasted from clipboard.");
    } catch (err) {
        log("Failed to paste: " + err, true);
    }
});

elements.generateBtn.addEventListener('click', startGenerationProcess);

// --- Task Helper ---
function resetTaskIcons() {
    Object.keys(elements.tasks).forEach(id => {
        const el = elements.tasks[id];
        el.classList.remove('active', 'completed');
        const icon = el.querySelector('.task-status-icon');
        icon.innerHTML = ''; // Clear progress/checkmark
    });
}

// --- Step 3: Progressive Generation ---
async function startGenerationProcess() {
    if (state.isGenerating) return;

    // Validate vacancy text
    if (!elements.vacancyText.value.trim()) {
        alert("Please paste a job description before generating.");
        showStep(2);
        return;
    }

    state.isGenerating = true;
    showStep(3);
    elements.statusLog.innerHTML = '';
    resetTaskIcons();

    try {
        // 1. Ingest Candidate
        setTaskStatus('candidate', 'active');
        log("Step 1: Ingesting Candidate Data...");
        const candResult = await window.electronAPI.ingestCandidate();
        if (candResult.status !== 'success') {
            throw new Error(candResult.error || "Candidate Ingestion failed");
        }
        log("Candidate Ingestion Success.");
        setTaskStatus('candidate', 'completed');

        // 2. Ingest Vacancy
        setTaskStatus('vacancy', 'active');
        log("Step 2: Saving Job Description...");
        await window.electronAPI.uploadFiles([], 'vacancy', elements.vacancyText.value);

        log("Analyzing vacancy (following links if found)...");
        const vacResult = await window.electronAPI.ingestVacancy();
        if (vacResult.status !== 'success') {
            throw new Error(vacResult.error || "Vacancy Analysis failed");
        }
        log("Vacancy Analysis Success.");
        setTaskStatus('vacancy', 'completed');

        // 3. Application Generation
        setTaskStatus('logic', 'active');
        log("Step 3: Generating tailored documents...");

        const genResult = await window.electronAPI.generateApplication();
        if (genResult.status !== 'success') {
            throw new Error(genResult.error || "Generation failed");
        }

        setTaskStatus('logic', 'completed');
        setTaskStatus('resume', 'completed');
        setTaskStatus('coverletter', 'completed');
        log("All documents generated successfully!");
        markStepCompleted(3);

        // Show results preview in Step 3
        elements.nav.step3Results.style.display = 'block';

    } catch (error) {
        log(`CRITICAL ERROR: ${error.message}`, true);
        state.isGenerating = false;

        // Find whichever task was active and show it failed (optional visual cue)
        const activeTask = document.querySelector('.task-item.active');
        if (activeTask) {
            activeTask.classList.remove('active');
            activeTask.style.color = 'var(--danger)';
        }

        alert(`Generation Stopped: ${error.message}`);

        // Show back button or logs more prominently?
        const backBtn = document.createElement('button');
        backBtn.className = 'btn btn-secondary';
        backBtn.style.marginTop = '2rem';
        backBtn.textContent = 'Go Back to Edit';
        backBtn.onclick = () => {
            showStep(2);
            backBtn.remove();
        };
        elements.statusLog.after(backBtn);

    } finally {
        state.isGenerating = false;
    }
}

// --- Step 4: Final Actions ---
elements.results.previewResume.addEventListener('click', () => {
    window.electronAPI.openPath('output/Tailored_Resume.docx');
});

elements.results.downloadResume.addEventListener('click', () => {
    window.electronAPI.showInFolder('output/Tailored_Resume.docx');
});

elements.results.previewCL.addEventListener('click', () => {
    window.electronAPI.openPath('output/Tailored_CoverLetter.docx');
});

elements.results.downloadCL.addEventListener('click', () => {
    window.electronAPI.showInFolder('output/Tailored_CoverLetter.docx');
});

elements.backToEditBtn.addEventListener('click', () => showStep(3));

elements.restartBtn.addEventListener('click', () => {
    if (confirm("Reset current application and start a new one?")) {
        location.reload();
    }
});

elements.resetAppBtn.addEventListener('click', async () => {
    if (confirm("Are you sure you want to delete all local application data?")) {
        const result = await window.electronAPI.clearAppData();
        if (result.status === 'success') {
            location.reload();
        } else {
            alert("Error: " + result.error);
        }
    }
});

// --- Stepper Navigation Click Handlers ---
Object.keys(navSteps).forEach(stepKey => {
    const stepNum = parseInt(stepKey);
    const stepEl = navSteps[stepKey];

    stepEl.addEventListener('click', () => {
        // Only allow clicking on completed steps (previous steps)
        if (stepEl.classList.contains('clickable')) {
            showStep(stepNum);
        }
    });
});

// Initialize
showStep(1);
log("System ready.");
log("Switching to " + (navigator.platform.includes('Mac') ? 'macOS' : 'Windows') + " native file handlers.");
