"""Generates VERTILON_COMMAND_CENTRE_USER_GUIDE.pdf at the repo root."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, ListFlowable,
                                ListItem, HRFlowable, PageBreak, Table, TableStyle)

OUT = "/app/VERTILON_COMMAND_CENTRE_USER_GUIDE.pdf"
ACCENT = colors.HexColor("#2563eb")
DARK = colors.HexColor("#0b0b0d")
GREY = colors.HexColor("#52525b")

ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Heading1"], fontName="Helvetica-Bold", fontSize=17,
                    textColor=DARK, spaceBefore=14, spaceAfter=6)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=12.5,
                    textColor=ACCENT, spaceBefore=10, spaceAfter=4)
BODY = ParagraphStyle("Body", parent=ss["BodyText"], fontName="Helvetica", fontSize=10.2,
                      leading=15, textColor=colors.HexColor("#1f2937"), spaceAfter=5)
SMALL = ParagraphStyle("Small", parent=BODY, fontSize=9, textColor=GREY)
TITLE = ParagraphStyle("Title", parent=ss["Title"], fontName="Helvetica-Bold", fontSize=26,
                       textColor=DARK, spaceAfter=4)
SUB = ParagraphStyle("Sub", parent=BODY, fontSize=12, textColor=ACCENT, spaceAfter=2)

story = []


def h1(t): story.append(Paragraph(t, H1))
def h2(t): story.append(Paragraph(t, H2))
def p(t): story.append(Paragraph(t, BODY))
def small(t): story.append(Paragraph(t, SMALL))
def sp(h=6): story.append(Spacer(1, h))
def rule(): story.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#e5e7eb"), spaceBefore=6, spaceAfter=8))
def bullets(items):
    story.append(ListFlowable([ListItem(Paragraph(i, BODY), leftIndent=8) for i in items],
                              bulletType="bullet", start="•", leftIndent=12, bulletColor=ACCENT))
    sp(4)


# ---------- Cover ----------
sp(120)
story.append(Paragraph("VIRTELON", TITLE))
story.append(Paragraph("COMMAND CENTRE", ParagraphStyle("c", parent=TITLE, fontSize=20, textColor=ACCENT)))
sp(8)
story.append(Paragraph("AI-Powered Lead Intelligence &amp; Business Operations Platform", SUB))
sp(4)
small("User Guide &amp; Developer Handoff  ·  Virtelon Pvt. Ltd. (internal use only)")
sp(20)
small("Founders: Shubham Raj · Sanskar Mishra · Vijayant Priyadarshi")
story.append(PageBreak())

# ---------- 1 ----------
h1("1. What is the Virtelon Command Centre?")
p("The Virtelon Command Centre is our internal operating system for winning and delivering software work. "
  "It runs the whole journey in one place:")
p("<b>Find Leads → Qualify → Research → Understand Pain → Recommend a Virtelon Solution → "
  "Generate a Pitch → Outreach → Follow-up → Meeting → Proposal → Client → Project.</b>")
p("It is <b>not</b> a public website and <b>not</b> a generic CRM. It is a lead-intelligence tool: it discovers "
  "real businesses from free public sources, researches them, and helps the three of us turn them into clients.")
p("<b>Zero fabrication:</b> the app never invents a business name, phone, email, website or rating. If something "
  "is not publicly available it clearly shows <b>“Not found”</b>. Sample records are always badged <b>DEMO</b>.")

# ---------- 2 ----------
h1("2. Dashboard Overview")
p("The Dashboard is your command view. At the top are ten KPI cards: Total Leads, New Leads, Qualified, Pitched, "
  "Follow-ups Due, Meetings, Active Clients, Active Projects, Pipeline Value and Won Revenue.")
bullets([
    "<b>Lead Pipeline</b> chart — how many leads sit in each stage.",
    "<b>Follow-ups Due</b> — leads that need a touch today; click one to open it.",
    "<b>Campaign Performance</b> — leads / qualified / pitched / won per campaign.",
    "<b>Recent Activity</b> — a live log of what the team has done.",
    "<b>Recently Researched</b> and <b>Active Projects</b> — quick jump-back cards.",
    "<b>Team Workload</b> — how many leads and projects each founder owns.",
])
p("Use the <b>+ Quick</b> button (top-right) for shortcuts: Find Leads, Research Lead, Create Campaign, "
  "Add Client, Add Project. The search bar finds any lead, client, project or campaign instantly.")

# ---------- 3 ----------
h1("3. Lead Finder — Discovering Real Businesses")
p("Open <b>Lead Finder</b> from the left menu. Set your search criteria and click <b>FIND LEADS</b>:")
bullets([
    "<b>Business Category</b> — e.g. Restaurant, Cafe, Clinic, Salon, Manufacturer, Logistics…",
    "<b>Location</b> — a real city or area, e.g. “Gurugram”.",
    "<b>Number of Leads</b> — how many results to try to return.",
    "<b>Target Market</b> — Small Business / Mid Market / Enterprise B2B.",
    "<b>Minimum Lead Score</b> — hide weaker prospects.",
    "<b>Website Status</b> — Any / Missing / Weak (Missing = strong web opportunity for us).",
    "<b>Business Size</b> and <b>Project Type</b> — context for the pitch.",
])
p("Each result card shows a <b>lead score</b>, conversion potential, whether a website/phone was found, and a "
  "<b>Source</b> link (OpenStreetMap or the open-web page it came from). Scores are calculated only from real "
  "evidence — for example, a business with no website scores higher because it is a better opportunity for us.")
p("If nothing can be verified, the app shows <b>“No verified live results found”</b> rather than filling the list "
  "with fake data. You can then click <b>Load Demo Data</b> to explore the product with clearly-marked samples.")

# ---------- 4 & 5 ----------
h1("4. Saving Leads")
p("Click <b>Save all to database</b> on the results page to store the prospects. They then appear under "
  "<b>All Leads</b>, where you can filter by category, stage, research status and conversion potential, and "
  "import/export CSV files (handy because we already keep lead spreadsheets).")

h1("5. Opening a Lead &amp; Running Research")
p("Click any lead (from All Leads, the Pipeline, or a card) to open its <b>research workspace</b>:")
bullets([
    "<b>Left</b> — the lead profile and a Contact panel (phone, email, website, LinkedIn, Instagram, Google). "
    "Missing items show “Not found”; use Copy / Open buttons on the ones that exist.",
    "<b>Centre</b> — the AI Research Report. Click <b>Run Research</b> to generate it.",
    "<b>Right</b> — Sources &amp; Evidence, quick Actions (stage, campaign, follow-up date) and Outreach.",
])
p("Research reads the prospect’s own public website and open-web mentions, then Claude AI writes a 14-part "
  "assessment: business overview, digital presence, website assessment, pain points, the software opportunity, "
  "the recommended Virtelon solution, a personalized pitch, and a follow-up recommendation.")

# ---------- 6 ----------
h1("6. Verified Facts vs. AI Analysis")
p("This is important. The workspace keeps the two clearly separate:")
bullets([
    "<b>Verified Facts</b> (blue panel) — things actually fetched from the public web: is the website reachable, "
    "its page title, booking/contact forms, phone/email links on the site, social links. These are evidence.",
    "<b>AI Assessment</b> (labelled “generated”) — Claude’s interpretation and recommendations, grounded in "
    "those facts. A warning reminds you: always verify important details manually before outreach.",
])
p("Nothing in the contact panel is invented; blanks stay as “Not found”.")

# ---------- 7 ----------
h1("7. Managing the Lead Pipeline")
p("The <b>Pipeline</b> is a Kanban board with stages: NEW, RESEARCHING, QUALIFIED, PITCHED, REPLIED, FOLLOW-UP, "
  "MEETING, PROPOSAL, NEGOTIATION, WON, LOST. <b>Drag a card</b> to a new column to update its status instantly. "
  "Each card shows the score, conversion level and next follow-up date.")

# ---------- 8 ----------
h1("8. Campaign Management")
p("Under <b>Campaigns</b>, group leads into focused pushes (e.g. “Gurugram Restaurants — Website Campaign”). "
  "Create a campaign with an industry, location and offer, then open it to see live stats — total, researched, "
  "qualified, pitched, replies, meetings, proposals, won and conversion rate — and add or remove leads.")

# ---------- 9 ----------
h1("9. Clients &amp; Projects")
p("<b>Clients</b> is our client database (company, contact, industry, deal value, status, assigned founder). "
  "<b>Projects</b> tracks delivery: value, deadline, status (Planning → Completed), technology, milestones and "
  "payment status. Open a project to tick off milestones and update its stage.")

# ---------- 10 ----------
h1("10. Tasks, Team, Documents &amp; Analytics")
bullets([
    "<b>Tasks</b> — a simple To-do / In Progress / Done board with priority, owner and due date.",
    "<b>Team</b> — each founder’s live workload (leads, open tasks, follow-ups, meetings, projects, wins). "
    "These numbers are real counts, not made up.",
    "<b>Documents</b> — a reference store (proposals, contracts, client/project docs, CSV imports).",
    "<b>Analytics</b> — leads by category and location, conversion mix, and the sales funnel.",
])

# ---------- 11 & 12 ----------
h1("11. Updating Lead Status After Pitching")
p("In the lead workspace, use <b>Outreach</b> to generate a WhatsApp, Email or LinkedIn message from the research. "
  "Review and edit it, click <b>Copy</b>, then send it yourself from your own account. When done, click "
  "<b>Mark Pitched</b> — the lead moves to the PITCHED stage and the last-contact date is recorded. "
  "<b>Nothing is ever sent automatically.</b>")

h1("12. Managing Follow-ups")
p("Set a <b>Next Follow-up</b> date on any lead (in the workspace Actions panel). Leads due today appear on the "
  "Dashboard under “Follow-ups Due”. Move replied leads to REPLIED / FOLLOW-UP / MEETING as the conversation "
  "progresses.")

# ---------- 13 ----------
h1("13. How Lead Discovery Works Today (Free)")
p("Right now discovery is 100% free and costs nothing to run:")
bullets([
    "<b>OpenStreetMap (Nominatim)</b> is searched first for real public businesses.",
    "<b>Open-web search (DuckDuckGo)</b> tops up when OpenStreetMap returns too few, verifying each candidate by "
    "checking its public website and location before showing it.",
    "Results are de-duplicated, and every LIVE result carries its <b>source URL</b>.",
])

# ---------- 14 ----------
h1("14. Future: Enabling Google Places (Optional, Paid)")
p("The app is already wired for Google Places API (New) but it is <b>switched off</b> — no Google key is used and "
  "no paid calls are made. Later, an admin/developer can enable it with a single setting:")
bullets([
    "Add <b>GOOGLE_PLACES_API_KEY</b> to the backend environment and restart.",
    "Lead Finder will then use Google Places first, and still fall back to the free sources automatically if "
    "Google is unavailable.",
    "To keep costs low, Google is only called when you click Find Leads, only minimal fields are requested, and "
    "detailed place info is fetched only when you open a specific lead. No rebuild is needed.",
])

# ---------- 15 ----------
h1("15. Security — Protecting Keys &amp; Passwords")
bullets([
    "<b>Never</b> put API keys, passwords or secrets into GitHub or share them in chat.",
    "Secrets live only in the server’s <b>.env</b> file, which is git-ignored. Use <b>.env.example</b> as the "
    "template (it contains no real values).",
    "The Google key stays on the server only — it is never exposed to the browser.",
    "Change the default founder password after first login for real use.",
])

# ---------- 16 ----------
h1("16. Troubleshooting")
bullets([
    "<b>“No verified live results found”</b> — try a broader location or a different category; some areas have "
    "little public data. Use Load Demo Data to explore.",
    "<b>Research seems thin</b> — the prospect may have no public website; that itself is a useful signal (an "
    "opportunity for us).",
    "<b>Can’t log in</b> — check the email/password; contact the developer to reset the founder password.",
    "<b>A page won’t load</b> — refresh; if it persists, the developer can restart the backend/frontend services.",
])

# ---------- 17 ----------
h1("17. Developer Handoff — Running &amp; Continuing the Project")
p("<b>Stack:</b> React + Tailwind/shadcn (frontend) · FastAPI + MongoDB (backend) · Claude Sonnet 4.6 via the "
  "Emergent LLM key · OpenStreetMap + DuckDuckGo for free discovery.")
h2("Run locally")
bullets([
    "Backend: create <b>backend/.env</b> from <b>backend/.env.example</b>, then <code>pip install -r "
    "backend/requirements.txt</code> and run the FastAPI app (uvicorn/supervisor) on port 8001. All routes are "
    "prefixed <b>/api</b>.",
    "Frontend: create <b>frontend/.env</b> from <b>frontend/.env.example</b> (set REACT_APP_BACKEND_URL), then "
    "<code>yarn install</code> and <code>yarn start</code> (port 3000). Use yarn, never npm.",
    "Database: MongoDB. Founder accounts and demo data seed automatically on first backend start.",
])
h2("Provider architecture (how discovery is pluggable)")
bullets([
    "All providers live in <b>backend/providers.py</b> and expose <code>find_leads(params)</code>.",
    "<b>discover_leads()</b> orchestrates them: Google Places (only if a key is set) → OpenStreetMap → open-web "
    "search, with de-duplication and graceful fallback.",
    "To enable Google later: set <b>GOOGLE_PLACES_API_KEY</b> and restart — no other change.",
    "To add a new source in future: create a class with <code>find_leads()</code> and include it in "
    "<code>discover_leads()</code>.",
])
h2("Where things are")
bullets([
    "AI logic: <b>backend/ai_service.py</b>. Public web research: <b>backend/web_research.py</b>.",
    "API routes: <b>backend/server.py</b>. Data models: <b>backend/models.py</b>.",
    "Frontend pages: <b>frontend/src/pages/</b>. Full architecture + setup: <b>README.md</b>.",
])
sp(8)
rule()
small("Virtelon Command Centre · Internal user guide. The application is zero-cost by default; Google Places is "
      "optional and disabled until a key is provided. Generated for the Virtelon founding team.")

doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm,
                        topMargin=18*mm, bottomMargin=16*mm,
                        title="Virtelon Command Centre — User Guide", author="Virtelon Pvt. Ltd.")
doc.build(story)
print("PDF written to", OUT)
