# Architecture Design

## 1. System Overview
The application is a local-first Electron desktop app with a Python sidecar for heavy lifting (Execution Layer).

### Logic Components
1.  **Electron (Renderer + Main)**: 
    - Handles UI/UX.
    - Manages File System interactions (watching folders).
    - Orchestrates the Python sidecar.
2.  **Python Sidecar (Execution Layer)**: 
    - Deterministic logic for file parsing.
    - LLM Context Management.
    - Markdown generation.
    - Strict logic enforcement (traceability).
3.  **Local Storage**:
    - JSON-based DB or SQLite for metadata (file hashes, fact lineage).
    - File system for Markdown storage ("Normalized" data).

### Interaction Flow
1.  **User** drags PDF to Electron UI.
2.  **Electron** saves file to `sources/candidate/`.
3.  **Electron** calls `execution/ingest_candidate.py` (Stage 1).
4.  **Python Script** parses PDF, extracts facts, links to source ID, writes `Candidate_ID.md`.
5.  **Electron** refreshes view.

---

## 2. LLM Orchestration Strategy
To ensure **determinism** and **no hallucination**, we use a **Map-Reduce-Verify** approach, not a simple "chat" approach.

### Prompting Strategy: "Extract, Don't Invent"
We do not ask the LLM to "write a resume". We ask it to "Extract X from Y".

**Phase 1: Extraction (Stage 1)**
- **Role**: Data Entry Clerk (Strict).
- **Prompt**: "Extract work history. Return JSON. If date is missing, leave null. Do not infer."
- **Verification**: Python script validates JSON schema.

**Phase 2: Distillation (Stage 2)**
- **Role**: Senior Recruiter.
- **Prompt**: "Extract core requirements from this job description. Ignore fluff."

**Phase 3: Synthesis (Stage 3)**
- **Role**: Professional Editor.
- **Prompt**: "Map Candidate Skill X to Vacancy Requirement Y. Rewrite bullet point Z to highlight this match. strict_source: {quote from candidate doc}."

### Hallucination Resistance
1.  **Source-First Context**: The LLM context window ONLY contains verified extracted facts, not raw text (after Stage 1).
2.  **Citation Requirement**: Every generated bullet point must have a metadata comment `<!-- source_id: 123 -->` in the intermediate step.
3.  **Negative Constraints**: "Do not use adjectives not supported by evidence."

---

## 3. Key Technical Trade-offs

1.  **Electron + Python vs. Pure JS**:
    - *Decision*: **Electron + Python**.
    - *Why*: PDF parsing and unstructured text processing (NLP) libraries (LangChain/LlamaIndex ecosystem, unstructured, PyPDF2) are vastly superior in Python.
    - *Cost*: A larger installer (bundling Python) and IPC complexity.

2.  **Markdown as Database**:
    - *Decision*: **Yes**.
    - *Why*: User auditability. The user can open `Candidate.md` and see exactly what the AI thinks it knows.
    - *Cost*: Slower than SQLite for massive datasets (irrelevant here).

3.  **Strict State vs. History**:
    - *Decision*: **Strict State**.
    - *Why*: "removing a source file must remove dependent content". Complex to manage if we allow edits.
    - *Trade-off*: If a user manually edits `Candidate.md`, those edits might be overwritten if the source changes. We will mark generated files as "Read Only" or "Managed" to the user.

---

## 4. Update and Deletion Semantics (Traceability)

**The Dependency Graph:**
`SourceFile (PDF)` -> `ExtractedFact (JSON/Fragment)` -> `CandidateProfile (MD)` -> `TailoredResume (Doc)`

**Deletion Logic:**
1.  User deletes `Resume.pdf`.
2.  App deletes `SourceFile` entry.
3.  App triggers `rebuild_candidate_profile()`.
4.  `rebuild` filters all `ExtractedFacts` where `source_id == deleted_id`.
5.  `CandidateProfile` is regenerated without those facts.
6.  `TailoredResume` is marked "Out of Sync" or regenerated.

**Consistency Check:**
- On app startup, verify all `source_ids` in `CandidateProfile` exist in `SourceFiles`.
- If orphan found -> auto-prune.
