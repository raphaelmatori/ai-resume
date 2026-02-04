from typing import List, Optional
from pydantic import BaseModel, Field

class FactMetadata(BaseModel):
    source_file_id: str
    page_number: Optional[int] = None
    original_text: Optional[str] = None # For auditing

class ExperienceFact(BaseModel):
    company: str
    role: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: str
    metadata: FactMetadata

class SkillFact(BaseModel):
    skill_name: str
    category: Optional[str] = None # e.g. "Language", "Framework"
    metadata: FactMetadata

class EducationFact(BaseModel):
    institution: str
    degree: str
    graduation_date: Optional[str] = None
    metadata: FactMetadata

class ProjectFact(BaseModel):
    name: str
    description: str
    technologies: List[str] = []
    metadata: FactMetadata

class CandidateFacts(BaseModel):
    full_name: Optional[str] = Field(None, description="Candidate's full name")
    email: Optional[str] = Field(None, description="Contact email")
    phone: Optional[str] = Field(None, description="Phone number")
    linkedin: Optional[str] = Field(None, description="LinkedIn profile URL")
    location: Optional[str] = Field(None, description="Current location (City, Country)")
    experiences: List[ExperienceFact] = []
    skills: List[SkillFact] = []
    education: List[EducationFact] = []
    projects: List[ProjectFact] = []
