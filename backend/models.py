import uuid
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, EmailStr


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ---------- Auth ----------
class UserPublic(BaseModel):
    id: str
    name: str
    email: str
    role: str = "founder"
    initials: Optional[str] = None
    avatar: Optional[str] = None


class LoginInput(BaseModel):
    email: EmailStr
    password: str


# ---------- Lead ----------
class LeadFinderInput(BaseModel):
    category: str = "Restaurant"
    location: str = "Gurugram"
    count: int = 20
    target_market: str = "Small Business"
    min_score: int = 0
    website_status: str = "Any"          # Missing / Weak / Any
    business_size: str = "Any"
    project_type: str = "Website"


class LeadCreate(BaseModel):
    business_name: str
    category: str
    location: str
    website: Optional[str] = None
    website_status: str = "Unknown"
    phone: Optional[str] = None
    email: Optional[str] = None
    google_url: Optional[str] = None
    instagram_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    lead_score: int = 0
    conversion_score: str = "MEDIUM"
    digital_presence_score: int = 0
    business_size: str = "Small"
    research_status: str = "Not Researched"
    pipeline_status: str = "NEW"
    assigned_to: Optional[str] = None
    campaign_id: Optional[str] = None
    project_type: Optional[str] = None
    reason: Optional[str] = None
    next_follow_up: Optional[str] = None
    last_contact: Optional[str] = None
    notes: Optional[str] = None
    is_demo: bool = False


class LeadUpdate(BaseModel):
    business_name: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    website_status: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    google_url: Optional[str] = None
    instagram_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    lead_score: Optional[int] = None
    conversion_score: Optional[str] = None
    digital_presence_score: Optional[int] = None
    business_size: Optional[str] = None
    research_status: Optional[str] = None
    pipeline_status: Optional[str] = None
    assigned_to: Optional[str] = None
    campaign_id: Optional[str] = None
    project_type: Optional[str] = None
    next_follow_up: Optional[str] = None
    last_contact: Optional[str] = None
    notes: Optional[str] = None


# ---------- Campaign ----------
class CampaignCreate(BaseModel):
    name: str
    industry: str
    location: str
    offer: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    assigned_members: List[str] = []
    is_demo: bool = False


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    location: Optional[str] = None
    offer: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    assigned_members: Optional[List[str]] = None
    status: Optional[str] = None


# ---------- Client ----------
class ClientCreate(BaseModel):
    name: str
    company: str
    industry: str
    contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    deal_value: float = 0
    status: str = "Prospect"
    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    is_demo: bool = False


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    industry: Optional[str] = None
    contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    deal_value: Optional[float] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None


# ---------- Project ----------
class ProjectCreate(BaseModel):
    name: str
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    value: float = 0
    start_date: Optional[str] = None
    deadline: Optional[str] = None
    status: str = "Planning"
    assigned_to: Optional[str] = None
    team_members: List[str] = []
    technology: List[str] = []
    milestones: List[Dict[str, Any]] = []
    payment_status: str = "Pending"
    is_demo: bool = False


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    value: Optional[float] = None
    start_date: Optional[str] = None
    deadline: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    team_members: Optional[List[str]] = None
    technology: Optional[List[str]] = None
    milestones: Optional[List[Dict[str, Any]]] = None
    payment_status: Optional[str] = None


# ---------- Task ----------
class TaskCreate(BaseModel):
    title: str
    assigned_to: Optional[str] = None
    related_type: Optional[str] = None   # lead / client / project
    related_id: Optional[str] = None
    related_label: Optional[str] = None
    priority: str = "Medium"
    due_date: Optional[str] = None
    status: str = "Todo"
    is_demo: bool = False


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    assigned_to: Optional[str] = None
    related_type: Optional[str] = None
    related_id: Optional[str] = None
    related_label: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None


# ---------- Document ----------
class DocumentCreate(BaseModel):
    name: str
    category: str = "Other"
    related_type: Optional[str] = None
    related_label: Optional[str] = None
    url: Optional[str] = None
    note: Optional[str] = None
    is_demo: bool = False


# ---------- Outreach ----------
class OutreachInput(BaseModel):
    channel: str = "whatsapp"   # whatsapp / email / linkedin


class FollowUpCreate(BaseModel):
    lead_id: str
    date: str
    note: Optional[str] = None
    assigned_to: Optional[str] = None
