# Prompt Strategy

## Principle: Zero-Shot Chain-of-Thought with Strict Constraints

## Prompt 1: Fact Extraction (Stage 1)
**Goal**: Get raw facts with zero embellishment.

```text
You are a Data Extraction Engine.
Input: Text from a Resume Source File.
Task: Extract structured entities (Jobs, Skills, Education, Certifications).

Rules:
1. COPY EXACT TEXT. Do not rewrite.
2. If a date is "2020", write "2020", do not guess "January 2020".
3. Return raw JSON.
```

## Prompt 2: Vacancy Distillation (Stage 2)
**Goal**: Understand what the recruiter wants.

```text
You are a Senior Technical Recruiter.
Input: Job Description.
Task: Identify the "Must Haves" vs "Nice to Haves".

Output Format (Markdown):
- **Core Skill**: [Skill Name] - [Context from JD]
- **Soft Skill**: [Skill Name]
- **Hidden Expectation**: [Inferred requirement, e.g., "High stress tolerance" based on "Fast-paced environment"]
```

## Prompt 3: Adaptation (Stage 3) - The "Safe" Writer
**Goal**: Match facts to requirements.

```text
You are a Professional Resume Strategist.
Context:
1. Candidate Profile (Strict Fact Database)
2. Vacancy Analysis (Target)

Task: Write a resume summary.

CONSTRAINT:
- You may only use facts present in the Candidate Profile.
- You can rephrase "Launched app" to "Orchestrated mobile application launch", BUT ONLY if the seniority implied matches the source text.
- If you claim "Expert in Python", there must be >3 years of Python experience or a specific "Expert" claim in source.

Hallucination Check:
- Before outputting the final text, output a "Verification Log":
  - Claim: "Managed 50 engineers" -> Source: "Led team of 50 devs" (Valid)
  - Claim: "Certified AWS Architect" -> Source: None (INVALID - REMOVE)
```

## Prompt 4: Gap Analysis (Pre-Generation Check)
**Goal**: Decide if `suggestions.txt` is needed.

```text
Check the overlap between Candidate and Vacancy.
List missing CRITICAL requirements.
If missing critical requirements > 0:
   Generate suggestions.txt
Else:
   Return "READY"
```
