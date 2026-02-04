from typing import List
from pydantic import BaseModel, Field

class ResumeSection(BaseModel):
    title: str = Field(description="Section title, e.g. 'Senior Fullstack Developer | Company | Dates'")
    content: List[str] = Field(description="List of bullet points. MUST include <!-- source_id: X --> at end of every item for audit.")

class ResumeContent(BaseModel):
    name: str = Field(description="Candidate's full name")
    role_title: str = Field(description="Professional title, e.g. 'Senior Software Engineer'")
    contact_info: List[str] = Field(description="List of contact details like Phone, Email, LinkedIn, Location")
    summary: str = Field(description="3-4 line professional summary tailored to the role. Include <!-- source_id: X --> for facts used.")
    skills_section: List[str] = Field(description="List of relevant skills. Include <!-- source_id: X --> for each.")
    experience_sections: List[ResumeSection] = Field(description="Work history entries, tailored.")
    education_section: List[str] = Field(description="Education history. Cite sources.")
    projects_section: List[str] = Field(description="Project highlights. Cite sources.")
    certifications_section: List[str] = Field(description="Certifications and awards. Cite sources.")

class CoverLetterContent(BaseModel):
    opening: str = Field(description="Short professional greeting (e.g. 'Dear Hiring Team at [Company],') followed by a 1-sentence opening.")
    body_paragraphs: List[str] = Field(description="1-2 concise paragraphs connecting candidate experience to job needs.")
    closing: str = Field(description="Short professional closing and call to action (WITHOUT the sign-off).")
    signature_name: str = Field(description="The professional sign-off and candidate's full name (e.g. 'Sincerely,\n\nJohn Doe').")
