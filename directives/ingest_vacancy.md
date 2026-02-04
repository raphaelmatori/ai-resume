---
description: Process Job Vacancy (Stage 2)
---

# Ingest Vacancy

**Goal**: Convert a raw job description into `Vacancy_Profile.md`.

**Inputs**:
- Raw text or URL provided by user.
- Saved to `sources/vacancy/raw_vacancy.txt`.

**Outputs**:
- `data/processed/vacancy_profile.md`

**Script**: `execution/ingest_vacancy.py`

**Process**:
1.  **Read**: Load `raw_vacancy.txt` (pasted) or PDF job description.
2.  **Scrape**: (Optional) Detect links and fetch extra content using `requests` + `trafilatura` (5s timeout).
3.  **LLM Call**: "Distill" prompt with real-time heartbeat logs.
    - Identify: Role Title, Must Haves, Nice to Haves, Responsibilities.
4.  **Save**: Write to `data/processed/vacancy_profile.md`.
**Edge Cases**:
- Text is too short -> Warn user.
- Text is multiple jobs pasted together -> Ask LLM to split or identify primary role.
