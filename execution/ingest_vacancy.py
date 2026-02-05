"""
Vacancy Distillation Agent (Stage 2)
------------------------------------
Scrapes job descriptions from URLs or local text files, distill requirements, 
and produces a normalized Markdown Job Profile.
"""
import os
import sys
# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from execution.utils import get_llm, ensure_directory, invoke_with_retry

# Configure logging to stdout
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
import re
import trafilatura
import requests

# Force flush of stdout
sys.stdout.reconfigure(line_buffering=True)
print(">>> Vacancy Ingestion Script Early Heartbeat", flush=True)

def fetch_url_content(url: str) -> str:
    """Fetches and extracts clean text from a URL with timeout."""
    try:
        logging.info(f"Fetching extra info from: {url}")
        # Use requests with timeout to prevent hanging
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            content = trafilatura.extract(response.text)
            if content:
                return f"\n--- Content from {url} ---\n{content}\n"
    except Exception as e:
        logging.warning(f"Failed to fetch {url}: {e}")
    return ""

def distill_vacancy(raw_text: str) -> str:
    """
    Transforms raw job description text into a structured Markdown profile.
    
    Args:
        raw_text: The initial job description text.
        
    Returns:
        markdown_profile: String containing structured Core Requirements and Nice-to-Haves.
    """
    # Detect URLs
    url_pattern = r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+[/\w\.-]*'
    urls = list(set(re.findall(url_pattern, raw_text)))
    
    extra_content = ""
    # Limit to first 3 URLs to avoid long delays
    for url in urls[:3]:
        # Avoid recursion or common social links if needed, but for now fetch all
        if any(domain in url for domain in ["linkedin.com/in", "github.com/", "twitter.com", "facebook.com", "instagram.com"]):
            continue
        content = fetch_url_content(url)
        if content:
            extra_content += content

    combined_text = raw_text + extra_content
    
    llm = get_llm(temperature=0.0)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a Senior Technical Recruiter.
Input: Job Description (may include content fetched from links).
Task: Identify the "Must Haves" vs "Nice to Haves".

Output Format (Markdown):
# Vacancy: [Role Title] - [Company Name]

## Core Requirements
- **[Skill/Tech]**: [Context from JD]
- ...

## Preferred Qualifications (Nice to Have)
- ...

## Responsibilities
- ...

## Cultural/Soft Skills
- ...

## Hidden Expectations (Inferred)
- [Inferred requirement, e.g., "High stress tolerance" based on "Fast-paced environment"]
"""),
        ("human", "{text}")
    ])
    
    chain = prompt | llm | StrOutputParser()
    
    logging.info("Distilling vacancy (expect delay if rate limited)...")
    return invoke_with_retry(chain, {"text": combined_text}, max_retries=10)

def process_vacancy(source_dir: str, output_path: str):
    ensure_directory(os.path.dirname(output_path))
    
    try:
        source_files = os.listdir(source_dir)
        raw_text = ""
        source_file_path = ""
        
        # Sort to prioritize .txt (likely the pasted content)
        source_files.sort(key=lambda x: 0 if x.endswith('.txt') else 1)

        for f in source_files:
            full_path = os.path.join(source_dir, f)
            if f.endswith(".txt"):
                with open(full_path, "r") as file:
                    raw_text = file.read()
                source_file_path = full_path
                break
            elif f.endswith(".pdf"):
                import pdfplumber
                with pdfplumber.open(full_path) as pdf:
                    for page in pdf.pages:
                        raw_text += (page.extract_text() or "") + "\n"
                source_file_path = full_path
                break
            
        if not raw_text.strip():
            logging.warning("No valid vacancy file found or file empty.")
            return

        logging.info(f"Processing vacancy from {source_file_path}...")
        markdown_output = distill_vacancy(raw_text)
        
        with open(output_path, "w") as f:
            f.write(markdown_output)
            
        logging.info(f"Vacancy processed to {output_path}")
            
    except Exception as e:
        logging.error(f"Error processing vacancy: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Use current working directory (important for packaged Electron app)
    BASE_DIR = os.getcwd()
    SOURCE_DIR = os.path.join(BASE_DIR, "sources", "vacancy")
    OUTPUT_FILE = os.path.join(BASE_DIR, "data", "processed", "vacancy_profile.md")
    
    process_vacancy(SOURCE_DIR, OUTPUT_FILE)
