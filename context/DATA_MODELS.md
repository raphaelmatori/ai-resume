# Data Models

## 1. Candidate Source
Represents a raw file uploaded by the user.

```json
{
  "id": "uuid4",
  "filename": "Resume_2024.pdf",
  "filepath": "/abs/path/to/Resume_2024.pdf",
  "hash": "sha256_checksum",
  "ingested_at": "ISO8601"
}
```

## 2. Normalized Candidate (Candidate_<ID>.md)
A structured Markdown file, but semantically backed by this schema.

```markdown
# Candidate Profile

## Experience
- **Senior Dev** at **Google** <!-- source_id: uuid_A -->
  - Built X using Y <!-- source_id: uuid_A -->
  - Increased revenue by Z <!-- source_id: uuid_A -->

## Skills
- Python <!-- source_id: uuid_B -->
- Leadership <!-- source_id: uuid_C -->
```

**Internal Representation (Intermediate JSON):**
```json
{
  "profile_id": "candidate_1",
  "facts": [
    {
      "type": "EXPERIENCE",
      "content": "Built X using Y",
      "source_file_id": "uuid_A",
      "metadata": { "company": "Google", "role": "Senior Dev" }
    }
  ]
}
```

## 3. Vacancy (Vacancy_<ID>.md)

```markdown
# Vacancy: Frontend Engineer

## Core Requirements
- React (Mastery)
- TypeScript (Required)

## Evaluation Criteria
- Must have experience with high-scale apps.
```

## 4. Tailored Application

```json
{
  "id": "app_1",
  "candidate_id": "candidate_1",
  "vacancy_id": "vacancy_1",
  "resume_path": "output/frontend_google_resume.docx",
  "cover_letter_path": "output/frontend_google_cl.docx",
  "generated_at": "ISO8601",
  "lineage": [
    { "section": "Summary", "derived_from": ["fact_1", "fact_5"] }
  ]
}
```

## 5. Suggestions (suggestions.txt)
Generated only if critical gaps exist.

```text
MISSING INFORMATION REPORT
--------------------------
VACANCY: Senior Architect
MISSING: Deep knowledge of Kubernetes

WHY IT MATTERS: The job description explicitly mentions "Kubernetes Architecture" 5 times. Your profile mentions "Docker" but not Kubernetes specifically.

ACTION: Please upload a document describing your Kubernetes usage, or detailed container orchestration experience.
```
