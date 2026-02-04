"""
Match Analysis Agent (Stage 4)
------------------------------
Performs a comparative analysis between the Candidate Profile and Vacancy Profile.
Calculates a fit score and identifies strong matches vs potential gaps.
"""
import os
import sys
import logging
# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from execution.utils import get_llm, ensure_directory, invoke_with_retry

# Force flush of stdout
sys.stdout.reconfigure(line_buffering=True)
print(">>> Match Analysis Script Early Heartbeat", flush=True)

logging.info("Starting match analysis process...")

def analyze_match(candidate_text: str, vacancy_text: str) -> str:
    llm = get_llm(temperature=0.0)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an Expert Career Coach and ATS Specialist.
Task: Analyze how well the candidate's profile matches the job vacancy.

Output Format (Markdown):
# Match Analysis: [Score]/100

## 💎 Strong Matches
- ... (Why this candidate is a good fit)

## ⚠️ Potential Gaps / Weaknesses
- ... (What is missing or could be improved in the resume/experience)

## 🎯 Hiring Manager Summary
... (A 2-sentence pitch for this candidate)
"""),
        ("human", "Candidate Profile:\n{candidate}\n\nJob Vacancy:\n{vacancy}")
    ])
    
    chain = prompt | llm | StrOutputParser()
    logging.info("Analyzing match and calculating score...")
    return invoke_with_retry(chain, {"candidate": candidate_text, "vacancy": vacancy_text})

def main():
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    CANDIDATE_PATH = os.path.join(BASE_DIR, "data", "processed", "candidate_profile.md")
    VACANCY_PATH = os.path.join(BASE_DIR, "data", "processed", "vacancy_profile.md")
    OUTPUT_PATH = os.path.join(BASE_DIR, "data", "processed", "analysis_report.md")

    if not os.path.exists(CANDIDATE_PATH) or not os.path.exists(VACANCY_PATH):
        logging.error("Missing candidate or vacancy profiles. Run ingestion first.")
        sys.exit(1)

    with open(CANDIDATE_PATH, "r") as f:
        cand_text = f.read()
    with open(VACANCY_PATH, "r") as f:
        vac_text = f.read()

    report = analyze_match(cand_text, vac_text)
    
    ensure_directory(os.path.dirname(OUTPUT_PATH))
    with open(OUTPUT_PATH, "w") as f:
        f.write(report)
    
    logging.info(f"Analysis complete. Report saved to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
