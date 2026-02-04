---
description: Adapt Resume and Cover Letter (Stage 3)
---

# Adapt Application

**Goal**: Generate a specific Resume and Cover Letter for the vacancy.

**Inputs**:
- `data/processed/candidate_profile.md`
- `data/processed/vacancy_profile.md`

**Outputs**:
- `output/Resume_[Date].docx`
- `output/CoverLetter_[Date].docx`
- `output/suggestions.txt` (Conditional)

**Script**: `execution/generate_application.py`

**Process**:
1.  **Parallel Generation**:
    - **Resume Drafting**: Rewrite bullets using ONLY source facts. Enforce **Strict Consistency** with years of experience.
    - **Cover Letter Drafting**: narrative connection with professional greeting and signature.
    - Both run simultaneously using `ThreadPoolExecutor` for 2x speed.
2.  **Formatting**:
    - Convert JSON results to professional DOCX using `python-docx`.
    - Automatically strip `source_id` tags from final documents.
    - Apply standardized styling (Arial, centered headers, bulleted lists).
3.  **Cleanup**: Auto-remove intermediate artifacts on next run.
