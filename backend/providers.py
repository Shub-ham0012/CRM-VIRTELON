"""
Lead data provider abstraction.

The MockLeadProvider generates realistic-looking prospect data for the MVP.
A real provider (Google Places / search API / directory scraper) can be added
by implementing the same `find_leads` signature and swapping ACTIVE_PROVIDER.

IMPORTANT: data from MockLeadProvider is clearly flagged `source="mock"` and
`is_demo=True`. It is NOT live data and must never be presented as such.
"""
import random
from models import new_id, now_iso

CATEGORY_NAMES = {
    "Restaurant": ["Spice Route", "The Curry Leaf", "Tandoori Nights", "Urban Bites", "Masala Junction",
                   "Green Bowl", "The Grill House", "Cafe Aroma", "Biryani Bay", "Flavour Town"],
    "Cafe": ["Bean & Brew", "Morning Roast", "The Coffee Loft", "Caffeine Corner", "Steam & Cup"],
    "Clinic": ["CarePlus Clinic", "Wellness Point", "MediCare Centre", "HealthFirst Clinic", "Prime Dental"],
    "Salon": ["Glow Studio", "The Style Bar", "Luxe Salon", "Mirror Mirror", "Shear Genius"],
    "Manufacturer": ["Precision Industries", "NorthGear Manufacturing", "Apex Components", "SteelWorks Ltd", "Unified Fabricators"],
    "Logistics": ["SwiftMove Logistics", "CargoLink", "RapidHaul", "TransConnect", "FreightPro"],
    "Construction": ["BuildRight Constructions", "Skyline Builders", "Foundation Group", "UrbanForm", "Concrete & Co"],
    "Healthcare": ["Aster Health Group", "LifeLine Hospitals", "MediGroup", "CureWell Network", "Vitality Care"],
    "Education": ["BrightMinds Academy", "EduSpark", "LearnHub Institute", "NextGen Coaching", "ScholarPoint"],
}

WEBSITE_STATES = ["Missing", "Weak", "Good"]
SIZES = ["Small", "Mid", "Large"]

B2B_CATEGORIES = {"Manufacturer", "Logistics", "Construction", "Healthcare", "Education"}


class MockLeadProvider:
    source = "mock"

    def find_leads(self, params: dict) -> list:
        category = params.get("category", "Restaurant")
        location = params.get("location", "Gurugram")
        count = max(1, min(int(params.get("count", 20)), 50))
        min_score = int(params.get("min_score", 0))
        website_filter = params.get("website_status", "Any")
        project_type = params.get("project_type") or "Website"

        pool = CATEGORY_NAMES.get(category, [f"{category} Co", f"{category} Group", f"{category} Partners",
                                             f"{category} Hub", f"{category} Works"])
        is_b2b = category in B2B_CATEGORIES
        leads = []
        used = set()
        attempts = 0
        while len(leads) < count and attempts < count * 6:
            attempts += 1
            base = random.choice(pool)
            suffix = random.choice(["", " Pvt Ltd", " & Co", " India", f" {location}", " Group", " LLP"])
            name = f"{base}{suffix}".strip()
            if name in used:
                name = f"{name} {random.randint(2, 99)}"
            used.add(name)

            ws = random.choices(WEBSITE_STATES, weights=[4, 4, 2])[0]
            if website_filter == "Missing":
                ws = "Missing"
            elif website_filter == "Weak":
                ws = "Weak"

            digital = random.randint(20, 95)
            score = random.randint(max(min_score, 45), 98)
            if ws == "Missing":
                score = min(98, score + 8)
            conv = "HIGH" if score >= 82 else ("MEDIUM" if score >= 65 else "LOW")
            size = random.choice(["Mid", "Large"]) if is_b2b else random.choice(["Small", "Mid"])

            slug = base.lower().replace(" ", "")
            has_site = ws != "Missing"
            has_insta = random.random() > 0.35
            reasons = []
            if ws == "Missing":
                reasons.append("no dedicated website")
            elif ws == "Weak":
                reasons.append("outdated / weak website")
            if has_insta:
                reasons.append("active social presence")
            reasons.append("strong local presence" if not is_b2b else "clear operational scale")
            reason = "Strong prospect: " + ", ".join(reasons) + "."

            leads.append({
                "id": new_id(),
                "business_name": name,
                "category": category,
                "location": location,
                "website": f"https://www.{slug}.com" if has_site else None,
                "website_status": ws,
                "phone": None,          # never fabricated
                "email": None,          # never fabricated
                "google_url": f"https://www.google.com/maps/search/{slug}+{location.lower()}",
                "instagram_url": f"https://instagram.com/{slug}" if has_insta else None,
                "linkedin_url": f"https://linkedin.com/company/{slug}" if is_b2b else None,
                "lead_score": score,
                "conversion_score": conv,
                "digital_presence_score": digital,
                "business_size": size,
                "research_status": "Not Researched",
                "pipeline_status": "NEW",
                "assigned_to": None,
                "campaign_id": None,
                "project_type": project_type,
                "reason": reason,
                "source": self.source,
                "is_demo": True,
                "created_at": now_iso(),
            })
        leads = [l for l in leads if l["lead_score"] >= min_score]
        return leads


ACTIVE_PROVIDER = MockLeadProvider()


def provider_status() -> dict:
    return {
        "active": ACTIVE_PROVIDER.source,
        "live": False,
        "note": "Mock provider active. Connect a Google Places / Search API in Settings to enable live discovery.",
    }
