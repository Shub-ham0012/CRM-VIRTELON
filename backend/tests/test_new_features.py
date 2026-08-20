"""
Iteration 3 pre-launch features tests:
- Import Deduplication (POST /leads/import + /leads/import-csv)
- Bulk Actions (assign/campaign/delete/research)
- Notes + Timeline (POST /leads/{id}/note + activities in GET /leads/{id})
- Website Re-check (POST /leads/{id}/recheck-website)
- Follow-up reminders (dashboard followups_upcoming/today)
- Saved Searches (CRUD)
"""
import os
import pytest
import requests
from tests.conftest import API


# ============ Import Deduplication ============
class TestImportDedup:
    def test_finder_import_dedup_same_batch(self, authed):
        """Importing the SAME finder results twice: second call must return skipped>0."""
        # find a small set of live leads
        r = authed.post(f"{API}/leads/find",
                        json={"category": "Cafe", "location": "Bangalore", "count": 3, "min_score": 40})
        assert r.status_code == 200, r.text
        results = r.json()["results"]
        if not results:
            pytest.skip("Nominatim returned no results this run")
        # First import
        r1 = authed.post(f"{API}/leads/import", json={"leads": results})
        assert r1.status_code == 200
        j1 = r1.json()
        assert "inserted" in j1 and "skipped" in j1
        # Second import of the SAME batch
        r2 = authed.post(f"{API}/leads/import", json={"leads": results})
        assert r2.status_code == 200
        j2 = r2.json()
        assert j2["inserted"] == 0, f"expected 0 new inserts, got {j2}"
        assert j2["skipped"] == len(results), f"expected skipped={len(results)}, got {j2}"

    def test_csv_import_dedup(self, authed, auth_token):
        """CSV import returns {inserted, skipped} and skips duplicates on re-upload."""
        csv_text = (
            "business_name,category,location,website,phone,email,lead_score\n"
            "TEST_DEDUP_Biz1,Cafe,TEST_DEDUP_LOC,https://dedup-example.test,,,88\n"
            "TEST_DEDUP_Biz2,Cafe,TEST_DEDUP_LOC,,+91-9999123456,,72\n"
        )
        files = {"file": ("dedup.csv", csv_text.encode("utf-8"), "text/csv")}
        headers = {"Authorization": f"Bearer {auth_token}"}
        r1 = requests.post(f"{API}/leads/import-csv", files=files, headers=headers, timeout=30)
        assert r1.status_code == 200, r1.text
        j1 = r1.json()
        assert "inserted" in j1 and "skipped" in j1
        assert j1["inserted"] >= 2, j1
        # Re-upload same content
        files2 = {"file": ("dedup.csv", csv_text.encode("utf-8"), "text/csv")}
        r2 = requests.post(f"{API}/leads/import-csv", files=files2, headers=headers, timeout=30)
        assert r2.status_code == 200
        j2 = r2.json()
        assert j2["inserted"] == 0, j2
        assert j2["skipped"] >= 2, j2


# ============ Notes & Timeline ============
class TestNotesTimeline:
    def test_note_creates_activity(self, authed):
        # create a fresh lead
        r = authed.post(f"{API}/leads", json={
            "business_name": "TEST_NoteLead", "category": "Cafe", "location": "TEST_NOTE_LOC",
            "lead_score": 50, "conversion_score": "MEDIUM", "digital_presence_score": 30,
            "business_size": "Small", "research_status": "Not Researched", "pipeline_status": "NEW",
        })
        assert r.status_code == 200, r.text
        lid = r.json()["id"]

        # add note
        r2 = authed.post(f"{API}/leads/{lid}/note", json={"note": "Called owner, will follow up Monday."})
        assert r2.status_code == 200
        assert r2.json().get("ok") is True

        # verify note appears in lead detail activities
        r3 = authed.get(f"{API}/leads/{lid}")
        assert r3.status_code == 200
        d = r3.json()
        assert d["lead"]["notes"] == "Called owner, will follow up Monday."
        assert any("Called owner" in a["text"] for a in d["activities"]), "note activity missing from timeline"

        # empty note rejected
        r4 = authed.post(f"{API}/leads/{lid}/note", json={"note": ""})
        assert r4.status_code == 400

        # cleanup
        authed.delete(f"{API}/leads/{lid}")


# ============ Website Re-check ============
class TestRecheckWebsite:
    def test_recheck_no_website(self, authed):
        r = authed.post(f"{API}/leads", json={
            "business_name": "TEST_NoWeb", "category": "Cafe", "location": "TEST_LOC",
            "website": None, "lead_score": 40, "conversion_score": "LOW",
            "digital_presence_score": 20, "business_size": "Small",
            "research_status": "Not Researched", "pipeline_status": "NEW",
        })
        lid = r.json()["id"]
        r2 = authed.post(f"{API}/leads/{lid}/recheck-website")
        assert r2.status_code == 200
        d = r2.json()
        assert d["website"] is None
        assert d["site_loaded"] is False
        assert "message" in d
        authed.delete(f"{API}/leads/{lid}")

    def test_recheck_with_real_website(self, authed):
        r = authed.post(f"{API}/leads", json={
            "business_name": "TEST_WebLead", "category": "Cafe", "location": "TEST_LOC",
            "website": "https://example.com", "lead_score": 60, "conversion_score": "MEDIUM",
            "digital_presence_score": 40, "business_size": "Small",
            "research_status": "Not Researched", "pipeline_status": "NEW",
        })
        lid = r.json()["id"]
        r2 = authed.post(f"{API}/leads/{lid}/recheck-website", timeout=60)
        assert r2.status_code == 200
        d = r2.json()
        assert d["website"] == "https://example.com"
        # example.com is reachable — expect site_loaded True and status Good
        assert d["site_loaded"] is True, d
        assert d["website_status"] == "Good"
        # And lead should be updated in DB
        r3 = authed.get(f"{API}/leads/{lid}")
        assert r3.json()["lead"]["website_status"] == "Good"
        authed.delete(f"{API}/leads/{lid}")


# ============ Bulk Actions ============
class TestBulk:
    @pytest.fixture(scope="class")
    def bulk_ids(self, authed):
        """Create 3 fresh leads for bulk operations."""
        ids = []
        for i in range(3):
            r = authed.post(f"{API}/leads", json={
                "business_name": f"TEST_BULK_{i}", "category": "Cafe", "location": "TEST_BULK_LOC",
                "lead_score": 50 + i, "conversion_score": "MEDIUM", "digital_presence_score": 30,
                "business_size": "Small", "research_status": "Not Researched", "pipeline_status": "NEW",
            })
            ids.append(r.json()["id"])
        yield ids
        for lid in ids:
            try:
                authed.delete(f"{API}/leads/{lid}")
            except Exception:
                pass

    def test_bulk_assign(self, authed, bulk_ids):
        users = authed.get(f"{API}/users").json()
        uid = users[0]["id"]
        r = authed.post(f"{API}/leads/bulk/assign", json={"lead_ids": bulk_ids, "assigned_to": uid})
        assert r.status_code == 200
        assert r.json()["updated"] == len(bulk_ids)
        # verify
        for lid in bulk_ids:
            d = authed.get(f"{API}/leads/{lid}").json()["lead"]
            assert d["assigned_to"] == uid

    def test_bulk_campaign(self, authed, bulk_ids):
        # create a campaign
        c = authed.post(f"{API}/campaigns", json={
            "name": "TEST_BULK_CAMPAIGN", "industry": "Cafe", "location": "TEST_LOC",
            "offer": "test", "assigned_members": [],
        }).json()
        cid = c["id"]
        r = authed.post(f"{API}/leads/bulk/campaign", json={"lead_ids": bulk_ids, "campaign_id": cid})
        assert r.status_code == 200
        assert r.json()["updated"] == len(bulk_ids)
        # verify
        cdet = authed.get(f"{API}/campaigns/{cid}").json()
        cam_lead_ids = [l["id"] for l in cdet["leads"]]
        for lid in bulk_ids:
            assert lid in cam_lead_ids
        authed.delete(f"{API}/campaigns/{cid}")

    def test_bulk_research_capped(self, authed):
        """Bulk research should cap at 3 and return {researched, requested}. Endpoint renamed to /leads/batch-research to avoid /leads/{lead_id}/research collision."""
        # create 2 fresh, unresearched leads (real live-website ones would be slow, use minimal ones)
        created = []
        for i in range(2):
            r = authed.post(f"{API}/leads", json={
                "business_name": f"TEST_BULK_RESEARCH_{i}", "category": "Cafe", "location": "TEST_LOC",
                "website": None, "lead_score": 50, "conversion_score": "MEDIUM",
                "digital_presence_score": 30, "business_size": "Small",
                "research_status": "Not Researched", "pipeline_status": "NEW",
            })
            created.append(r.json()["id"])
        try:
            r = authed.post(f"{API}/leads/batch-research", json={"lead_ids": created}, timeout=240)
            assert r.status_code == 200, r.text
            d = r.json()
            assert "researched" in d and "requested" in d
            assert d["requested"] == len(created)
            # Note: researched may be less than requested if AI fails, but should be > 0
            assert d["researched"] >= 1, d
            # spot-check that at least one lead is now Researched
            statuses = [authed.get(f"{API}/leads/{lid}").json()["lead"]["research_status"] for lid in created]
            assert "Researched" in statuses, statuses
        finally:
            for lid in created:
                authed.delete(f"{API}/leads/{lid}")

    def test_bulk_delete(self, authed):
        # create fresh
        ids = []
        for i in range(2):
            r = authed.post(f"{API}/leads", json={
                "business_name": f"TEST_BULK_DEL_{i}", "category": "Cafe", "location": "TEST_LOC",
                "lead_score": 50, "conversion_score": "MEDIUM", "digital_presence_score": 30,
                "business_size": "Small", "research_status": "Not Researched", "pipeline_status": "NEW",
            })
            ids.append(r.json()["id"])
        r = authed.post(f"{API}/leads/bulk/delete", json={"lead_ids": ids})
        assert r.status_code == 200
        assert r.json()["deleted"] == len(ids)
        for lid in ids:
            r = authed.get(f"{API}/leads/{lid}")
            assert r.status_code == 404


# ============ Saved Searches ============
class TestSavedSearches:
    def test_crud(self, authed):
        payload = {"name": "TEST_SavedSearch_Cafe", "params": {"category": "Cafe", "location": "Bangalore"}}
        r = authed.post(f"{API}/saved-searches", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == payload["name"]
        assert d["params"]["category"] == "Cafe"
        sid = d["id"]

        r = authed.get(f"{API}/saved-searches")
        assert r.status_code == 200
        assert any(s["id"] == sid for s in r.json())

        r = authed.delete(f"{API}/saved-searches/{sid}")
        assert r.status_code == 200
        # verify deleted
        r = authed.get(f"{API}/saved-searches")
        assert not any(s["id"] == sid for s in r.json())


# ============ Dashboard follow-ups (overdue/upcoming/today) ============
class TestDashboardFollowups:
    def test_dashboard_followup_fields(self, authed):
        r = authed.get(f"{API}/dashboard")
        assert r.status_code == 200
        d = r.json()
        # New fields required this iteration
        for k in ("followups_due", "followups_upcoming", "today"):
            assert k in d, f"missing {k}"
        assert isinstance(d["followups_upcoming"], list)
        # today should be an ISO date string YYYY-MM-DD
        assert len(d["today"]) == 10 and d["today"][4] == "-" and d["today"][7] == "-"

    def test_upcoming_shows_leads_within_7_days(self, authed):
        # create a lead with follow-up in 3 days
        from datetime import date, timedelta
        upcoming = (date.today() + timedelta(days=3)).isoformat()
        r = authed.post(f"{API}/leads", json={
            "business_name": "TEST_UPCOMING_FUP", "category": "Cafe", "location": "TEST_LOC",
            "lead_score": 60, "conversion_score": "MEDIUM", "digital_presence_score": 40,
            "business_size": "Small", "research_status": "Not Researched", "pipeline_status": "NEW",
        })
        lid = r.json()["id"]
        authed.patch(f"{API}/leads/{lid}", json={"next_follow_up": upcoming})

        # create an OVERDUE follow-up
        overdue = (date.today() - timedelta(days=2)).isoformat()
        r2 = authed.post(f"{API}/leads", json={
            "business_name": "TEST_OVERDUE_FUP", "category": "Cafe", "location": "TEST_LOC",
            "lead_score": 60, "conversion_score": "MEDIUM", "digital_presence_score": 40,
            "business_size": "Small", "research_status": "Not Researched", "pipeline_status": "NEW",
        })
        lid2 = r2.json()["id"]
        authed.patch(f"{API}/leads/{lid2}", json={"next_follow_up": overdue})

        d = authed.get(f"{API}/dashboard").json()
        # followups_upcoming[:8] and followups_due[:8] are capped in the endpoint.
        # We can reliably assert the upcoming lead appears (upcoming list is usually short)
        # but seed data may already fill the 8 overdue slots, so we assert the KPI count instead.
        assert any(l["id"] == lid for l in d["followups_upcoming"]), "upcoming lead missing"
        # KPI followups_due counts ALL overdue leads, not just first 8 — reliable check
        assert d["kpis"]["followups_due"] >= 1, d["kpis"]

        # cleanup
        authed.delete(f"{API}/leads/{lid}")
        authed.delete(f"{API}/leads/{lid2}")


# ============ One-Click Outreach (backend supplies phone/email) ============
class TestOutreachRoutes:
    """We don't own wa.me — this only verifies the lead payload has the fields the UI uses to build the mailto/wa.me link."""

    def test_lead_carries_phone_and_email_when_present(self, authed):
        r = authed.post(f"{API}/leads", json={
            "business_name": "TEST_OUTREACH_HAS_CONTACT", "category": "Cafe", "location": "TEST_LOC",
            "website": "https://example.com", "phone": "+919999888877", "email": "owner@example.com",
            "lead_score": 70, "conversion_score": "HIGH", "digital_presence_score": 50,
            "business_size": "Small", "research_status": "Not Researched", "pipeline_status": "NEW",
        })
        lid = r.json()["id"]
        lead = authed.get(f"{API}/leads/{lid}").json()["lead"]
        assert lead["phone"] == "+919999888877"
        assert lead["email"] == "owner@example.com"
        authed.delete(f"{API}/leads/{lid}")


# ============ Cleanup ============
def test_zzz_cleanup_new_features(authed):
    """Delete any TEST_ prefixed leads created by these tests."""
    try:
        for l in authed.get(f"{API}/leads").json():
            if str(l.get("business_name", "")).startswith("TEST_") or l.get("location", "").startswith("TEST_"):
                authed.delete(f"{API}/leads/{l['id']}")
    except Exception:
        pass
    try:
        for s in authed.get(f"{API}/saved-searches").json():
            if str(s.get("name", "")).startswith("TEST_"):
                authed.delete(f"{API}/saved-searches/{s['id']}")
    except Exception:
        pass
