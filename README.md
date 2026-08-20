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

### A. Live Lead Discovery — `providers.py` (free multi-source, Google-ready)
- `POST /api/leads/find` → `discover_leads(params)` runs a zero-cost multi-source strategy (and Google Places **first** when a key is configured — see §4):
  1. **`GooglePlacesProvider`** — used only if `GOOGLE_PLACES_API_KEY` is set (paid). Cost-minimised: explicit-search only, minimal field mask, Place Details fetched lazily on lead open, cached, no retries. Falls back automatically on any error.
  2. **`OSMLeadProvider`** — OpenStreetMap Nominatim POI search (`extratags=1`): real name, website, phone, email, socials, address + an `openstreetmap.org` **source URL**. Score from real evidence (no website ⇒ higher opportunity).
  3. **`DuckDuckGoLeadProvider`** — free open-web search **top-up** when the above return too few. Runs several query variants, filters out aggregators/directories/social/bot-check pages, keeps only results that mention the searched **location**, then **verifies each by fetching its public website** (must be reachable + non-listicle title). The search-result URL is the source.
  4. Results are **deduplicated** by domain and normalized name.
- Only **verified** results are shown as LIVE (each with a source URL). If nothing can be verified → **`no_results: true`** and the UI shows *"No verified live results found"* — it **never** fills the list with demo data.
- **DEMO data** is available only via the explicit **"Load Demo Data"** button → `POST /api/leads/find-demo` (`demo_leads()`), always `is_demo=true`.
- **Zero fabrication**: missing fields stay `None` → **"Not found"**.
- **Adding another source**: create a class with `find_leads()` and include it in `discover_leads()` — no other code changes.

### B. Web Research — `web_research.py` + `ai_service.research_lead`
- `POST /api/leads/{id}/research`:
  1. `gather_public_info(lead)` fetches the prospect's **own public website** (httpx + BeautifulSoup) → verified facts: site reachable?, title, meta description, booking/contact form present, `tel:`/`mailto:` links, social links, tech hints. Plus a best-effort free **DuckDuckGo** search for public mentions.
  2. These **verified facts** are passed to Claude, which produces the assessment and must ground claims in them.
  3. Stored in `lead_research` with `report`, `verified_facts`, and a real `sources[]` list (only URLs actually observed).
- The UI shows a blue **"Verified Facts (fetched from public web)"** panel, visually separated from the **"AI Assessment (generated)"** — with an explicit "verify manually" warning and the engine name.
- **Zero fabrication**: contact details come only from real `tel:`/`mailto:`/tags. Missing → "Not found".

---

## 4. Getting started (fresh clone)

```bash
git clone <repo-url> && cd <repo>

# 1) Backend
cd backend
cp .env.example .env            # then fill in real values (see below)
pip install -r requirements.txt
# run on port 8001 (all routes are under /api). In this platform supervisor runs it;
# standalone: uvicorn server:app --host 0.0.0.0 --port 8001

# 2) Frontend  (use yarn, never npm)
cd ../frontend
cp .env.example .env            # set REACT_APP_BACKEND_URL
yarn install
yarn start                      # port 3000
```
On first backend start, the 3 founder accounts and DEMO data seed automatically.
**MongoDB** is the only datastore — no manual migrations; collections/indexes are created on startup.

### Environment variables (see `backend/.env.example` and `frontend/.env.example`)
| Var | Where | Purpose |
|-----|-------|---------|
| `MONGO_URL` | backend | MongoDB connection string |
| `DB_NAME` | backend | database name |
| `CORS_ORIGINS` | backend | allowed API origins (`*` for internal) |
| `JWT_SECRET` | backend | signs JWT access tokens (use a long random value) |
| `FOUNDER_PASSWORD` | backend | password seeded for the 3 founders |
| `EMERGENT_LLM_KEY` | backend | Claude Sonnet 4.6 (research/scoring/outreach) |
| `GOOGLE_PLACES_API_KEY` | backend | **optional/paid.** Empty = free OSM/open-web only. Set to enable Google Places |
| `REACT_APP_BACKEND_URL` | frontend | base URL of the API (without `/api`) |

**Secrets are never committed** — `.env` is git-ignored; the tracked `.env.example` files hold only placeholders. The Google key stays server-side and is never sent to the browser.

### Enabling Google Places later (no rebuild)
1. In Google Cloud Console: create/select a project, enable billing, enable **Places API (New)**, create an **API key**.
2. Put it in `backend/.env`:  `GOOGLE_PLACES_API_KEY="your-key"`
3. Restart the backend (`sudo supervisorctl restart backend`).
That's it. `discover_leads()` now calls Google Places first and still falls back to the free providers automatically if Google errors or is unavailable. Cost is minimised: Google is called only on an explicit Find Leads click, only required fields are requested, and detailed Place info is fetched only when a specific lead is opened (results and details are cached, no auto-retries).

### Operations
Services are supervisor-managed (do **not** run uvicorn/npm manually):
```bash
sudo supervisorctl restart backend     # after .env or dependency changes
sudo supervisorctl restart frontend
tail -n 100 /var/log/supervisor/backend.*.log   # debug
```
Install deps: backend `pip install X && pip freeze > requirements.txt`; frontend `yarn add X`.

### Login (seeded founders — see `/app/memory/test_credentials.md`)
`shubham@virtelon.com` / `Virtelon@2025` (also `sanskar@`, `vijayant@`).

### User guide
A non-technical walkthrough for the founders is included as **`VERTILON_COMMAND_CENTRE_USER_GUIDE.pdf`** (regenerate with `python scripts/generate_user_guide.py`).

---

## 5. Feature status — what's real vs. what needs keys

| Capability | Status | Cost | Notes |
|-----------|--------|------|-------|
| Auth (JWT, 3 founders) | Real | $0 | bcrypt + JWT |
| Dashboard / KPIs / charts | Real | $0 | live DB aggregates |
| **Live Lead Discovery** | **Real (live)** | **$0** | Multi-source: OpenStreetMap Nominatim + free open-web (DuckDuckGo) top-up; verified results only, honest "no results" (never demo-fills); demo via explicit button |
| **Web Research (website + public web)** | **Real (live)** | **$0** | httpx+BS4 site fetch + DuckDuckGo; verified facts separated from AI |
| AI research / scoring / outreach drafting | Real | included | Claude Sonnet 4.6 |
| Pipeline / Campaigns / Clients / Projects / Tasks / Docs | Real CRUD | $0 | MongoDB |
| CSV import / export | Real | $0 | round-trippable |
| Google Places (New) discovery | **Wired · disabled** | paid (off) | Fully integrated behind the provider abstraction; inert until `GOOGLE_PLACES_API_KEY` is set, then used first with free fallback |
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
