# Virtelon Command Centre — PRD

## Original Problem Statement
Internal AI-powered Lead Intelligence & Business Operations platform for Virtelon Pvt. Ltd. (3-founder software agency). Premium dark SaaS dashboard managing the workflow: FIND LEADS → QUALIFY → RESEARCH → UNDERSTAND PAIN → RECOMMEND SOLUTION → PITCH → OUTREACH → FOLLOW-UP → MEETING → PROPOSAL → CLIENT → PROJECT.

## User Choices
- AI: Emergent LLM key, **Claude Sonnet 4.6** for research reports, scoring, outreach generation
- Auth: Simple JWT email+password (3 founders seeded)
- Demo data badged **DEMO**
- Local/DB file handling for MVP (cloud storage later)

## Architecture
- **Backend**: FastAPI + MongoDB (motor). Modular: `models.py`, `auth.py` (JWT+bcrypt), `ai_service.py` (LLM abstraction w/ heuristic fallback), `providers.py` (MockLeadProvider abstraction, swappable for Google Places/Search API), `seed_data.py`, `server.py` (all /api routes). uuid string ids, `{_id:0}` projections.
- **Frontend**: React + Tailwind + shadcn/ui + recharts + lucide. Dark graphite theme, Outfit/Inter/JetBrains Mono. Bearer token in localStorage (`vc_token`).
- **Entities**: User, Lead, LeadResearch, Campaign, Client, Project, Task, Activity, Document, Message.

## Personas
- Founders (Shubham, Sanskar, Vijayant) — role `founder`, full access.
- Team members — role planned for restricted access later.

## Implemented (2026-06 — first build)
- JWT auth + 3 seeded founders; login UI with quick-fill
- Dashboard: 10 KPI cards, pipeline chart, campaign performance, follow-ups due, recent research, activity, team workload, active projects
- Lead Finder: mock provider search w/ full filter set, DEMO badges, "not live" warning, save-to-DB
- All Leads: filterable table, research/qualify/delete actions, CSV import + export (round-trippable)
- Lead Workspace: 3-column (profile+contact / AI 14-section research report / sources+actions+outreach). Real Claude research, WhatsApp/Email/LinkedIn message generation (review-before-send), mark pitched, stage + follow-up + campaign controls. Contact panel shows "Not verified" for missing data; never fabricates.
- Pipeline: 11-stage Kanban with drag-and-drop
- Campaigns: list w/ stats, create, detail w/ lead management
- Clients / Projects (w/ milestones detail) / Tasks (board) CRUD
- Team dashboard (live stats), Documents (categorized), Analytics (charts), Settings (integration status)
- Global search; ~30 leads / 5 campaigns / 5 clients / 5 projects / 20 tasks demo data (all DEMO-badged)

## What's live vs. needs API keys
- **LIVE**: AI research/scoring/outreach (Claude Sonnet 4.6 via Emergent key)
- **MOCK/placeholder** (needs keys in Settings): Google Places/Search lead discovery, web research sources, Email service, WhatsApp Business API, Calendar, Cloud storage, GitHub. All clearly labeled not-connected; mock lead data flagged is_demo + provider.live=false.

## Backlog (P1/P2)
- P1: Real Google Places / Search API provider; real web-research source scraping
- P1: Email + WhatsApp send integrations (currently generate-only)
- P2: Team-member role with restricted permissions; document cloud upload (S3/GCS); calendar/meeting scheduling; GitHub repo linking; activity history per-lead timeline UI
