"""Idempotent demo-data seeding. All records flagged is_demo=True and shown with a DEMO badge in the UI."""
import random
from datetime import datetime, timezone, timedelta
from database import db
from models import new_id, now_iso
from providers import MockLeadProvider


def _days(n):
    return (datetime.now(timezone.utc) + timedelta(days=n)).isoformat()


async def seed_demo_data():
    if await db.leads.count_documents({}) > 0:
        return

    founders = await db.users.find({"role": "founder"}, {"_id": 0}).to_list(10)
    if not founders:
        return
    fids = [f["id"] for f in founders]

    provider = MockLeadProvider()

    # ---------- Campaigns ----------
    campaign_defs = [
        ("Gurugram Restaurants — Website Campaign", "Restaurant", "Gurugram", "Conversion website + WhatsApp enquiry automation"),
        ("Delhi Clinics — Booking System", "Clinic", "Delhi", "Online appointment booking + patient CRM"),
        ("Manufacturing ERP Outreach", "Manufacturer", "Faridabad", "Custom ERP + inventory & production dashboards"),
        ("Logistics Ops Platform", "Logistics", "Gurugram", "Fleet & shipment tracking operations software"),
        ("Salon Chain Automation", "Salon", "Noida", "Multi-location booking app + loyalty automation"),
    ]
    campaigns = []
    for name, ind, loc, offer in campaign_defs:
        c = {
            "id": new_id(), "name": name, "industry": ind, "location": loc, "offer": offer,
            "start_date": _days(-random.randint(10, 40)), "end_date": _days(random.randint(20, 60)),
            "assigned_members": random.sample(fids, k=random.randint(1, 3)),
            "status": "Active", "is_demo": True, "created_at": now_iso(),
        }
        campaigns.append(c)
    await db.campaigns.insert_many([dict(c) for c in campaigns])

    # ---------- Leads ----------
    pipeline_stages = ["NEW", "RESEARCHING", "QUALIFIED", "PITCHED", "REPLIED",
                       "FOLLOW-UP", "MEETING", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]
    all_leads = []
    plans = [("Restaurant", "Gurugram", 8), ("Clinic", "Delhi", 5), ("Manufacturer", "Faridabad", 5),
             ("Logistics", "Gurugram", 4), ("Salon", "Noida", 4), ("Cafe", "Gurugram", 4)]
    for cat, loc, n in plans:
        batch = provider.find_leads({"category": cat, "location": loc, "count": n, "min_score": 55})
        all_leads.extend(batch)

    for i, lead in enumerate(all_leads):
        stage = random.choices(pipeline_stages, weights=[16, 10, 12, 10, 8, 8, 6, 5, 4, 5, 3])[0]
        lead["pipeline_status"] = stage
        lead["assigned_to"] = random.choice(fids) if random.random() > 0.2 else None
        matching = [c for c in campaigns if c["industry"] == lead["category"]]
        if matching and random.random() > 0.3:
            lead["campaign_id"] = matching[0]["id"]
        researched_stages = pipeline_stages[2:]
        if stage in researched_stages or random.random() > 0.6:
            lead["research_status"] = "Researched"
        if stage in ("PITCHED", "REPLIED", "FOLLOW-UP", "MEETING", "PROPOSAL", "NEGOTIATION", "WON", "LOST"):
            lead["last_contact"] = _days(-random.randint(1, 14))
        if stage in ("FOLLOW-UP", "REPLIED", "MEETING", "PROPOSAL", "NEGOTIATION"):
            lead["next_follow_up"] = _days(random.randint(-1, 5))
    await db.leads.insert_many([dict(l) for l in all_leads])

    # A few follow-ups due today
    today = datetime.now(timezone.utc).date().isoformat()
    for lead in random.sample(all_leads, k=min(4, len(all_leads))):
        await db.leads.update_one({"id": lead["id"]}, {"$set": {"next_follow_up": _days(0)}})

    # ---------- Clients ----------
    client_defs = [
        ("Rohit Malhotra", "Spice Route Hospitality", "Restaurant", "Active", 450000),
        ("Dr. Anjali Sharma", "CarePlus Clinic", "Healthcare", "Active", 320000),
        ("Vikram Singh", "NorthGear Manufacturing", "Manufacturer", "Prospect", 1800000),
        ("Priya Nair", "Glow Studio Salons", "Salon", "Completed", 260000),
        ("Aman Gupta", "SwiftMove Logistics", "Logistics", "Active", 950000),
    ]
    clients = []
    for name, comp, ind, status, val in client_defs:
        clients.append({
            "id": new_id(), "name": name, "company": comp, "industry": ind,
            "contact": name, "email": None, "phone": None, "source": "Referral" if random.random() > .5 else "Campaign",
            "deal_value": val, "status": status, "assigned_to": random.choice(fids),
            "notes": "Demo client record.", "is_demo": True, "created_at": now_iso(),
        })
    await db.clients.insert_many([dict(c) for c in clients])

    # ---------- Projects ----------
    proj_defs = [
        ("Spice Route Website + WhatsApp Bot", clients[0], 450000, "Development", ["React", "FastAPI", "WhatsApp API"]),
        ("CarePlus Booking & Patient CRM", clients[1], 320000, "Testing", ["React", "Node", "MongoDB"]),
        ("NorthGear ERP Platform", clients[2], 1800000, "Planning", ["Next.js", "PostgreSQL", "Python"]),
        ("Glow Studio Booking App", clients[3], 260000, "Completed", ["React Native", "Firebase"]),
        ("SwiftMove Fleet Dashboard", clients[4], 950000, "Design", ["React", "FastAPI", "Mapbox"]),
    ]
    for name, cl, val, status, tech in proj_defs:
        milestones = [
            {"id": new_id(), "title": "Discovery & Scope", "done": True},
            {"id": new_id(), "title": "UI/UX Design", "done": status not in ("Planning",)},
            {"id": new_id(), "title": "Development", "done": status in ("Testing", "Deployment", "Completed")},
            {"id": new_id(), "title": "Launch", "done": status == "Completed"},
        ]
        await db.projects.insert_one({
            "id": new_id(), "name": name, "client_id": cl["id"], "client_name": cl["company"],
            "value": val, "start_date": _days(-random.randint(20, 60)), "deadline": _days(random.randint(15, 90)),
            "status": status, "assigned_to": random.choice(fids), "team_members": random.sample(fids, k=2),
            "technology": tech, "milestones": milestones,
            "payment_status": random.choice(["Pending", "Partial", "Paid"]),
            "is_demo": True, "created_at": now_iso(),
        })

    # ---------- Tasks ----------
    task_titles = [
        "Follow up with Spice Route on proposal", "Prepare ERP demo for NorthGear",
        "Send CarePlus booking mockups", "Research 5 new logistics leads",
        "Draft WhatsApp outreach for Gurugram cafes", "Review Glow Studio final invoice",
        "Schedule meeting with SwiftMove ops team", "Qualify new restaurant leads batch",
        "Write proposal for manufacturing ERP", "Update pipeline statuses",
        "Design dashboard wireframes for fleet app", "Collect testimonials from completed clients",
        "Set up demo environment for clinic CRM", "Cold email 10 construction firms",
        "Prepare Q3 campaign report", "Refine lead scoring criteria",
        "Call back replied leads", "Send contract to NorthGear",
        "Audit weak-website restaurant leads", "Plan salon chain automation rollout",
    ]
    priorities = ["Low", "Medium", "High", "Critical"]
    statuses = ["Todo", "In Progress", "Done"]
    tasks = []
    for t in task_titles:
        tasks.append({
            "id": new_id(), "title": t, "assigned_to": random.choice(fids),
            "related_type": None, "related_id": None, "related_label": None,
            "priority": random.choices(priorities, weights=[3, 5, 4, 2])[0],
            "due_date": _days(random.randint(-2, 12)),
            "status": random.choices(statuses, weights=[5, 3, 3])[0],
            "is_demo": True, "created_at": now_iso(),
        })
    await db.tasks.insert_many(tasks)

    # ---------- Documents ----------
    docs = [
        ("NorthGear ERP Proposal.pdf", "Proposals"),
        ("Spice Route Contract.pdf", "Contracts"),
        ("CarePlus Requirements.docx", "Client documents"),
        ("Fleet Dashboard Spec.pdf", "Project documents"),
        ("Gurugram Restaurant Leads.csv", "Excel/CSV imports"),
    ]
    for name, cat in docs:
        await db.documents.insert_one({
            "id": new_id(), "name": name, "category": cat, "related_type": None,
            "related_label": None, "url": None, "note": "Demo reference document.",
            "is_demo": True, "created_at": now_iso(),
        })

    # ---------- Activity ----------
    await db.activities.insert_one({
        "id": new_id(), "type": "system", "text": "Demo data seeded for Virtelon Command Centre.",
        "actor": "System", "created_at": now_iso(),
    })
