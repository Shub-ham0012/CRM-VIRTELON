"""
Lead discovery provider abstraction — ZERO-COST / open-web only.

Free multi-source discovery (no API keys, no billing):

  * OSMLeadProvider — OpenStreetMap Nominatim POI search. Real public business
    data (name, website, phone, email, socials, address) with an openstreetmap.org
    source_url on every result.

  * DuckDuckGoLeadProvider — free open-web search top-up used when OSM returns
    too few results. Each candidate is verified by fetching its public website
    (must be reachable, non-listicle, location-relevant); the search-result URL
    is kept as the source. Aggregators/directories/social/bot-check pages are
    filtered out.

  * MockLeadProvider — DEMO data. Returned ONLY via the explicit "Load Demo Data"
    action (`demo_leads()` / POST /api/leads/find-demo), never auto-injected.

`discover_leads()` runs OSM then tops up with DuckDuckGo, deduplicates by domain
and normalized name, and returns ONLY verified live results (each with a source
URL). If nothing can be verified it returns `no_results=True` — it never fills
the list with demo data. A future paid provider (e.g. Google Places) can be added
as another class without touching the rest of the app.

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


# ---------------- DuckDuckGo open-web provider (live, free) ----------------
import re
from urllib.parse import urlparse
import web_research

# Directories / aggregators / social / listing sites — real, but not an individual business's own site.
AGGREGATOR_HOSTS = {
    "zomato.com", "swiggy.com", "justdial.com", "tripadvisor.com", "tripadvisor.in",
    "yelp.com", "google.com", "google.co.in", "goo.gl", "maps.google.com", "facebook.com",
    "instagram.com", "twitter.com", "x.com", "youtube.com", "linkedin.com", "wikipedia.org",
    "magicpin.in", "dineout.co.in", "practo.com", "sulekha.com", "indiamart.com",
    "yellowpages.in", "quora.com", "reddit.com", "pinterest.com", "amazon.in", "flipkart.com",
    "bing.com", "duckduckgo.com", "medium.com", "blogspot.com", "wordpress.com",
    # business directories / listicle sites
    "aeroleads.com", "f6s.com", "companydetails.in", "vendorlist.in", "pharmchoices.com",
    "clickedindia.net", "crunchbase.com", "glassdoor.com", "glassdoor.co.in", "ambitionbox.com",
    "tofler.in", "zaubacorp.com", "indiacom.com", "exportersindia.com", "tradeindia.com",
    "grotal.com", "indiabizclub.com", "startupindia.gov.in", "thecompanycheck.com",
    "yellowpages.com", "cybo.com", "bizapedia.com", "manta.com", "6sense.com", "growjo.com",
    "clutch.co", "goodfirms.co", "trustpilot.com", "mouthshut.com", "asklaila.com",
    "instagram.com", "wellfound.com", "apollo.io", "rocketreach.co", "linkedin.cn",
}

BAD_TITLE = re.compile(
    r"(just a moment|checking your browser|attention required|access denied|are you a robot|"
    r"forbidden|not found|error\s*[45]\d\d|page not found|verify you are human|cloudflare)",
    re.I)
LISTICLE = re.compile(
    r"(^\s*\d+\b)|(\btop\s+\d)|(\btop\b.*\b(companies|firms|businesses|restaurants|cafes|clinics))|"
    r"(\bbest\b.*\bin\b)|(\blist of\b)|(companies in)|(suppliers? in)|(manufacturers? in)|"
    r"(\bdirectory\b)|(near me)|(near you)|(dealers? in)", re.I)


def _host(url: str) -> str:
    try:
        h = (urlparse(url).hostname or "").lower()
        return h[4:] if h.startswith("www.") else h
    except Exception:
        return ""


def _is_aggregator(host: str) -> bool:
    return any(host == a or host.endswith("." + a) for a in AGGREGATOR_HOSTS)


def _clean_name(title: str, host: str) -> str:
    if not title:
        return host.split(".")[0].title()
    name = re.split(r"\s*[|\-–—:•·]\s*", title)[0].strip()
    for junk in ("Home", "Welcome", "Official Website", "Homepage"):
        if name.lower() == junk.lower():
            name = title.strip()
            break
    return (name[:80] or host.split(".")[0].title()).strip()


class DuckDuckGoLeadProvider:
    """Live discovery from free open-web search results (each result is real public-web evidence)."""
    source = "duckduckgo"
    live = True

    async def find_leads(self, params: dict) -> list:
        category = params.get("category", "business")
        location = params.get("location", "")
        count = max(1, min(int(params.get("count", 20)), 40))
        min_score = int(params.get("min_score", 0))
        project_type = params.get("project_type") or "Website"

        queries = [
            f"{category} in {location}",
            f"best {category} in {location} official website",
            f"{category} {location} contact",
        ]
        candidates = {}  # host -> {url, title}
        loc_token = ""
        if location:
            loc_token = location.split(",")[0].strip().split()[0].lower()
        for q in queries:
            for r in await web_research.web_search(q, 12):
                url = r.get("url") or ""
                host = _host(url)
                if not host or _is_aggregator(host) or host in candidates:
                    continue
                # Location relevance: the searched location must appear in the result evidence.
                blob = f"{r.get('title') or ''} {url} {r.get('snippet') or ''}".lower()
                if loc_token and loc_token not in blob:
                    continue
                candidates[host] = {"url": url, "title": r.get("title")}
            if len(candidates) >= count * 2:
                break
        if not candidates:
            return []

        items = list(candidates.items())[:10]  # bound enrichment work / time
        # Enrich concurrently by fetching each candidate's public site (real evidence).
        sem = asyncio.Semaphore(6)

        async def enrich(host, meta):
            async with sem:
                try:
                    sig = await asyncio.wait_for(web_research.fetch_website_signals(meta["url"]), timeout=10)
                except Exception:
                    sig = {"site_loaded": False}
            return host, meta, sig

        enriched = await asyncio.gather(*[enrich(h, m) for h, m in items], return_exceptions=True)

        leads = []
        for row in enriched:
            if isinstance(row, Exception):
                continue
            host, meta, sig = row
            # Require a reachable site with a sensible, non-listicle title (real evidence).
            if not sig.get("site_loaded"):
                continue
            title_raw = sig.get("title") or meta.get("title") or ""
            if not title_raw or BAD_TITLE.search(title_raw):
                continue
            name = (sig.get("site_name") or _clean_name(title_raw, host)).strip()
            if len(name) < 2 or LISTICLE.search(name) or LISTICLE.search(title_raw):
                continue
            socials = sig.get("social_links_on_site") or {}
            phone = sig.get("public_phone_on_site")
            email = sig.get("public_email_on_site")

            digital = 55 + (15 if phone else 0) + (15 if socials else 0) + (10 if email else 0)
            score = 66 + (6 if phone else 0) + (4 if email else 0) + (5 if socials else 0)
            score = max(45, min(score, 94))
            if score < min_score:
                continue
            conv = "HIGH" if score >= 80 else ("MEDIUM" if score >= 65 else "LOW")

            leads.append({
                "id": new_id(), "business_name": name, "category": category, "location": location,
                "address": None,
                "website": sig.get("final_url") or meta["url"],
                "website_status": "Good",
                "phone": phone, "email": email,
                "google_url": f"https://www.google.com/maps/search/?api=1&query={name.replace(' ', '+')}+{location.replace(' ', '+')}",
                "instagram_url": socials.get("instagram.com"),
                "facebook_url": socials.get("facebook.com"),
                "linkedin_url": socials.get("linkedin.com"),
                "opening_hours": None,
                "lead_score": score, "conversion_score": conv, "digital_presence_score": min(digital, 100),
                "business_size": "Small", "research_status": "Not Researched", "pipeline_status": "NEW",
                "assigned_to": None, "campaign_id": None, "project_type": project_type,
                "reason": "Found via open-web search; verified public website reachable"
                          + (", public phone on site" if phone else "")
                          + (", active social links" if socials else "") + ".",
                "source": self.source, "source_url": meta["url"], "is_demo": False, "created_at": now_iso(),
            })
            if len(leads) >= count:
                break
        return leads


DDG_PROVIDER = DuckDuckGoLeadProvider()


def _norm_name(n: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (n or "").lower())


async def discover_leads(params: dict) -> dict:
    """Free multi-source discovery. OSM first, then open-web search top-up.
    Returns ONLY verified live results (source_url each). Never fills with demo data."""
    count = max(1, min(int(params.get("count", 20)), 40))
    results, sources_used = [], []
    seen_domains, seen_names = set(), set()

    def _add(batch):
        for l in batch:
            dom = _host(l.get("website") or "")
            nm = _norm_name(l.get("business_name"))
            if (dom and dom in seen_domains) or (nm and nm in seen_names):
                continue
            if dom:
                seen_domains.add(dom)
            if nm:
                seen_names.add(nm)
            results.append(l)

    # 1) OpenStreetMap
    try:
        osm = await OSM_PROVIDER.find_leads(params)
        if osm:
            sources_used.append("openstreetmap")
            _add(osm)
    except Exception as e:
        logger.warning(f"OSM discovery failed: {e}")

    # 2) Open-web search top-up if insufficient
    if len(results) < count:
        try:
            ddg = await DDG_PROVIDER.find_leads({**params, "count": (count - len(results)) + 5})
            if ddg:
                sources_used.append("duckduckgo")
                _add(ddg)
        except Exception as e:
            logger.warning(f"DDG discovery failed: {e}")

    results = results[:count]

    if not results:
        return {"results": [], "no_results": True, "sources_used": [],
                "provider": {"active": "none", "live": True, "cost": "$0",
                             "note": "No verified live results found from OpenStreetMap or open-web search "
                                     "for this category and location. Try a broader location or different category."}}
    label = " + ".join({"openstreetmap": "OpenStreetMap", "duckduckgo": "open-web search"}[s] for s in sources_used)
    return {"results": results, "no_results": False, "sources_used": sources_used,
            "provider": {"active": "+".join(sources_used), "live": True, "cost": "$0",
                         "note": f"Live results from {label} (free, no API key). Every result carries its source URL."}}


def demo_leads(params: dict) -> list:
    """Explicit DEMO data — only returned via the 'Load Demo Data' action, never auto-injected."""
    return MOCK_PROVIDER.find_leads(params)


def provider_status() -> dict:
    return {"active": "openstreetmap + open-web search", "live": True, "cost": "$0",
            "note": "Zero-cost multi-source discovery: OpenStreetMap Nominatim first, then free open-web "
                    "(DuckDuckGo) top-up. Only verified public-web results are shown (each with a source URL); "
                    "if none are found it says so rather than showing demo data. A paid provider (e.g. Google "
                    "Places) can be added later via the same abstraction without rebuilding."}
