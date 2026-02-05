"""
Candidate Ingestion Agent (Stage 1)
-----------------------------------
This script handles the extraction of raw text from candidate PDF resumes and 
atomizes that text into structured 'facts' (Experience, Skills, Education, Projects).
Every fact is tagged with a source_id to ensure traceability throughout the pipeline.
"""
import os
import sys
# Add project root to sys.path to allow imports from 'execution' package
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import logging
import hashlib
from typing import List, Dict
import pdfplumber
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from execution.utils import get_llm, ensure_directory, invoke_with_retry
from execution.models import CandidateFacts, ExperienceFact, SkillFact, EducationFact, ProjectFact, FactMetadata

# Configure logging to stdout so Electron can capture it
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

# Force flush of stdout
sys.stdout.reconfigure(line_buffering=True)
print(">>> Candidate Ingestion Script Early Heartbeat", flush=True)

logging.info("Starting candidate ingestion process...")

def calculate_file_hash(filepath: str) -> str:
    """Calculates SHA256 hash of a file."""
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def extract_text_from_pdf(filepath: str) -> str:
    """Extracts text from a PDF file."""
    text = ""
    try:
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        logging.error(f"Error reading PDF {filepath}: {e}")
        return ""
    return text

def extract_facts_from_text(text: str, source_id: str, filename: str) -> CandidateFacts:
    """
    Uses an LLM and JsonOutputParser to extract structured data from resume text.
    
    Args:
        text: The raw text extracted from the PDF.
        source_id: A unique hash identifier for the source file.
        filename: The original filename for logging purposes.
        
    Returns:
        candidate_facts: A Pydantic model containing atomized experiences, skills, etc.
    """
    llm = get_llm(temperature=0.0)
    parser = JsonOutputParser(pydantic_object=CandidateFacts)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a Data Extraction Engine. Extract structured entities (Personal Info, Professional Summary, Jobs, Skills, Education, Projects, Certifications) from the provided Resume text.\n"
                   "Rules:\n"
                   "1. COPY EXACT TEXT. Do not rewrite.\n"
                   "2. Extract the professional summary/objective if present.\n"
                   "3. Extract any certifications or professional qualifications.\n"
                   "4. Return raw JSON matching the schema.\n"
                   "{format_instructions}"),
        ("human", "{text}")
    ])
    
    chain = prompt | llm | parser
    
    try:
        logging.info(f"Extracting facts from {filename}...")
        result_dict = invoke_with_retry(chain, {"text": text, "format_instructions": parser.get_format_instructions()}, max_retries=10)
        
        # Construct CandidateFacts and inject metadata
        metadata = FactMetadata(source_file_id=source_id, original_text="Extracted via LLM")
        
        facts = CandidateFacts(
            full_name=result_dict.get("full_name"),
            email=result_dict.get("email"),
            phone=result_dict.get("phone"),
            linkedin=result_dict.get("linkedin"),
            location=result_dict.get("location"),
            professional_summary=result_dict.get("professional_summary"),
            certifications=result_dict.get("certifications", []),
            raw_text=text[:5000]  # Store first 5000 chars of raw text for auditability
        )

        for exp in result_dict.get("experiences", []):
            if "metadata" in exp: del exp["metadata"]
            facts.experiences.append(ExperienceFact(**exp, metadata=metadata))
            
        for skill in result_dict.get("skills", []):
             if "metadata" in skill: del skill["metadata"]
             facts.skills.append(SkillFact(**skill, metadata=metadata))
             
        for edu in result_dict.get("education", []):
             if "metadata" in edu: del edu["metadata"]
             facts.education.append(EducationFact(**edu, metadata=metadata))
             
        for proj in result_dict.get("projects", []):
             if "metadata" in proj: del proj["metadata"]
             facts.projects.append(ProjectFact(**proj, metadata=metadata))
             
        return facts
        
    except Exception as e:
        logging.error(f"LLM Extraction failed for {filename}: {e}")
        return CandidateFacts()

def save_markdown_profile(facts_list: List[CandidateFacts], output_path: str):
    """
    Aggregates facts from multiple sources and writes a Normalized Markdown profile.
    """
    # Peak for personal info (use the first one found or first non-empty)
    main_facts = next((f for f in facts_list if f.full_name), facts_list[0] if facts_list else None)

    with open(output_path, "w") as f:
        f.write("# Candidate Profile\n\n")
        
        if main_facts:
            f.write("## Personal Details\n")
            f.write(f"- **Name**: {main_facts.full_name}\n")
            f.write(f"- **Email**: {main_facts.email}\n")
            f.write(f"- **Phone**: {main_facts.phone}\n")
            f.write(f"- **LinkedIn**: {main_facts.linkedin}\n")
            f.write(f"- **Location**: {main_facts.location}\n\n")
            
            if main_facts.professional_summary:
                f.write("## Professional Summary\n")
                f.write(f"{main_facts.professional_summary}\n\n")

        f.write("## Experience\n")
        for facts in facts_list:
            for exp in facts.experiences:
                date_str = ""
                if exp.start_date:
                    date_str += f"{exp.start_date}"
                    if exp.end_date:
                        date_str += f" - {exp.end_date}"
                    else:
                        date_str += " - Present"
                
                f.write(f"- **{exp.role}** at **{exp.company}** ({date_str}) <!-- source_id: {exp.metadata.source_file_id} -->\n")
                f.write(f"  - {exp.description}\n")
        f.write("\n")

        f.write("## Skills\n")
        all_skills = []
        for facts in facts_list:
            for skill in facts.skills:
                all_skills.append(f"{skill.skill_name} <!-- source_id: {skill.metadata.source_file_id} -->")
        
        for skill_str in all_skills:
            f.write(f"- {skill_str}\n")
        f.write("\n")
        
        f.write("## Education\n")
        for facts in facts_list:
            for edu in facts.education:
                 f.write(f"- **{edu.degree}**, {edu.institution} <!-- source_id: {edu.metadata.source_file_id} -->\n")
        f.write("\n")
        
        # Add certifications section
        f.write("## Certifications\n")
        all_certs = set()
        for facts in facts_list:
            if facts.certifications:
                for cert in facts.certifications:
                    all_certs.add(cert)
        
        if all_certs:
            for cert in sorted(all_certs):
                f.write(f"- {cert}\n")
        else:
            f.write("- None listed\n")
        f.write("\n")
        
        f.write("## Projects\n")
        for facts in facts_list:
            for proj in facts.projects:
                f.write(f"- **{proj.name}**: {proj.description} <!-- source_id: {proj.metadata.source_file_id} -->\n")

def process_candidate_sources(source_dir: str, output_dir: str):
    """
    Main entry point for Stage 1.
    """
    ensure_directory(output_dir)
    source_files = [f for f in os.listdir(source_dir) if f.endswith(".pdf")] # Extend for docx later
    
    # VALIDATION: Check if any files exist
    abs_source_dir = os.path.abspath(source_dir)
    logging.info(f"Searching for PDFs in: {abs_source_dir}")
    source_files = [f for f in os.listdir(source_dir) if f.endswith(".pdf")]
    
    if not source_files:
        logging.error(f"❌ No PDF files found in {abs_source_dir}")
        logging.error("Current contents of directory: " + str(os.listdir(source_dir)))
        logging.error("Please upload PDF resume files using the UI or place them manually in sources/candidate/")
        sys.exit(1)
    
    logging.info(f"✓ Found {len(source_files)} PDF file(s): {source_files}")
    
    all_facts = []
    
    for filename in source_files:
        filepath = os.path.join(source_dir, filename)
        source_id = calculate_file_hash(filepath)[:8] # Use short hash as ID
        
        # 1. Extract Text
        raw_text = extract_text_from_pdf(filepath)
        if not raw_text:
            logging.error(f"Failed to extract text from {filename} or file is empty.")
            continue
        
        if len(raw_text.strip()) < 50:
            logging.warning(f"⚠ Very little text extracted from {filename} ({len(raw_text)} chars)")
            logging.warning("This PDF may be a scanned image. OCR would be required.")
            continue
            
        logging.info(f"✓ Extracted {len(raw_text)} chars from {filename}. Sample: {raw_text[:100]}...")

        # 2. Extract Facts
        facts = extract_facts_from_text(raw_text, source_id, filename)
        
        # VALIDATION: Check if any facts were extracted
        total_facts = (len(facts.experiences) + len(facts.skills) + 
                      len(facts.education) + len(facts.projects))
        
        if total_facts == 0:
            logging.warning(f"⚠ No facts extracted from {filename}!")
            logging.warning(f"LLM may have failed or PDF content is not resume-like.")
            logging.warning(f"Text preview: {raw_text[:300]}")
        else:
            logging.info(f"✓ Extracted {total_facts} total facts from {filename}")
            logging.info(f"  - {len(facts.experiences)} experiences")
            logging.info(f"  - {len(facts.skills)} skills")
            logging.info(f"  - {len(facts.education)} education entries")
            logging.info(f"  - {len(facts.projects)} projects")
        
        all_facts.append(facts)
        
        # Save intermediate JSON for debugging/auditability
        json_path = os.path.join(output_dir, f"facts_{source_id}.json")
        with open(json_path, "w") as f:
            f.write(facts.model_dump_json(indent=2))
            
    # 3. Merge and Save Markdown
    if not all_facts:
        logging.error("❌ No facts extracted from any files!")
        logging.error("Possible causes:")
        logging.error("  1. PDFs are scanned images (need OCR)")
        logging.error("  2. LLM API is failing (check API key and quota)")
        logging.error("  3. PDF content is not resume-like")
        sys.exit(1)
    
    # Check if all facts are empty
    total_all_facts = sum(
        len(f.experiences) + len(f.skills) + len(f.education) + len(f.projects)
        for f in all_facts
    )
    
    if total_all_facts == 0:
        logging.error("❌ All extracted facts are empty!")
        logging.error("Check the intermediate JSON files in data/processed/ for details")
        sys.exit(1)
    
    md_path = os.path.join(output_dir, "candidate_profile.md")
    save_markdown_profile(all_facts, md_path)
    logging.info(f"✅ Generated profile at {md_path} with {total_all_facts} total facts")

if __name__ == "__main__":
    # Use current working directory (important for packaged Electron app)
    BASE_DIR = os.getcwd()
    SOURCE_DIR = os.path.join(BASE_DIR, "sources", "candidate")
    OUTPUT_DIR = os.path.join(BASE_DIR, "data", "processed")
    
    process_candidate_sources(SOURCE_DIR, OUTPUT_DIR)
