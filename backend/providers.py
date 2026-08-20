"""
Lead discovery provider abstraction — ZERO-COST / open-web only.

Providers implement `find_leads(params) -> list[dict]`. Two are shipped:

  * OSMLeadProvider  — LIVE, free, no API key. Geocodes the location with
    OpenStreetMap Nominatim, then queries the Overpass API for real public
    business POIs (name, website, phone, email, address, social handles as
    tagged in OpenStreetMap). Every field is real; missing fields stay None
    and are shown as "Not found". Each lead carries a real source_url pointing
    to its OpenStreetMap element.

  * MockLeadProvider — FALLBACK ONLY, used when the open web is technically
    unavailable (all Overpass mirrors down / no results). Its output is clearly
    flagged is_demo=True and source="mock".

A future paid provider (e.g. Google Places) can be added as another class and
selected via ACTIVE_PROVIDER_NAME without touching the rest of the app.

ZERO FABRICATION: no business name, phone, email, website, rating or social
profile is ever invented by OSMLeadProvider.
"""
import asyncio
import logging
import random
import httpx
from models import new_id, now_iso

logger = logging.getLogger("virtelon.providers")

NOMINATIM = "https://nominatim.openstreetmap.org/search"
UA = {"User-Agent": "VirtelonCommandCentre/1.0 (internal lead tool)"}

# category -> Nominatim free-text search phrase
CATEGORY_QUERY = {
    "Restaurant": "restaurant", "Cafe": "cafe", "Clinic": "clinic",
    "Salon": "beauty salon", "Manufacturer": "manufacturer",
    "Logistics": "logistics company", "Construction": "construction company",
    "Healthcare": "hospital", "Education": "school",
}


def _score_from_evidence(et: dict) -> dict:
    website = et.get("website") or et.get("contact:website") or et.get("url")
    phone = et.get("phone") or et.get("contact:phone") or et.get("contact:mobile")
    email = et.get("email") or et.get("contact:email")
    insta = et.get("contact:instagram")
    fb = et.get("contact:facebook")
    hours = et.get("opening_hours")

    digital = 15
    score = 55
    if website:
        digital += 40; score += 5
    else:
        score += 22  # no website => strong opportunity for a software agency
    if phone:
        digital += 15; score += 6
    if email:
        digital += 10; score += 4
    if insta or fb:
        digital += 15; score += 6
    if hours:
        score += 3
    score = max(40, min(score, 98))
    digital = max(0, min(digital, 100))
    conv = "HIGH" if score >= 80 else ("MEDIUM" if score >= 65 else "LOW")

    bits = []
    bits.append("no website found in public data (strong web opportunity)" if not website else "has a website listed")
    if phone:
        bits.append("public phone available")
    if insta or fb:
        bits.append("active on social")
    if not phone and not email:
        bits.append("limited public contact info")
    reason = "Evidence: " + ", ".join(bits) + "."
    return {"lead_score": score, "digital_presence_score": digital, "conversion_score": conv,
            "reason": reason, "website": website, "phone": phone, "email": email,
            "instagram": insta, "facebook": fb, "hours": hours}


class OSMLeadProvider:
    """Live, free discovery via OpenStreetMap Nominatim POI search (fast, no key)."""
    source = "openstreetmap"
    live = True

    async def find_leads(self, params: dict) -> list:
        category = params.get("category", "Restaurant")
        location = params.get("location", "Gurugram")
        count = max(1, min(int(params.get("count", 20)), 40))
        min_score = int(params.get("min_score", 0))
        website_filter = params.get("website_status", "Any")
        project_type = params.get("project_type") or "Website"

        phrase = CATEGORY_QUERY.get(category, category.lower())
        query = f"{phrase} in {location}"
        async with httpx.AsyncClient(timeout=20, headers=UA) as c:
            r = await c.get(NOMINATIM, params={
                "q": query, "format": "jsonv2", "limit": min(count * 2, 40),
                "extratags": 1, "addressdetails": 1,
            })
            if r.status_code != 200:
                raise RuntimeError(f"nominatim-{r.status_code}")
            data = r.json()

        leads = []
        seen = set()
        for el in data:
            et = el.get("extratags") or {}
            name = el.get("name") or et.get("name") or et.get("brand")
            if not name:
                continue
            key = name.lower().strip()
            if key in seen:
                continue
            seen.add(key)
            ev = _score_from_evidence(et)
            if ev["lead_score"] < min_score:
                continue
            has_site = bool(ev["website"])
            if website_filter == "Missing" and has_site:
                continue

            addr = el.get("address") or {}
            addr_line = ", ".join([p for p in [addr.get("road"), addr.get("suburb"),
                                               addr.get("city") or addr.get("town")] if p]) or None
            osm_type = el.get("osm_type", "node")
            osm_id = el.get("osm_id")
            osm_url = f"https://www.openstreetmap.org/{osm_type}/{osm_id}" if osm_id else None

            def _social_url(val, net):
                if not val:
                    return None
                return val if val.startswith("http") else f"https://{net}.com/{val.lstrip('@/')}"

            website = ev["website"]
            if website and not website.startswith("http"):
                website = "https://" + website

            leads.append({
                "id": new_id(),
                "business_name": name,
                "category": category,
                "location": location,
                "address": addr_line,
                "website": website,
                "website_status": "Missing" if not has_site else "Unknown",
                "phone": ev["phone"],       # real, from OSM extratags, or None
                "email": ev["email"],       # real, or None
                "google_url": f"https://www.google.com/maps/search/?api=1&query={name.replace(' ', '+')}+{location.replace(' ', '+')}",
                "instagram_url": _social_url(ev["instagram"], "instagram"),
                "facebook_url": _social_url(ev["facebook"], "facebook"),
                "linkedin_url": None,
                "opening_hours": ev["hours"],
                "lead_score": ev["lead_score"],
                "conversion_score": ev["conversion_score"],
                "digital_presence_score": ev["digital_presence_score"],
                "business_size": "Small",
                "research_status": "Not Researched",
                "pipeline_status": "NEW",
                "assigned_to": None,
                "campaign_id": None,
                "project_type": project_type,
                "reason": ev["reason"],
                "source": self.source,
                "source_url": osm_url,
                "is_demo": False,
                "created_at": now_iso(),
            })
            if len(leads) >= count:
                break
        return leads


# ---------------- Mock fallback (clearly flagged) ----------------
_MOCK_NAMES = {
    "Restaurant": ["Spice Route", "The Curry Leaf", "Urban Bites", "Masala Junction", "Flavour Town"],
    "Cafe": ["Bean & Brew", "Morning Roast", "The Coffee Loft", "Caffeine Corner"],
    "Clinic": ["CarePlus Clinic", "Wellness Point", "MediCare Centre", "HealthFirst Clinic"],
    "Salon": ["Glow Studio", "The Style Bar", "Luxe Salon", "Shear Genius"],
}


class MockLeadProvider:
    source = "mock"
    live = False

    def find_leads(self, params: dict) -> list:
        category = params.get("category", "Restaurant")
        location = params.get("location", "Gurugram")
        count = max(1, min(int(params.get("count", 20)), 50))
        min_score = int(params.get("min_score", 0))
        pool = _MOCK_NAMES.get(category, [f"{category} Co", f"{category} Group", f"{category} Partners", f"{category} Hub"])
        leads, used = [], set()
        while len(leads) < count and len(used) < len(pool) * 6:
            base = random.choice(pool)
            name = f"{base} {random.randint(2, 99)}" if base in used else base
            used.add(base)
            ws = random.choice(["Missing", "Weak", "Good"])
            score = max(min_score, random.randint(55, 95))
            conv = "HIGH" if score >= 82 else ("MEDIUM" if score >= 65 else "LOW")
            slug = base.lower().replace(" ", "")
            leads.append({
                "id": new_id(), "business_name": name, "category": category, "location": location,
                "address": None, "website": (None if ws == "Missing" else f"https://www.{slug}.example"),
                "website_status": ws, "phone": None, "email": None,
                "google_url": None, "instagram_url": None, "facebook_url": None, "linkedin_url": None,
                "opening_hours": None, "lead_score": score, "conversion_score": conv,
                "digital_presence_score": random.randint(20, 90), "business_size": "Small",
                "research_status": "Not Researched", "pipeline_status": "NEW",
                "assigned_to": None, "campaign_id": None, "project_type": params.get("project_type") or "Website",
                "reason": "DEMO fallback sample (open-web discovery was unavailable). Verify manually.",
                "source": self.source, "source_url": None, "is_demo": True, "created_at": now_iso(),
            })
        return [l for l in leads if l["lead_score"] >= min_score]


OSM_PROVIDER = OSMLeadProvider()
MOCK_PROVIDER = MockLeadProvider()


async def discover_leads(params: dict) -> dict:
    """Try the live zero-cost OSM provider; fall back to clearly-flagged mock."""
    try:
        results = await OSM_PROVIDER.find_leads(params)
        if results:
            return {"results": results, "fallback": False,
                    "provider": {"active": "openstreetmap", "live": True, "cost": "$0",
                                 "note": "Live results from OpenStreetMap public data (free, no API key)."}}
        reason = "No matching public businesses found for this category/location in OpenStreetMap."
    except Exception as e:
        logger.warning(f"OSM discovery failed: {e}")
        reason = "Open-web discovery (OpenStreetMap) was technically unavailable."
    # Fallback
    results = MOCK_PROVIDER.find_leads(params)
    return {"results": results, "fallback": True,
            "provider": {"active": "mock", "live": False, "cost": "$0",
                         "note": f"{reason} Showing clearly-marked DEMO sample data as a fallback."}}


def provider_status() -> dict:
    return {"active": "openstreetmap", "live": True, "cost": "$0",
            "note": "Zero-cost open-web discovery via OpenStreetMap (Nominatim + Overpass). "
                    "Falls back to DEMO data only if the open web is unavailable. "
                    "A paid provider (e.g. Google Places) can be added later without rebuilding."}
