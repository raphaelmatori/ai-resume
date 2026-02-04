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
    - **Resume Drafting**: Rewrite bullets using ONLY source facts. 
      * **CRITICAL**: Preserve exact phrasing for all quantifiable facts (years of experience, percentages, user counts, dates)
      * DO NOT round, approximate, or rephrase numbers (e.g., "8+ years" stays "8+ years", NOT "over 8 years")
    - **Cover Letter Drafting**: Narrative connection with professional greeting and signature.
      * MUST use identical years of experience and quantifiable facts as in candidate profile
    - Both run simultaneously using `ThreadPoolExecutor` for 2x speed.
2.  **Formatting**:
    - Convert JSON results to professional DOCX using `python-docx`.
    - Automatically strip `source_id` tags from final documents.
    - Apply standardized styling (Arial, centered headers, bulleted lists).
    - Use proper paragraph spacing properties (no blank paragraphs in cover letter).
3.  **Cleanup**: Auto-remove intermediate artifacts on next run.
