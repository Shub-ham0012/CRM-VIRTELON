import io
import csv
import logging
from datetime import datetime, timezone, date
from typing import Optional

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware

from database import db, client
from models import (
    now_iso, new_id, LoginInput, LeadFinderInput, LeadCreate, LeadUpdate,
    CampaignCreate, CampaignUpdate, ClientCreate, ClientUpdate, ProjectCreate,
    ProjectUpdate, TaskCreate, TaskUpdate, DocumentCreate, OutreachInput, FollowUpCreate,
)
from auth import (
    seed_founders, verify_password, create_access_token, get_current_user,
)
from providers import ACTIVE_PROVIDER, provider_status
import ai_service
from seed_data import seed_demo_data

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("virtelon")

app = FastAPI(title="Virtelon Command Centre")
api = APIRouter(prefix="/api")

PIPELINE_STAGES = ["NEW", "RESEARCHING", "QUALIFIED", "PITCHED", "REPLIED",
                   "FOLLOW-UP", "MEETING", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]
CLEAN = {"_id": 0}


async def log_activity(text: str, actor: str = "System", type_: str = "action", ref: Optional[dict] = None):
    doc = {"id": new_id(), "type": type_, "text": text, "actor": actor, "created_at": now_iso()}
    if ref:
        doc.update(ref)
    await db.activities.insert_one(doc)


# ============================ AUTH ============================
@api.post("/auth/login")
async def login(body: LoginInput, response: Response):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    response.set_cookie("access_token", token, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")
    return {
        "access_token": token,
        "user": {k: user[k] for k in ("id", "name", "email", "role", "initials", "avatar")},
    }


@api.post("/auth/logout")
async def logout(response: Response, user=Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# ============================ USERS / TEAM ============================
@api.get("/users")
async def list_users(user=Depends(get_current_user)):
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(100)


@api.get("/team")
async def team(user=Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    out = []
    today = date.today().isoformat()
    for u in users:
        uid = u["id"]
        leads = await db.leads.count_documents({"assigned_to": uid})
        tasks_open = await db.tasks.count_documents({"assigned_to": uid, "status": {"$ne": "Done"}})
        followups = await db.leads.count_documents({"assigned_to": uid, "next_follow_up": {"$ne": None}})
        meetings = await db.leads.count_documents({"assigned_to": uid, "pipeline_status": "MEETING"})
        projects = await db.projects.count_documents({"assigned_to": uid})
        won = await db.leads.count_documents({"assigned_to": uid, "pipeline_status": "WON"})
        out.append({**u, "stats": {
            "leads": leads, "tasks_open": tasks_open, "followups": followups,
            "meetings": meetings, "projects": projects, "won": won,
        }})
    return out


# ============================ LEAD FINDER ============================
@api.post("/leads/find")
async def find_leads(body: LeadFinderInput, user=Depends(get_current_user)):
    results = ACTIVE_PROVIDER.find_leads(body.model_dump())
    return {"provider": provider_status(), "count": len(results), "results": results}


@api.post("/leads/import")
async def import_found_leads(payload: dict, user=Depends(get_current_user)):
    """Persist selected leads returned from the finder."""
    leads = payload.get("leads", [])
    inserted = 0
    for lead in leads:
        lead.pop("_id", None)
        existing = await db.leads.find_one({"business_name": lead.get("business_name"),
                                            "location": lead.get("location")})
        if existing:
            continue
        lead.setdefault("id", new_id())
        lead.setdefault("created_at", now_iso())
        lead["saved"] = True
        await db.leads.insert_one(dict(lead))
        inserted += 1
    await log_activity(f"Imported {inserted} lead(s) from Lead Finder", user["name"], "lead")
    return {"inserted": inserted}


# ============================ LEADS CRUD ============================
@api.get("/leads")
async def list_leads(
    user=Depends(get_current_user),
    q: Optional[str] = None, category: Optional[str] = None, location: Optional[str] = None,
    pipeline_status: Optional[str] = None, research_status: Optional[str] = None,
    website_status: Optional[str] = None, campaign_id: Optional[str] = None,
    assigned_to: Optional[str] = None, min_score: Optional[int] = None,
    conversion_score: Optional[str] = None, project_type: Optional[str] = None,
):
    query: dict = {}
    if q:
        query["business_name"] = {"$regex": q, "$options": "i"}
    for field, val in [("category", category), ("location", location),
                       ("pipeline_status", pipeline_status), ("research_status", research_status),
                       ("website_status", website_status), ("campaign_id", campaign_id),
                       ("assigned_to", assigned_to), ("conversion_score", conversion_score),
                       ("project_type", project_type)]:
        if val:
            query[field] = val
    if min_score:
        query["lead_score"] = {"$gte": int(min_score)}
    leads = await db.leads.find(query, CLEAN).sort("lead_score", -1).to_list(1000)
    return leads


@api.post("/leads")
async def create_lead(body: LeadCreate, user=Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = now_iso()
    doc["saved"] = True
    await db.leads.insert_one(dict(doc))
    await log_activity(f"Added lead {doc['business_name']}", user["name"], "lead")
    doc.pop("_id", None)
    return doc


@api.get("/leads/{lead_id}")
async def get_lead(lead_id: str, user=Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id}, CLEAN)
    if not lead:
        raise HTTPException(404, "Lead not found")
    research = await db.lead_research.find_one({"lead_id": lead_id}, CLEAN)
    messages = await db.messages.find({"lead_id": lead_id}, CLEAN).sort("created_at", -1).to_list(50)
    activities = await db.activities.find({"lead_id": lead_id}, CLEAN).sort("created_at", -1).to_list(50)
    return {"lead": lead, "research": research, "messages": messages, "activities": activities}


@api.patch("/leads/{lead_id}")
async def update_lead(lead_id: str, body: LeadUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No updates provided")
    res = await db.leads.update_one({"id": lead_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Lead not found")
    return await db.leads.find_one({"id": lead_id}, CLEAN)


@api.patch("/leads/{lead_id}/stage")
async def update_stage(lead_id: str, payload: dict, user=Depends(get_current_user)):
    stage = payload.get("pipeline_status")
    if stage not in PIPELINE_STAGES:
        raise HTTPException(400, "Invalid stage")
    lead = await db.leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(404, "Lead not found")
    await db.leads.update_one({"id": lead_id}, {"$set": {"pipeline_status": stage}})
    await log_activity(f"Moved {lead['business_name']} → {stage}", user["name"], "pipeline", {"lead_id": lead_id})
    return await db.leads.find_one({"id": lead_id}, CLEAN)


@api.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, user=Depends(get_current_user)):
    await db.leads.delete_one({"id": lead_id})
    await db.lead_research.delete_many({"lead_id": lead_id})
    return {"ok": True}


# ============================ AI: RESEARCH / SCORE / OUTREACH ============================
@api.post("/leads/{lead_id}/research")
async def research(lead_id: str, user=Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id}, CLEAN)
    if not lead:
        raise HTTPException(404, "Lead not found")
    report = await ai_service.research_lead(lead)
    doc = {
        "id": new_id(), "lead_id": lead_id, "report": report,
        "generated_by": report.get("generated_by", ai_service.MODEL_NAME),
        "sources": [
            {"label": "Business Website", "url": lead.get("website"), "verified": bool(lead.get("website"))},
            {"label": "Google Business Profile", "url": lead.get("google_url"), "verified": bool(lead.get("google_url"))},
            {"label": "Instagram", "url": lead.get("instagram_url"), "verified": bool(lead.get("instagram_url"))},
            {"label": "LinkedIn", "url": lead.get("linkedin_url"), "verified": bool(lead.get("linkedin_url"))},
        ],
        "created_at": now_iso(),
    }
    await db.lead_research.delete_many({"lead_id": lead_id})
    await db.lead_research.insert_one(dict(doc))
    update = {"research_status": "Researched"}
    if isinstance(report.get("lead_score"), int):
        update["lead_score"] = report["lead_score"]
    if report.get("conversion_potential"):
        update["conversion_score"] = report["conversion_potential"]
    if lead.get("pipeline_status") == "NEW":
        update["pipeline_status"] = "RESEARCHING"
    await db.leads.update_one({"id": lead_id}, {"$set": update})
    await log_activity(f"Researched {lead['business_name']}", user["name"], "research", {"lead_id": lead_id})
    doc.pop("_id", None)
    return doc


@api.post("/leads/{lead_id}/score")
async def score(lead_id: str, user=Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id}, CLEAN)
    if not lead:
        raise HTTPException(404, "Lead not found")
    result = await ai_service.score_lead(lead)
    update = {}
    for k in ("lead_score", "conversion_score", "digital_presence_score"):
        if result.get(k) is not None:
            update[k] = result[k]
    if update:
        await db.leads.update_one({"id": lead_id}, {"$set": update})
    return result


@api.post("/leads/{lead_id}/outreach")
async def outreach(lead_id: str, body: OutreachInput, user=Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id}, CLEAN)
    if not lead:
        raise HTTPException(404, "Lead not found")
    research_doc = await db.lead_research.find_one({"lead_id": lead_id}, CLEAN)
    report = research_doc["report"] if research_doc else {}
    channel = body.channel.lower()
    if channel == "followup":
        message = await ai_service.generate_followup(lead, report)
    else:
        message = await ai_service.generate_pitch(lead, report, channel)
    doc = {"id": new_id(), "lead_id": lead_id, "channel": channel, "content": message,
           "status": "draft", "created_at": now_iso(), "author": user["name"]}
    await db.messages.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api.post("/leads/{lead_id}/mark-pitched")
async def mark_pitched(lead_id: str, user=Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(404, "Lead not found")
    await db.leads.update_one({"id": lead_id}, {"$set": {
        "pipeline_status": "PITCHED", "last_contact": now_iso()}})
    await log_activity(f"Marked {lead['business_name']} as Pitched", user["name"], "pipeline", {"lead_id": lead_id})
    return await db.leads.find_one({"id": lead_id}, CLEAN)


# ============================ CAMPAIGNS ============================
async def _campaign_stats(cid: str) -> dict:
    leads = await db.leads.find({"campaign_id": cid}, CLEAN).to_list(1000)
    def cnt(*stages):
        return sum(1 for l in leads if l.get("pipeline_status") in stages)
    total = len(leads)
    researched = sum(1 for l in leads if l.get("research_status") == "Researched")
    won = cnt("WON")
    revenue = 0
    return {
        "total": total, "researched": researched, "qualified": cnt("QUALIFIED"),
        "pitched": cnt("PITCHED"), "replies": cnt("REPLIED"), "meetings": cnt("MEETING"),
        "proposals": cnt("PROPOSAL"), "won": won,
        "conversion_rate": round((won / total * 100), 1) if total else 0,
    }


@api.get("/campaigns")
async def list_campaigns(user=Depends(get_current_user)):
    camps = await db.campaigns.find({}, CLEAN).sort("created_at", -1).to_list(500)
    for c in camps:
        c["stats"] = await _campaign_stats(c["id"])
    return camps


@api.post("/campaigns")
async def create_campaign(body: CampaignCreate, user=Depends(get_current_user)):
    doc = body.model_dump()
    doc.update({"id": new_id(), "status": "Active", "created_at": now_iso()})
    await db.campaigns.insert_one(dict(doc))
    await log_activity(f"Created campaign {doc['name']}", user["name"], "campaign")
    doc.pop("_id", None)
    doc["stats"] = await _campaign_stats(doc["id"])
    return doc


@api.get("/campaigns/{cid}")
async def get_campaign(cid: str, user=Depends(get_current_user)):
    c = await db.campaigns.find_one({"id": cid}, CLEAN)
    if not c:
        raise HTTPException(404, "Campaign not found")
    c["stats"] = await _campaign_stats(cid)
    c["leads"] = await db.leads.find({"campaign_id": cid}, CLEAN).sort("lead_score", -1).to_list(1000)
    return c


@api.patch("/campaigns/{cid}")
async def update_campaign(cid: str, body: CampaignUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.campaigns.update_one({"id": cid}, {"$set": updates})
    return await db.campaigns.find_one({"id": cid}, CLEAN)


@api.delete("/campaigns/{cid}")
async def delete_campaign(cid: str, user=Depends(get_current_user)):
    await db.campaigns.delete_one({"id": cid})
    await db.leads.update_many({"campaign_id": cid}, {"$set": {"campaign_id": None}})
    return {"ok": True}


@api.post("/campaigns/{cid}/leads")
async def add_leads_to_campaign(cid: str, payload: dict, user=Depends(get_current_user)):
    ids = payload.get("lead_ids", [])
    await db.leads.update_many({"id": {"$in": ids}}, {"$set": {"campaign_id": cid}})
    return {"ok": True, "count": len(ids)}


@api.delete("/campaigns/{cid}/leads/{lead_id}")
async def remove_lead_from_campaign(cid: str, lead_id: str, user=Depends(get_current_user)):
    await db.leads.update_one({"id": lead_id, "campaign_id": cid}, {"$set": {"campaign_id": None}})
    return {"ok": True}


# ============================ CLIENTS ============================
@api.get("/clients")
async def list_clients(user=Depends(get_current_user)):
    return await db.clients.find({}, CLEAN).sort("created_at", -1).to_list(500)


@api.post("/clients")
async def create_client(body: ClientCreate, user=Depends(get_current_user)):
    doc = body.model_dump()
    doc.update({"id": new_id(), "created_at": now_iso()})
    await db.clients.insert_one(dict(doc))
    await log_activity(f"Added client {doc['company']}", user["name"], "client")
    doc.pop("_id", None)
    return doc


@api.get("/clients/{cid}")
async def get_client(cid: str, user=Depends(get_current_user)):
    c = await db.clients.find_one({"id": cid}, CLEAN)
    if not c:
        raise HTTPException(404, "Client not found")
    c["projects"] = await db.projects.find({"client_id": cid}, CLEAN).to_list(100)
    return c


@api.patch("/clients/{cid}")
async def update_client(cid: str, body: ClientUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.clients.update_one({"id": cid}, {"$set": updates})
    return await db.clients.find_one({"id": cid}, CLEAN)


@api.delete("/clients/{cid}")
async def delete_client(cid: str, user=Depends(get_current_user)):
    await db.clients.delete_one({"id": cid})
    return {"ok": True}


# ============================ PROJECTS ============================
@api.get("/projects")
async def list_projects(user=Depends(get_current_user)):
    return await db.projects.find({}, CLEAN).sort("created_at", -1).to_list(500)


@api.post("/projects")
async def create_project(body: ProjectCreate, user=Depends(get_current_user)):
    doc = body.model_dump()
    doc.update({"id": new_id(), "created_at": now_iso()})
    await db.projects.insert_one(dict(doc))
    await log_activity(f"Created project {doc['name']}", user["name"], "project")
    doc.pop("_id", None)
    return doc


@api.get("/projects/{pid}")
async def get_project(pid: str, user=Depends(get_current_user)):
    p = await db.projects.find_one({"id": pid}, CLEAN)
    if not p:
        raise HTTPException(404, "Project not found")
    p["tasks"] = await db.tasks.find({"related_type": "project", "related_id": pid}, CLEAN).to_list(200)
    return p


@api.patch("/projects/{pid}")
async def update_project(pid: str, body: ProjectUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.projects.update_one({"id": pid}, {"$set": updates})
    return await db.projects.find_one({"id": pid}, CLEAN)


@api.delete("/projects/{pid}")
async def delete_project(pid: str, user=Depends(get_current_user)):
    await db.projects.delete_one({"id": pid})
    return {"ok": True}


# ============================ TASKS ============================
@api.get("/tasks")
async def list_tasks(user=Depends(get_current_user), assigned_to: Optional[str] = None,
                     status: Optional[str] = None):
    query = {}
    if assigned_to:
        query["assigned_to"] = assigned_to
    if status:
        query["status"] = status
    return await db.tasks.find(query, CLEAN).sort("due_date", 1).to_list(500)


@api.post("/tasks")
async def create_task(body: TaskCreate, user=Depends(get_current_user)):
    doc = body.model_dump()
    doc.update({"id": new_id(), "created_at": now_iso()})
    await db.tasks.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api.patch("/tasks/{tid}")
async def update_task(tid: str, body: TaskUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.tasks.update_one({"id": tid}, {"$set": updates})
    return await db.tasks.find_one({"id": tid}, CLEAN)


@api.delete("/tasks/{tid}")
async def delete_task(tid: str, user=Depends(get_current_user)):
    await db.tasks.delete_one({"id": tid})
    return {"ok": True}


# ============================ DOCUMENTS ============================
@api.get("/documents")
async def list_documents(user=Depends(get_current_user)):
    return await db.documents.find({}, CLEAN).sort("created_at", -1).to_list(500)


@api.post("/documents")
async def create_document(body: DocumentCreate, user=Depends(get_current_user)):
    doc = body.model_dump()
    doc.update({"id": new_id(), "created_at": now_iso()})
    await db.documents.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api.delete("/documents/{did}")
async def delete_document(did: str, user=Depends(get_current_user)):
    await db.documents.delete_one({"id": did})
    return {"ok": True}


# ============================ ACTIVITIES ============================
@api.get("/activities")
async def list_activities(user=Depends(get_current_user), limit: int = 30):
    return await db.activities.find({}, CLEAN).sort("created_at", -1).to_list(limit)


# ============================ DASHBOARD ============================
@api.get("/dashboard")
async def dashboard(user=Depends(get_current_user)):
    leads = await db.leads.find({}, CLEAN).to_list(5000)
    clients = await db.clients.find({}, CLEAN).to_list(1000)
    projects = await db.projects.find({}, CLEAN).to_list(1000)
    today = date.today().isoformat()

    def lcount(stage):
        return sum(1 for l in leads if l.get("pipeline_status") == stage)

    followups_due = [l for l in leads if l.get("next_follow_up") and l["next_follow_up"][:10] <= today
                     and l.get("pipeline_status") not in ("WON", "LOST")]
    active_projects = [p for p in projects if p.get("status") not in ("Completed", "On Hold")]
    pipeline_value = sum(c.get("deal_value", 0) for c in clients if c.get("status") in ("Prospect", "Active"))
    won_revenue = sum(p.get("value", 0) for p in projects if p.get("status") == "Completed")

    pipeline_dist = [{"stage": s, "count": lcount(s)} for s in PIPELINE_STAGES]

    campaigns = await db.campaigns.find({}, CLEAN).to_list(100)
    camp_perf = []
    for c in campaigns[:6]:
        st = await _campaign_stats(c["id"])
        camp_perf.append({"name": c["name"], "total": st["total"], "qualified": st["qualified"],
                          "pitched": st["pitched"], "won": st["won"]})

    recent_research = sorted(
        [l for l in leads if l.get("research_status") == "Researched"],
        key=lambda x: x.get("created_at", ""), reverse=True)[:6]
    activities = await db.activities.find({}, CLEAN).sort("created_at", -1).to_list(8)

    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    workload = []
    for u in users:
        workload.append({
            "name": u["name"], "initials": u.get("initials"), "avatar": u.get("avatar"),
            "leads": sum(1 for l in leads if l.get("assigned_to") == u["id"]),
            "projects": sum(1 for p in projects if p.get("assigned_to") == u["id"]),
        })

    return {
        "kpis": {
            "total_leads": len(leads),
            "new_leads": lcount("NEW"),
            "qualified": lcount("QUALIFIED"),
            "pitched": lcount("PITCHED"),
            "followups_due": len(followups_due),
            "meetings": lcount("MEETING"),
            "active_clients": sum(1 for c in clients if c.get("status") == "Active"),
            "active_projects": len(active_projects),
            "pipeline_value": pipeline_value,
            "won_revenue": won_revenue,
        },
        "pipeline_dist": pipeline_dist,
        "campaign_performance": camp_perf,
        "followups_due": followups_due[:8],
        "recent_research": recent_research,
        "active_projects": active_projects[:6],
        "activities": activities,
        "workload": workload,
    }


@api.get("/analytics")
async def analytics(user=Depends(get_current_user)):
    leads = await db.leads.find({}, CLEAN).to_list(5000)
    projects = await db.projects.find({}, CLEAN).to_list(1000)
    clients = await db.clients.find({}, CLEAN).to_list(1000)

    by_category: dict = {}
    by_location: dict = {}
    by_conversion = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for l in leads:
        by_category[l.get("category", "Other")] = by_category.get(l.get("category", "Other"), 0) + 1
        by_location[l.get("location", "Other")] = by_location.get(l.get("location", "Other"), 0) + 1
        cs = l.get("conversion_score", "MEDIUM")
        by_conversion[cs] = by_conversion.get(cs, 0) + 1

    funnel_stages = ["NEW", "QUALIFIED", "PITCHED", "MEETING", "PROPOSAL", "WON"]
    funnel = [{"stage": s, "count": sum(1 for l in leads if l.get("pipeline_status") == s)} for s in funnel_stages]

    return {
        "by_category": [{"name": k, "value": v} for k, v in sorted(by_category.items(), key=lambda x: -x[1])],
        "by_location": [{"name": k, "value": v} for k, v in sorted(by_location.items(), key=lambda x: -x[1])],
        "by_conversion": [{"name": k, "value": v} for k, v in by_conversion.items()],
        "funnel": funnel,
        "totals": {
            "leads": len(leads),
            "clients": len(clients),
            "projects": len(projects),
            "pipeline_value": sum(c.get("deal_value", 0) for c in clients if c.get("status") in ("Prospect", "Active")),
            "won_revenue": sum(p.get("value", 0) for p in projects if p.get("status") == "Completed"),
        },
    }


# ============================ SEARCH ============================
@api.get("/search")
async def global_search(q: str, user=Depends(get_current_user)):
    if not q or len(q) < 2:
        return {"leads": [], "clients": [], "projects": [], "campaigns": []}
    rx = {"$regex": q, "$options": "i"}
    return {
        "leads": await db.leads.find({"business_name": rx}, CLEAN).limit(6).to_list(6),
        "clients": await db.clients.find({"$or": [{"company": rx}, {"name": rx}]}, CLEAN).limit(6).to_list(6),
        "projects": await db.projects.find({"name": rx}, CLEAN).limit(6).to_list(6),
        "campaigns": await db.campaigns.find({"name": rx}, CLEAN).limit(6).to_list(6),
    }


# ============================ CSV IMPORT / EXPORT ============================
CSV_FIELD_MAP = {
    "business name": "business_name", "business_name": "business_name", "business": "business_name",
    "name": "business_name", "company": "business_name",
    "category": "category", "industry": "category", "location": "location", "city": "location",
    "website": "website", "url": "website", "website_status": "website_status",
    "phone": "phone", "mobile": "phone", "email": "email",
    "instagram": "instagram_url", "instagram_url": "instagram_url",
    "linkedin": "linkedin_url", "linkedin_url": "linkedin_url",
    "google": "google_url", "google_url": "google_url",
    "score": "lead_score", "lead score": "lead_score", "lead_score": "lead_score",
    "status": "pipeline_status", "pipeline_status": "pipeline_status", "notes": "notes",
    "conversion_score": "conversion_score", "business_size": "business_size", "project_type": "project_type",
}


@api.post("/leads/import-csv")
async def import_csv(file: UploadFile = File(...), user=Depends(get_current_user)):
    raw = await file.read()
    text = raw.decode("utf-8-sig", errors="ignore")
    reader = csv.DictReader(io.StringIO(text))
    inserted = 0
    for row in reader:
        mapped: dict = {}
        for key, val in row.items():
            if key is None:
                continue
            target = CSV_FIELD_MAP.get(key.strip().lower())
            if target and val:
                mapped[target] = val.strip()
        if not mapped.get("business_name"):
            continue
        try:
            mapped["lead_score"] = int(float(mapped.get("lead_score", 0)))
        except (ValueError, TypeError):
            mapped["lead_score"] = 0
        doc = {
            "id": new_id(),
            "business_name": mapped.get("business_name"),
            "category": mapped.get("category", "Imported"),
            "location": mapped.get("location", "Unknown"),
            "website": mapped.get("website"),
            "website_status": "Good" if mapped.get("website") else "Missing",
            "phone": mapped.get("phone"), "email": mapped.get("email"),
            "google_url": mapped.get("google_url"), "instagram_url": mapped.get("instagram_url"),
            "linkedin_url": mapped.get("linkedin_url"),
            "lead_score": mapped.get("lead_score", 0),
            "conversion_score": "MEDIUM", "digital_presence_score": 0,
            "business_size": "Small", "research_status": "Not Researched",
            "pipeline_status": mapped.get("pipeline_status", "NEW") if mapped.get("pipeline_status") in PIPELINE_STAGES else "NEW",
            "assigned_to": None, "campaign_id": None, "project_type": None,
            "notes": mapped.get("notes"), "source": "csv-import", "is_demo": False,
            "saved": True, "created_at": now_iso(),
        }
        await db.leads.insert_one(dict(doc))
        inserted += 1
    await log_activity(f"Imported {inserted} lead(s) from CSV ({file.filename})", user["name"], "import")
    return {"inserted": inserted}


@api.get("/export/leads-csv")
async def export_csv(
    request: Request,
    category: Optional[str] = None, location: Optional[str] = None,
    pipeline_status: Optional[str] = None, campaign_id: Optional[str] = None,
    user=Depends(get_current_user),
):
    query = {}
    for f, v in [("category", category), ("location", location),
                 ("pipeline_status", pipeline_status), ("campaign_id", campaign_id)]:
        if v:
            query[f] = v
    leads = await db.leads.find(query, CLEAN).to_list(5000)
    cols = ["business_name", "category", "location", "website", "website_status",
            "phone", "email", "instagram_url", "linkedin_url", "google_url",
            "lead_score", "conversion_score", "business_size", "research_status",
            "pipeline_status", "project_type"]
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(cols)
    for l in leads:
        writer.writerow([l.get(c, "") for c in cols])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=virtelon_leads.csv"})


# ============================ SETTINGS / INTEGRATIONS ============================
@api.get("/settings/integrations")
async def integrations(user=Depends(get_current_user)):
    import os as _os
    return {
        "lead_provider": provider_status(),
        "integrations": [
            {"key": "google_places", "name": "Google Places / Maps", "category": "Lead Data",
             "connected": False, "note": "Add API key to enable live business discovery."},
            {"key": "search_api", "name": "Web Search API", "category": "Research",
             "connected": False, "note": "Enables live web research of prospects."},
            {"key": "llm", "name": "AI Engine (Claude Sonnet 4.6)", "category": "AI",
             "connected": bool(_os.environ.get("EMERGENT_LLM_KEY")),
             "note": "Powers research reports, scoring and outreach generation."},
            {"key": "email", "name": "Email Service", "category": "Outreach",
             "connected": False, "note": "Connect SendGrid/Resend to send emails."},
            {"key": "whatsapp", "name": "WhatsApp Business API", "category": "Outreach",
             "connected": False, "note": "Connect to send WhatsApp messages."},
            {"key": "calendar", "name": "Calendar", "category": "Meetings",
             "connected": False, "note": "Connect Google Calendar for meeting scheduling."},
            {"key": "storage", "name": "Cloud Storage", "category": "Documents",
             "connected": False, "note": "Connect S3/GCS for document uploads."},
            {"key": "github", "name": "GitHub", "category": "Projects",
             "connected": False, "note": "Link repositories to projects."},
        ],
    }


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.leads.create_index("pipeline_status")
    await db.leads.create_index("campaign_id")
    await seed_founders()
    await seed_demo_data()
    logger.info("Virtelon Command Centre ready.")


@app.on_event("shutdown")
async def shutdown():
    client.close()
