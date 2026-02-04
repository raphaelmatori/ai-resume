---
description: Process Candidate Source Files (Stage 1)
---

# Ingest Candidate Data

**Goal**: Convert raw candidate documents (PDF/DOCX) into a normalized `Candidate_Profile.md`.

**Inputs**:
- Directory of source files: `sources/candidate/`

**Outputs**:
- `data/processed/candidate_profile.md`
- `data/processed/candidate_facts.json` (Intermediate database)

**Script**: `execution/ingest_candidate.py`

**Process**:
1.  **Scan**: List all files in `sources/candidate/`.
2.  **Parse**: For each file:
    - Extract text (using `pdfplumber`).
    - **Heartbeat**: Print immediate heartbeat to stdout.
    - **LLM Call**: Extract facts using `gemini-2.5-flash` or `gpt-4o-mini`.
    - Tag each fact with `source_id` for traceability.
3.  **Merge**: Combine all facts into a single list.
4.  **Format**: Generate `candidate_profile.md` with grouped experience, skills, and education.
5.  **Audit Info**: Intermediate JSON saved per file for verification.
**Edge Cases**:
- File is an image scan -> Use OCR (Tesseract).
- File is encrypted -> Log error, skip.
- Duplicate facts -> Deduplicate based on content similarity.
