# Deployment Guide — Virtelon Command Centre

How to deploy this repository to production **without** access to the original build conversation.
It documents the **actual** implementation only.

**Architecture (as built):**
- **Frontend** — React 19 (Create React App via **CRACO**), Tailwind/shadcn. Build output is a static `build/` folder. Calls the backend at `${REACT_APP_BACKEND_URL}/api`.
- **Backend** — Python 3.11 **FastAPI** app (`backend/server.py`, ASGI app object `app`), served by **uvicorn**. All routes are under `/api`. Auth is **JWT Bearer tokens** in `localStorage` (no cookies).
- **Database** — **MongoDB** (via `motor`/`pymongo`). Founder accounts + demo data seed automatically on first startup.
- **AI** — `emergentintegrations` (Claude Sonnet 4.6) using `EMERGENT_LLM_KEY`. Has a built-in heuristic fallback if the key/proxy is unavailable.
- **Lead discovery** — free OpenStreetMap + DuckDuckGo (no key). Google Places is wired but **off** until `GOOGLE_PLACES_API_KEY` is set.

**Recommended zero/low-cost hosting:**
- **Frontend → Vercel** (free Hobby tier) — CRA static build is a perfect fit.
- **Backend → Render / Railway / Fly.io** (free/low tier, long-running container). *Not Vercel serverless:* research calls can take 10–20 s and the process is a persistent ASGI server, which suits a container host, not short-lived serverless functions.
- **Database → MongoDB Atlas** free tier (M0).

---

## 1. Prerequisites

**Accounts:** GitHub, Vercel, a backend host (Render/Railway/Fly.io), MongoDB Atlas. Optional later: Google Cloud (for Places).

**Software (local):** Git, Node.js 20.x, Yarn 1.22.x (Classic — **never npm**), Python 3.11, and MongoDB (local) or an Atlas connection string.

**Environment variables** (full reference in §6; templates in `backend/.env.example`, `frontend/.env.example`):
- Backend (server-only): `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `JWT_SECRET`, `FOUNDER_PASSWORD`, `EMERGENT_LLM_KEY`, optional `GOOGLE_PLACES_API_KEY`.
- Frontend (public): `REACT_APP_BACKEND_URL`.

---

## 2. GitHub

```bash
git clone <your-repo-url>
cd <repo>

# Backend
cd backend
cp .env.example .env      # fill in real values
pip install -r requirements.txt \
  --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/   # needed for emergentintegrations
uvicorn server:app --host 0.0.0.0 --port 8001

# Frontend (new terminal)
cd ../frontend
cp .env.example .env      # set REACT_APP_BACKEND_URL=http://localhost:8001
yarn install
yarn start                # http://localhost:3000
```

**Production branch (optional but recommended):**
```bash
git checkout -b production
git push -u origin production
```
Point Vercel + the backend host at `main` (auto-deploy) or `production` (promote manually).

---

## 3. Frontend deployment — Vercel (primary)

The frontend is a standard CRA app, so Vercel is the recommended platform.

**Connect the repo:** Vercel → *New Project* → import this GitHub repo.

**Project settings:**
| Setting | Value |
|---|---|
| Framework Preset | **Create React App** |
| Root Directory | **`frontend`** |
| Install Command | `yarn install` |
| Build Command | `yarn build` |
| Output Directory | `build` |

**Environment Variables (Vercel → Settings → Environment Variables):**
| Key | Value | Notes |
|---|---|---|
| `REACT_APP_BACKEND_URL` | `https://<your-backend-host>` | Public backend URL **without** `/api`. Baked in at build time. |

> After changing `REACT_APP_BACKEND_URL` you must **redeploy** (CRA env vars are compiled into the build).

**Automatic deployments:** once connected, every push to the production branch triggers a Vercel build + deploy. PRs get preview URLs.

---

## 4. Backend deployment — Render (example; Railway/Fly.io equivalent)

FastAPI/uvicorn needs a long-running process, so deploy it as a **Web Service** (container), not serverless.

**Create service:** Render → *New* → *Web Service* → connect the repo.

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Runtime | Python 3.11 |
| Build Command | `pip install -r requirements.txt --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/` |
| Start Command | `uvicorn server:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/api/dashboard` (returns 401 unauth — service is up) or add your own |

> The app object is `app` in `backend/server.py`. It binds `0.0.0.0` and reads the port from the platform (`$PORT`). Do not hardcode 8001 in production.

**Environment variables (host dashboard, server-side only):** `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `FOUNDER_PASSWORD`, `EMERGENT_LLM_KEY`, `CORS_ORIGINS`, and (optional) `GOOGLE_PLACES_API_KEY`. **Never** put these in Vercel/frontend.

**CORS:** the app currently sets `allow_origins=["*"]` in `server.py`. This is safe here because auth uses **Bearer tokens (localStorage), not cookies**, so no credentialed cross-site requests are needed. To restrict it to your frontend domain, edit the `CORSMiddleware` block in `backend/server.py` (replace `["*"]` with your domain) and redeploy. (`CORS_ORIGINS` env exists for future use but is not currently read by the code.)

**How the frontend connects:** set the frontend's `REACT_APP_BACKEND_URL` to this service's public URL. The frontend then calls `${REACT_APP_BACKEND_URL}/api/...`.

---

## 5. Database — MongoDB Atlas

The app uses **MongoDB** only. No SQL, no separate object storage.

1. Create a free **M0** cluster on MongoDB Atlas.
2. Add a database user and allow your backend host's IPs (or `0.0.0.0/0` for simplicity on a locked-down internal tool).
3. Copy the **SRV connection string** into the backend env: `MONGO_URL="mongodb+srv://<user>:<pass>@.../"` and set `DB_NAME` (e.g. `virtelon_command_centre`).

**Migrations/seeding:** none required. On first startup the backend creates indexes and seeds the 3 founder accounts + DEMO data automatically (`seed_founders()` / `seed_demo_data()` in `server.py`). Seeding is **idempotent** — it only runs when the collections are empty. **Never commit credentials**; the connection string lives only in the host's env vars.

---

## 6. Environment variables

Templates live in `backend/.env.example` and `frontend/.env.example`. Real `.env` files are git-ignored.

**Server-only secrets (backend host):**
| Var | Purpose |
|---|---|
| `MONGO_URL` | MongoDB connection string (Atlas SRV in prod). |
| `DB_NAME` | Database name. |
| `JWT_SECRET` | Signs JWT access tokens. Use a long random value: `python -c "import secrets;print(secrets.token_hex(32))"`. |
| `FOUNDER_PASSWORD` | Seeded password for the 3 founder accounts. Change for real use. |
| `EMERGENT_LLM_KEY` | Claude Sonnet 4.6 for research/scoring/outreach. |
| `CORS_ORIGINS` | Reserved for future CORS restriction (see §4). |
| `GOOGLE_PLACES_API_KEY` | **Optional/paid.** Empty = free discovery. Set to enable Google Places (§7). |

**Frontend-safe (public, compiled into the build):**
| Var | Purpose |
|---|---|
| `REACT_APP_BACKEND_URL` | Base URL of the backend (no `/api`). This is public by design — put **no secrets** in `REACT_APP_*`. |

---

## 7. Google Places integration (enable later)

Google Places is **fully wired but disabled** until a key is present. To turn it on **without any code/architecture change**:

1. Google Cloud Console → create/select a project → enable **billing** → enable **Places API (New)** → create an **API key** (restrict it to the Places API).
2. Add it to the **backend host** env only: `GOOGLE_PLACES_API_KEY="your-key"`. **Never** add it to Vercel/frontend — it must stay server-side (the backend sends it as the `X-Goog-Api-Key` header; it is never exposed to the browser).
3. Restart/redeploy the backend.

`providers.discover_leads()` then uses Google Places **first**, and automatically **falls back** to the free OpenStreetMap + open-web providers on any error. Cost controls are built in: Google is called only on explicit *Find Leads*, with a minimal field mask, detailed Place lookups only when a lead is opened, response caching, and no auto-retries.

---

## 8. Custom domain

**Frontend (Vercel):** Project → *Settings → Domains* → add `app.yourdomain.com` (or apex). Configure DNS at your registrar:
- Subdomain → **CNAME** to `cname.vercel-dns.com`.
- Apex/root → Vercel's **A record** `76.76.21.21` (Vercel shows the exact records). HTTPS is automatic.

**Backend (Render/Railway/Fly):** add a custom domain (e.g. `api.yourdomain.com`) in the host's dashboard → create a **CNAME** to the host-provided target; TLS is issued automatically. Then set the frontend's `REACT_APP_BACKEND_URL=https://api.yourdomain.com` and redeploy the frontend.

---

## 9. Production checklist

- [ ] **GitHub** — repo pushed; `.env` files NOT committed; `.env.example` present.
- [ ] **Env vars** — set on Vercel (frontend) and backend host (secrets); `REACT_APP_BACKEND_URL` points at the live backend.
- [ ] **Database** — Atlas cluster up; `MONGO_URL`/`DB_NAME` set; network access allows the backend; founders/demo seeded on first boot.
- [ ] **Authentication** — strong random `JWT_SECRET`; `FOUNDER_PASSWORD` changed from default; test login works.
- [ ] **API integrations** — `EMERGENT_LLM_KEY` set (or accept heuristic fallback); Google key added only when you want paid discovery.
- [ ] **Build** — `yarn build` succeeds locally; backend `pip install` succeeds with the extra index URL.
- [ ] **Deployment** — Vercel build green; backend `/api` responds; frontend loads and can log in.
- [ ] **Domain** — custom domains resolve; frontend talks to backend.
- [ ] **HTTPS** — both frontend and backend served over HTTPS (mixed content will break API calls).
- [ ] **Testing** — login, Lead Finder (live results), open a lead + Run Research, pipeline drag, create client/project/task, CSV export.
- [ ] **Security** — CORS reviewed; no secrets in frontend/tracked files; Atlas user least-privilege.

---

## 10. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Frontend loads but every API call fails / CORS error | `REACT_APP_BACKEND_URL` wrong or not rebuilt; backend not on HTTPS; ensure it points at the backend **without** `/api`. Redeploy frontend after changing it. |
| `pip install` fails on `emergentintegrations` / `litellm` | Add `--extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/` to the build command. |
| Backend boots then exits | `MONGO_URL` unreachable (Atlas IP allowlist) or missing env var — the app fails fast on missing config. Check host logs. |
| 401 on every request | Missing/invalid `JWT_SECRET` between restarts (tokens signed with an old secret) — log in again after setting a stable secret. |
| Research is slow or times out | Website fetch + AI can take 10–20 s; ensure the backend is a long-running host (not serverless) and raise the platform request timeout. |
| "No verified live results found" | Expected when a category/location has no public data — try a broader location, or click *Load Demo Data*. Not a bug. |
| Login fails after redeploy | Confirm `FOUNDER_PASSWORD` unchanged, or reset it and restart (seeding re-hashes on change). |

---

## 11. Updating production

```
local change → yarn build / test locally
→ git commit → git push (production branch)
→ Vercel auto-builds the frontend; backend host auto-builds on push
→ verify: open the app, log in, run a Lead Finder search + one research
```
If you changed `REACT_APP_BACKEND_URL` or any backend env var, redeploy that side after saving the variable.

---

## 12. Rollback

- **Vercel (frontend):** Deployments tab → pick the last known-good deployment → **Promote to Production** (instant).
- **Backend host (Render/Railway/Fly):** redeploy the previous successful build/commit from the dashboard's deploy history, or:
  ```bash
  git revert <bad-commit>        # safe: keeps history
  git push                       # triggers a clean redeploy
  # or hard reset a branch (use with care):
  git reset --hard <good-commit> && git push --force
  ```
- **Database:** rollbacks are code-only; MongoDB data is not migrated by deploys. Use Atlas backups if data changes must be undone.

---

## 13. AI deployment guide (for a future AI agent)

Before changing any deployment config, **inspect the repo — do not assume**:
1. Read this file, `README.md`, `backend/.env.example`, `frontend/.env.example`.
2. Confirm frontend build: `frontend/package.json` → scripts (`build` = `craco build`) and framework (CRA/CRACO). Output is `build/`.
3. Confirm backend entrypoint: `backend/server.py` exposes ASGI `app`; routes are under `/api`; start with `uvicorn server:app`. Check `backend/requirements.txt` (note the `emergentintegrations` extra index URL and the `litellm` wheel).
4. Confirm datastore: only MongoDB (`MONGO_URL`/`DB_NAME`); seeding is automatic/idempotent in `server.py` — do **not** add migrations.
5. Confirm the frontend↔backend contract: frontend uses `process.env.REACT_APP_BACKEND_URL` + `/api`; auth is Bearer token in `localStorage`.
6. Check the provider abstraction in `backend/providers.py` (`discover_leads`, `google_enabled`) before touching discovery; keep it zero-cost unless `GOOGLE_PLACES_API_KEY` is intentionally set.
7. Never hardcode ports/URLs/secrets; never commit `.env`; keep any Google key server-side.
8. After deploying, verify: login → Lead Finder live results → open a lead → Run Research (verify facts vs AI separation) → pipeline drag → CSV export.
