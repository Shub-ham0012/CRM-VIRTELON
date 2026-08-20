"""
Backend tests for Virtelon Command Centre.
Covers: auth, dashboard, leads (finder, import, CRUD, research, outreach,
mark-pitched, stage, csv i/o), campaigns, clients, projects, tasks, team,
analytics, integrations, search.
"""
import io
import os
import json
import pytest
import requests
from tests.conftest import API


# ---------------------------- AUTH ----------------------------
class TestAuth:
    def test_login_success(self, api_client):
        r = api_client.post(f"{API}/auth/login",
                            json={"email": "shubham@virtelon.com", "password": "Virtelon@2025"})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == "shubham@virtelon.com"
        assert data["user"]["role"] == "founder"

    def test_login_bad_password(self, api_client):
        r = api_client.post(f"{API}/auth/login",
                            json={"email": "shubham@virtelon.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me_requires_auth(self, api_client):
        s = requests.Session()  # fresh, no header
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_authed(self, authed):
        r = authed.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == "shubham@virtelon.com"


# ---------------------------- DASHBOARD ----------------------------
class TestDashboard:
    def test_dashboard_shape(self, authed):
        r = authed.get(f"{API}/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ("kpis", "pipeline_dist", "campaign_performance", "followups_due",
                  "recent_research", "activities", "workload"):
            assert k in d, f"missing key {k}"
        assert d["kpis"]["total_leads"] >= 1
        assert isinstance(d["pipeline_dist"], list) and len(d["pipeline_dist"]) == 11
        assert isinstance(d["workload"], list) and len(d["workload"]) >= 3


# ---------------------------- LEADS ----------------------------
class TestLeads:
    def test_list_leads_seeded(self, authed):
        r = authed.get(f"{API}/leads")
        assert r.status_code == 200
        leads = r.json()
        assert isinstance(leads, list)
        assert len(leads) >= 20, f"expected ~30 seeded leads got {len(leads)}"
        assert "_id" not in leads[0]
        assert "id" in leads[0]

    def test_filter_by_category(self, authed):
        r = authed.get(f"{API}/leads", params={"category": "Restaurant"})
        assert r.status_code == 200
        for l in r.json():
            assert l["category"] == "Restaurant"

    def test_filter_by_pipeline_status(self, authed):
        r = authed.get(f"{API}/leads", params={"pipeline_status": "NEW"})
        assert r.status_code == 200
        for l in r.json():
            assert l["pipeline_status"] == "NEW"

    def test_filter_by_conversion(self, authed):
        r = authed.get(f"{API}/leads", params={"conversion_score": "HIGH"})
        assert r.status_code == 200
        for l in r.json():
            assert l["conversion_score"] == "HIGH"

    def test_lead_finder_live_osm(self, authed):
        """Restaurant/Gurugram should return REAL OpenStreetMap POIs, no auto-mock fallback."""
        r = authed.post(f"{API}/leads/find",
                        json={"category": "Restaurant", "location": "Gurugram", "count": 10, "min_score": 40})
        assert r.status_code == 200
        d = r.json()
        assert d["provider"]["active"] == "openstreetmap", d["provider"]
        assert d["provider"]["live"] is True
        assert d["no_results"] is False
        assert "openstreetmap" in d["sources_used"]
        assert len(d["results"]) >= 1
        first = d["results"][0]
        assert first["is_demo"] is False
        assert first["source"] == "openstreetmap"
        # source_url MUST point at OSM (real, verifiable)
        assert first.get("source_url", "").startswith("https://www.openstreetmap.org/")
        # Missing contact fields must be None, never fabricated
        for lead in d["results"]:
            for f in ("phone", "email", "website"):
                assert lead[f] is None or isinstance(lead[f], str)

    def test_lead_finder_clinic_delhi_live(self, authed):
        r = authed.post(f"{API}/leads/find",
                        json={"category": "Clinic", "location": "Delhi", "count": 5, "min_score": 40})
        assert r.status_code == 200
        d = r.json()
        assert d["provider"]["active"] == "openstreetmap"
        assert d["no_results"] is False
        assert len(d["results"]) >= 1
        assert all(l["is_demo"] is False for l in d["results"])

    def test_lead_finder_no_results_on_obscure(self, authed):
        """Obscure category/location must return no_results:True (no auto-mock; user must click Load Demo)."""
        r = authed.post(f"{API}/leads/find",
                        json={"category": "Unicorn Rescue", "location": "MiddleOfNowhereXYZ",
                              "count": 3, "min_score": 40})
        assert r.status_code == 200
        d = r.json()
        assert d["no_results"] is True
        assert d["provider"]["active"] == "none"
        assert len(d["results"]) == 0
        # And explicit demo endpoint returns clearly-flagged sample data
        r2 = authed.post(f"{API}/leads/find-demo",
                         json={"category": "Unicorn Rescue", "location": "MiddleOfNowhereXYZ",
                               "count": 3, "min_score": 40})
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["provider"]["active"] == "demo"
        assert d2["provider"]["live"] is False
        assert all(l["is_demo"] is True for l in d2["results"])

    def test_import_found_leads(self, authed):
        # find (using a real live category so we're testing real path)
        r = authed.post(f"{API}/leads/find",
                        json={"category": "Cafe", "location": "Bangalore", "count": 3, "min_score": 40})
        found = r.json()["results"]
        # tag names for easy cleanup
        for lead in found:
            lead["business_name"] = f"TEST_{lead['business_name']}"
            lead["location"] = "TEST_ZONE_CI"
        r2 = authed.post(f"{API}/leads/import", json={"leads": found})
        assert r2.status_code == 200
        assert r2.json()["inserted"] >= 1

        # verify persisted
        r3 = authed.get(f"{API}/leads", params={"location": "TEST_ZONE_CI"})
        assert r3.status_code == 200
        assert len(r3.json()) >= 1

    def test_create_get_update_delete_lead(self, authed):
        # create
        payload = {
            "business_name": "TEST_CRUD_Lead",
            "category": "Cafe", "location": "TEST_LOC",
            "website": None, "website_status": "Missing",
            "phone": None, "email": None,
            "lead_score": 72, "conversion_score": "MEDIUM",
            "digital_presence_score": 40, "business_size": "Small",
            "research_status": "Not Researched", "pipeline_status": "NEW",
        }
        r = authed.post(f"{API}/leads", json=payload)
        assert r.status_code == 200, r.text
        lead = r.json()
        assert lead["business_name"] == "TEST_CRUD_Lead"
        lid = lead["id"]

        # get
        r = authed.get(f"{API}/leads/{lid}")
        assert r.status_code == 200
        assert r.json()["lead"]["id"] == lid

        # update
        r = authed.patch(f"{API}/leads/{lid}", json={"notes": "hello"})
        assert r.status_code == 200
        assert r.json()["notes"] == "hello"

        # stage change
        r = authed.patch(f"{API}/leads/{lid}/stage", json={"pipeline_status": "QUALIFIED"})
        assert r.status_code == 200
        assert r.json()["pipeline_status"] == "QUALIFIED"

        # bad stage
        r = authed.patch(f"{API}/leads/{lid}/stage", json={"pipeline_status": "INVALID"})
        assert r.status_code == 400

        # mark pitched
        r = authed.post(f"{API}/leads/{lid}/mark-pitched")
        assert r.status_code == 200
        assert r.json()["pipeline_status"] == "PITCHED"

        # delete
        r = authed.delete(f"{API}/leads/{lid}")
        assert r.status_code == 200
        # get should 404
        r = authed.get(f"{API}/leads/{lid}")
        assert r.status_code == 404


# ---------------------------- AI: RESEARCH + OUTREACH ----------------------------
class TestAI:
    @pytest.fixture(scope="class")
    def sample_lead_id(self, authed):
        # use the first seeded lead
        r = authed.get(f"{API}/leads", params={"category": "Restaurant"})
        return r.json()[0]["id"]

    def test_research_claude(self, authed, sample_lead_id):
        r = authed.post(f"{API}/leads/{sample_lead_id}/research", timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["lead_id"] == sample_lead_id
        # Real model, not heuristic fallback
        assert d["generated_by"] == "claude-sonnet-4-6", f"expected Claude, got {d['generated_by']}"
        report = d["report"]
        # required sections
        required = ["business_overview", "digital_presence", "website_assessment",
                    "social_presence", "business_signals", "pain_points",
                    "software_opportunity", "recommended_solution",
                    "project_category", "lead_score", "conversion_potential",
                    "outreach_channel", "personalized_pitch", "follow_up", "why"]
        missing = [k for k in required if k not in report]
        assert not missing, f"missing report keys: {missing}"
        assert isinstance(report["pain_points"], list) and len(report["pain_points"]) >= 2
        assert report["conversion_potential"] in ("HIGH", "MEDIUM", "LOW")
        assert 0 <= int(report["lead_score"]) <= 100
        assert len(str(report["personalized_pitch"])) > 40

        # Verify lead updated to Researched
        r2 = authed.get(f"{API}/leads/{sample_lead_id}")
        assert r2.json()["lead"]["research_status"] == "Researched"

    def test_outreach_whatsapp(self, authed, sample_lead_id):
        r = authed.post(f"{API}/leads/{sample_lead_id}/outreach", json={"channel": "whatsapp"}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["channel"] == "whatsapp"
        assert isinstance(d["content"], str) and len(d["content"]) > 30
        # personalisation heuristic: not a generic error/placeholder
        assert "TEST_" not in d["content"]

    def test_outreach_email(self, authed, sample_lead_id):
        r = authed.post(f"{API}/leads/{sample_lead_id}/outreach", json={"channel": "email"}, timeout=90)
        assert r.status_code == 200
        assert len(r.json()["content"]) > 40

    def test_outreach_linkedin(self, authed, sample_lead_id):
        r = authed.post(f"{API}/leads/{sample_lead_id}/outreach", json={"channel": "linkedin"}, timeout=90)
        assert r.status_code == 200
        assert len(r.json()["content"]) > 30


# ---------------------------- VERIFIED FACTS (new this iteration) ----------------------------
class TestVerifiedFacts:
    """Zero-fabrication research: verified_facts must be real observed data + sources[] real URLs."""

    def test_research_with_website_captures_signals(self, authed):
        # Find a live lead that has a website (Cafe/Bangalore reliably returns Blue Tokai etc)
        r = authed.post(f"{API}/leads/find",
                        json={"category": "Cafe", "location": "Bangalore", "count": 15})
        assert r.status_code == 200
        results = r.json()["results"]
        with_site = [l for l in results if l.get("website")]
        if not with_site:
            pytest.skip("No live cafe lead with website returned this run (OSM data varies)")
        target = with_site[0]
        # Import
        imp = authed.post(f"{API}/leads/import", json={"leads": [target]})
        assert imp.status_code == 200
        # Find persisted lead
        lst = authed.get(f"{API}/leads", params={"q": target["business_name"]}).json()
        assert lst, "imported lead not found"
        lid = lst[0]["id"]
        # Research
        res = authed.post(f"{API}/leads/{lid}/research", timeout=180)
        assert res.status_code == 200, res.text[:400]
        d = res.json()
        assert d["generated_by"] == "claude-sonnet-4-6"
        vf = d.get("verified_facts") or {}
        ws = vf.get("website") or {}
        # Website was fetched — real signals present
        assert ws.get("provided") is True
        # The site should have loaded (real HTTP 200/2xx OR at least an http_status present)
        assert "http_status" in ws
        assert "title" in ws  # BeautifulSoup extracted a title (or None)
        assert "has_booking_form" in ws
        assert "has_contact_form" in ws
        assert "social_links_on_site" in ws
        # Sources are REAL URLs (nothing fabricated)
        sources = d.get("sources") or []
        assert len(sources) >= 1
        for s in sources:
            u = s.get("url", "")
            assert u.startswith("http"), f"bad source url {u}"
        # OpenStreetMap listing should appear as one of the sources since lead came from OSM
        assert any("openstreetmap.org" in s.get("url", "") for s in sources)

    def test_research_never_fabricates_missing_contact(self, authed):
        # Live lead without a website: verified_facts.website.provided should be False
        r = authed.post(f"{API}/leads/find",
                        json={"category": "Clinic", "location": "Delhi", "count": 10})
        results = r.json()["results"]
        no_site = [l for l in results if not l.get("website")]
        if not no_site:
            pytest.skip("Every clinic lead has a website — cannot test the no-site path")
        target = no_site[0]
        imp = authed.post(f"{API}/leads/import", json={"leads": [target]})
        assert imp.status_code == 200
        lst = authed.get(f"{API}/leads", params={"q": target["business_name"]}).json()
        lid = lst[0]["id"]
        res = authed.post(f"{API}/leads/{lid}/research", timeout=180)
        assert res.status_code == 200
        d = res.json()
        vf = d.get("verified_facts") or {}
        ws = vf.get("website") or {}
        # When lead has no website, verified_facts.website.provided must be False
        assert ws.get("provided") is False


# ---------------------------- CAMPAIGNS ----------------------------
class TestCampaigns:
    def test_list_with_stats(self, authed):
        r = authed.get(f"{API}/campaigns")
        assert r.status_code == 200
        camps = r.json()
        assert len(camps) >= 1
        assert "stats" in camps[0]
        assert "total" in camps[0]["stats"]

    def test_create_get_detail_add_remove(self, authed):
        r = authed.post(f"{API}/campaigns", json={
            "name": "TEST_Campaign_CI", "industry": "Cafe", "location": "TEST_LOC",
            "offer": "Test offer", "assigned_members": [],
        })
        assert r.status_code == 200
        cid = r.json()["id"]

        # get detail
        r = authed.get(f"{API}/campaigns/{cid}")
        assert r.status_code == 200
        assert "leads" in r.json()

        # add a lead to it
        rl = authed.get(f"{API}/leads")
        lead_id = rl.json()[0]["id"]
        r = authed.post(f"{API}/campaigns/{cid}/leads", json={"lead_ids": [lead_id]})
        assert r.status_code == 200

        # verify
        r = authed.get(f"{API}/campaigns/{cid}")
        assert lead_id in [l["id"] for l in r.json()["leads"]]

        # remove
        r = authed.delete(f"{API}/campaigns/{cid}/leads/{lead_id}")
        assert r.status_code == 200

        # cleanup
        authed.delete(f"{API}/campaigns/{cid}")


# ---------------------------- CLIENTS/PROJECTS/TASKS ----------------------------
class TestClients:
    def test_crud(self, authed):
        r = authed.post(f"{API}/clients", json={
            "name": "TEST_Client", "company": "TEST_Co", "industry": "Cafe",
            "contact": "TEST_Client", "email": None, "phone": None,
            "source": "Referral", "deal_value": 100000, "status": "Prospect",
        })
        assert r.status_code == 200
        cid = r.json()["id"]

        r = authed.get(f"{API}/clients/{cid}")
        assert r.status_code == 200
        assert "projects" in r.json()

        r = authed.patch(f"{API}/clients/{cid}", json={"status": "Active"})
        assert r.status_code == 200
        assert r.json()["status"] == "Active"

        r = authed.delete(f"{API}/clients/{cid}")
        assert r.status_code == 200


class TestProjects:
    def test_list_and_detail(self, authed):
        r = authed.get(f"{API}/projects")
        assert r.status_code == 200
        projects = r.json()
        assert len(projects) >= 1
        pid = projects[0]["id"]
        r = authed.get(f"{API}/projects/{pid}")
        assert r.status_code == 200
        assert "tasks" in r.json()


class TestTasks:
    def test_crud(self, authed):
        r = authed.get(f"{API}/tasks")
        assert r.status_code == 200
        assert len(r.json()) >= 1

        r = authed.post(f"{API}/tasks", json={
            "title": "TEST_Task", "assigned_to": None,
            "priority": "Medium", "status": "Todo",
        })
        assert r.status_code == 200
        tid = r.json()["id"]
        r = authed.patch(f"{API}/tasks/{tid}", json={"status": "Done"})
        assert r.status_code == 200
        assert r.json()["status"] == "Done"
        authed.delete(f"{API}/tasks/{tid}")


# ---------------------------- TEAM / ANALYTICS / INTEGRATIONS ----------------------------
class TestMeta:
    def test_team(self, authed):
        r = authed.get(f"{API}/team")
        assert r.status_code == 200
        team = r.json()
        assert len(team) >= 3
        assert "stats" in team[0]
        for k in ("leads", "tasks_open", "followups", "meetings", "projects", "won"):
            assert k in team[0]["stats"]

    def test_analytics(self, authed):
        r = authed.get(f"{API}/analytics")
        assert r.status_code == 200
        d = r.json()
        for k in ("by_category", "by_location", "by_conversion", "funnel", "totals"):
            assert k in d
        assert d["totals"]["leads"] >= 1

    def test_integrations(self, authed):
        r = authed.get(f"{API}/settings/integrations")
        assert r.status_code == 200
        d = r.json()
        # Provider is now LIVE multi-source (OSM + open-web)
        assert "openstreetmap" in d["lead_provider"]["active"]
        assert d["lead_provider"]["live"] is True
        keys = {i["key"]: i for i in d["integrations"]}
        for k in ("osm", "web_research", "web_search", "llm", "google_places", "email", "whatsapp"):
            assert k in keys, f"missing integration {k}"
        # LIVE / free ones
        for k in ("osm", "web_research", "web_search"):
            assert keys[k]["connected"] is True
            assert keys[k]["cost"] == "$0"
        assert keys["llm"]["connected"] is True
        # Paid / optional / not enabled
        assert keys["google_places"]["connected"] is False
        assert keys["email"]["connected"] is False
        assert keys["whatsapp"]["connected"] is False

    def test_search(self, authed):
        r = authed.get(f"{API}/search", params={"q": "Spice"})
        assert r.status_code == 200
        d = r.json()
        for k in ("leads", "clients", "projects", "campaigns"):
            assert k in d


# ---------------------------- CSV IMPORT/EXPORT ----------------------------
class TestCSV:
    def test_export_csv(self, authed):
        # export requires a raw request (StreamingResponse); reuse token
        r = authed.get(f"{API}/export/leads-csv")
        assert r.status_code == 200, r.text[:200]
        assert "text/csv" in r.headers.get("content-type", "")
        body = r.text
        assert "business_name" in body.splitlines()[0]
        assert len(body.splitlines()) > 1

    def test_import_csv(self, authed, api_client, auth_token):
        csv_text = "business_name,category,location,website,phone,email,lead_score\n"
        csv_text += "TEST_CSV_Business,Cafe,TEST_CSV_LOC,https://example.com,,,85\n"
        # multipart upload requires a separate call without Content-Type: application/json
        files = {"file": ("test.csv", csv_text.encode("utf-8"), "text/csv")}
        headers = {"Authorization": f"Bearer {auth_token}"}
        r = requests.post(f"{API}/leads/import-csv", files=files, headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["inserted"] >= 1

        # verify persisted
        r2 = authed.get(f"{API}/leads", params={"q": "TEST_CSV_Business"})
        assert len(r2.json()) >= 1


# ---------------------------- CLEANUP ----------------------------
def test_zzz_cleanup(authed):
    """Delete any TEST_ prefixed leads/clients/campaigns/tasks created above."""
    for path, key in [("leads", "business_name"), ("clients", "company"),
                      ("campaigns", "name"), ("tasks", "title")]:
        try:
            r = authed.get(f"{API}/{path}")
            for item in r.json():
                if isinstance(item, dict) and str(item.get(key, "")).startswith("TEST_"):
                    authed.delete(f"{API}/{path}/{item['id']}")
        except Exception:
            pass
