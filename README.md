# VIRTELON COMMAND CENTRE

> Internal AI-powered **Lead Intelligence & Business Operations** platform for **Virtelon Pvt. Ltd.** — a 3-founder software agency.
> This is an internal tool, not a public/commercial SaaS. Operating cost target: **$0** (no paid APIs).

---

## 1. What this product is

A single command centre that runs Virtelon's entire client-acquisition workflow:

```
FIND LEADS → QUALIFY → RESEARCH → UNDERSTAND PAIN → RECOMMEND SOLUTION
→ GENERATE PITCH → OUTREACH → FOLLOW-UP → MEETING → PROPOSAL → CLIENT → PROJECT
```

Founders: **Shubham Raj, Sanskar Mishra, Vijayant Priyadarshi**.

Two lead tracks it is designed for:
1. **Small/mid businesses** (restaurants, cafes, clinics, salons…) → websites, apps, chatbots, automation.
2. **High-value B2B** (manufacturers, logistics, construction, healthcare groups…) → CRM, ERP, HRMS, dashboards, internal platforms.

---

## 2. Tech stack & architecture

| Layer | Tech |
|-------|------|
| Frontend | React 19, React Router, Tailwind CSS, shadcn/ui, recharts, lucide-react, sonner |
| Backend | FastAPI (Python), Motor (async MongoDB) |
| Database | MongoDB |
| Auth | JWT (bcrypt password hashing), Bearer token in `localStorage` (`vc_token`) |
| AI | Claude **Sonnet 4.6** via Emergent LLM key (`emergentintegrations`) |
| Lead discovery | **OpenStreetMap Nominatim** (free, no key) |
| Web research | Server-side `httpx` + `BeautifulSoup` + free DuckDuckGo (`ddgs`) |

### Runtime layout
- Backend runs on `0.0.0.0:8001` (supervisor-managed). **All routes are prefixed `/api`** (Kubernetes ingress routes `/api/*` to the backend).
- Frontend runs on `:3000`. It calls the backend via `process.env.REACT_APP_BACKEND_URL` + `/api`.
- Never hardcode URLs/secrets — everything comes from `.env`.

### Backend module map (`/app/backend`)
| File | Responsibility |
|------|----------------|
| `server.py` | All FastAPI routes (auth, leads, research, outreach, campaigns, clients, projects, tasks, docs, dashboard, analytics, search, CSV, settings) |
| `database.py` | Mongo client + db handle (`MONGO_URL`, `DB_NAME`) |
| `models.py` | Pydantic request models; `new_id()` (uuid strings), `now_iso()` |
| `auth.py` | JWT create/verify, bcrypt hashing, `get_current_user`, `seed_founders()` |
| `ai_service.py` | **AI layer abstraction** — `research_lead`, `score_lead`, `generate_pitch`, `generate_followup`. Claude Sonnet 4.6 with a heuristic fallback that never crashes. |
| `providers.py` | **Lead-provider abstraction** — `OSMLeadProvider` (live, free), `MockLeadProvider` (fallback), `discover_leads()` selector, `provider_status()` |
| `web_research.py` | Public web research — `fetch_website_signals()`, `web_search()` (DDG), `gather_public_info()`. Includes SSRF guard. |
| `seed_data.py` | Idempotent DEMO data seeding (all flagged `is_demo=True`) |

### Data model (MongoDB collections)
`users`, `leads`, `lead_research`, `campaigns`, `clients`, `projects`, `tasks`, `activities`, `documents`, `messages`.
- All business entities use a string `id` (uuid4), **not** Mongo `_id` (queries always project `{_id: 0}` to stay JSON-serializable).
- Relationships are by id reference (e.g. `lead.campaign_id`, `project.client_id`, `task.related_id`). Leads are **not** one giant object — research lives in `lead_research`, messages in `messages`, activity in `activities`.

### Frontend map (`/app/frontend/src`)
- `App.js` — routes + protected layout. `context/AuthContext.jsx` — auth state.
- `lib/api.js` — axios instance (injects Bearer token), `inr()` currency, `formatApiError()`.
- `components/Layout.jsx` — sidebar nav + header + global search + quick actions.
- `components/shared.jsx` — `StageBadge`, `DemoBadge`, `ConvBadge`, `ScoreRing`, `PageHeader`, stage colors.
- `pages/` — `Dashboard`, `LeadFinder`, `AllLeads`, `LeadWorkspace`, `Research`, `Pipeline`, `Campaigns`, `CampaignDetail`, `Clients`, `Projects`, `ProjectDetail`, `Tasks`, `Team`, `Documents`, `Analytics`, `Settings`, `Login`.

---

## 3. The two "intelligence" pillars (how they actually work)

### A. Live Lead Discovery — `providers.py`
- `POST /api/leads/find` → `discover_leads(params)`.
- **`OSMLeadProvider`** queries `https://nominatim.openstreetmap.org/search` with `q="{category phrase} in {location}"`, `extratags=1`. It reads **real** public tags: name, website, phone, email, opening hours, Instagram/Facebook, address, and the OSM element URL (shown as the source).
- Lead score is computed **only from real evidence** (has website? phone? social? hours?). For a software agency, *no website* raises the opportunity score.
- If OSM is unavailable or returns nothing, it falls back to `MockLeadProvider`, whose output is **clearly flagged `is_demo=True`** and shown with a `DEMO` badge + amber "not live" banner.
- **Zero fabrication**: missing fields stay `None` and render as **"Not found"**.
- **Future upgrade**: add a new provider class (e.g. `GooglePlacesProvider`) implementing `find_leads()` and switch it in `discover_leads()` — no other code changes needed.

### B. Web Research — `web_research.py` + `ai_service.research_lead`
- `POST /api/leads/{id}/research`:
  1. `gather_public_info(lead)` fetches the prospect's **own public website** (httpx + BeautifulSoup) → verified facts: site reachable?, title, meta description, booking/contact form present, `tel:`/`mailto:` links, social links, tech hints. Plus a best-effort free **DuckDuckGo** search for public mentions.
  2. These **verified facts** are passed to Claude, which produces the assessment and must ground claims in them.
  3. Stored in `lead_research` with `report`, `verified_facts`, and a real `sources[]` list (only URLs actually observed).
- The UI shows a blue **"Verified Facts (fetched from public web)"** panel, visually separated from the **"AI Assessment (generated)"** — with an explicit "verify manually" warning and the engine name.
- **Zero fabrication**: contact details come only from real `tel:`/`mailto:`/tags. Missing → "Not found".

---

## 4. Local dev / operations

Services are supervisor-managed (do **not** run uvicorn/npm manually):
```bash
sudo supervisorctl restart backend     # after .env or dependency changes
sudo supervisorctl restart frontend
tail -n 100 /var/log/supervisor/backend.*.log   # debug
```
Install deps: backend `pip install X && pip freeze > requirements.txt`; frontend `yarn add X` (never npm).

### Environment variables
`backend/.env`: `MONGO_URL`, `DB_NAME` (do not change), `JWT_SECRET`, `EMERGENT_LLM_KEY`, `FOUNDER_PASSWORD`.
`frontend/.env`: `REACT_APP_BACKEND_URL` (do not change).
No paid-API keys are required. Optional future keys (e.g. `GOOGLE_PLACES_API_KEY`, `TAVILY_API_KEY`) can be added later.

### Login (seeded founders — see `/app/memory/test_credentials.md`)
`shubham@virtelon.com` / `Virtelon@2025` (also `sanskar@`, `vijayant@`).

---

## 5. Feature status — what's real vs. what needs keys

| Capability | Status | Cost | Notes |
|-----------|--------|------|-------|
| Auth (JWT, 3 founders) | Real | $0 | bcrypt + JWT |
| Dashboard / KPIs / charts | Real | $0 | live DB aggregates |
| **Live Lead Discovery** | **Real (live)** | **$0** | OpenStreetMap Nominatim; real businesses + real source URLs |
| **Web Research (website + public web)** | **Real (live)** | **$0** | httpx+BS4 site fetch + DuckDuckGo; verified facts separated from AI |
| AI research / scoring / outreach drafting | Real | included | Claude Sonnet 4.6 |
| Pipeline / Campaigns / Clients / Projects / Tasks / Docs | Real CRUD | $0 | MongoDB |
| CSV import / export | Real | $0 | round-trippable |
| Google Places discovery | Optional future | paid | provider abstraction ready; add key to enable |
| Send Email / WhatsApp | Placeholder | — | outreach is **generate-only** (copy & send manually); nothing auto-sends |
| Cloud storage for documents | Placeholder | — | documents are reference records for now |

**Zero fabrication guarantee:** the app never invents business names, phones, emails, websites, ratings, or social profiles. Unknown data shows **"Not found"**. Demo/sample data is always badged **DEMO**.

---

## 6. Roadmap / how to continue (for the next developer or AI)

Priority order agreed with the founders:
1. Live Lead Discovery — DONE (OSM, free)
2. Web Research Sources — DONE (free)
3. **One-click WhatsApp / Email outreach** — wire a sending provider (start with a free tier). Messages are already generated & stored in `messages`; add a `send` action + status. Keep the review-before-send safeguard.
4. **Team Roles** — `users.role` already exists (`founder`). Add `team_member` accounts + per-route permission checks; UI to invite/manage members.

Other easy upgrades (optional, some paid):
- Swap/augment discovery with Google Places (`GooglePlacesProvider`) once revenue justifies cost.
- Add Tavily/Serper for richer web-search evidence (`web_research.web_search`).
- Cloud storage (S3/GCS) for real document uploads.
- Calendar integration for meeting scheduling.

**Conventions to keep:** provider/AI abstractions (don't hardcode a vendor), `/api` route prefix, uuid string ids with `{_id:0}` projections, `data-testid` on interactive elements, DEMO badges on sample data, and the verified-vs-AI separation in research.
