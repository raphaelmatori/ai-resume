# Implementation Plan

This plan outlines the steps to build the Agentic Resume System.

## Phase 1: Infrastructure & Core Scripts (Execution Layer)
- [ ] **Setup Python Environment**
    - Create `requirements.txt` with `langchain`, `openai`, `pdfplumber`, `python-docx`, `pandas`.
    - Create `execution/utils.py` for shared logic (LLM wrapper, file helpers).

- [ ] **Stage 1: Candidate Ingestion**
    - Create `execution/ingest_candidate.py`
    - Implement PDF text extraction.
    - Implement LLM Fact Extraction Chain.
    - Implement JSON -> Markdown normalizer.

- [ ] **Stage 2: Vacancy Ingestion**
    - Create `execution/ingest_vacancy.py`
    - Implement Vacancy Distillation Chain.

- [ ] **Stage 3: Application Generation**
    - Create `execution/generate_application.py`
    - Implement Matching Logic.
    - Implement `python-docx` template engine.
    - Implement Traceability verification.

## Phase 2: Electron Application (UI Layer)
- [ ] **Scaffold Electron App**
    - using `electron-vite` or `nextron`.
    - Setup IPC bridges to call Python scripts.
- [ ] **UI Implementation**
    - File Dropzone (Candidate).
    - Text Area (Job Desc).
    - Results View (Markdown preview).
    - "Generate" Button & Progress State.

## Phase 3: Testing & Refinement
- [ ] Create Mock Resumes & Mock JDs.
- [ ] Test Traceability (delete source file -> check output).
- [ ] Refine Prompt Engineering for "No Hallucination".

## Immediate Next Steps
Run `npm init` or setup the Python environment first.
Given the User is an "Agent", we will start by building the **Execution Layer (Python)** as it is the independent core.
