"""
Public web research — ZERO-COST, no API keys.

Gathers ONLY publicly available information and clearly separates what was
actually observed (verified_facts) from anything the AI later infers.

  * fetch_website_signals(url) — server-side HTTPS GET of a business's own
    public homepage (httpx) + HTML inspection (BeautifulSoup). Reports whether
    the site loads, its title/description, whether booking/contact forms exist,
    tel:/mailto: links actually present, and lightweight tech hints. Includes a
    basic SSRF guard.

  * web_search(query) — best-effort free DuckDuckGo search via the `ddgs`
    library (no key). Returns real result URLs/snippets. Wrapped so any failure
    degrades gracefully to []. Never fabricates results.

ZERO FABRICATION: contact details are only taken from tel:/mailto: links or
explicitly present values. Nothing is invented. Missing => "Not found".
"""
import asyncio
import socket
import logging
from ipaddress import ip_address
from urllib.parse import urlparse
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger("virtelon.research")
UA = {"User-Agent": "VirtelonCommandCentre/1.0 (internal research; contact team@virtelon.com)"}


def _is_public_host(hostname: str) -> bool:
    host = (hostname or "").lower().rstrip(".")
    if not host or host in {"localhost"} or host.endswith(".local") or host.endswith(".internal"):
        return False
    try:
        infos = socket.getaddrinfo(host, None)
        for row in infos:
            ip = ip_address(row[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return False
        return True
    except Exception:
        return False


def _valid_url(url: str) -> bool:
    p = urlparse(url)
    return p.scheme in ("http", "https") and bool(p.hostname) and _is_public_host(p.hostname)


async def fetch_website_signals(url: str) -> dict:
    if not url:
        return {"provided": False}
    if not url.startswith("http"):
        url = "https://" + url
    if not _valid_url(url):
        return {"provided": True, "site_loaded": False, "error": "URL not allowed / not public"}
    timeout = httpx.Timeout(12.0, connect=5.0)
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, max_redirects=5, headers=UA) as c:
            r = await c.get(url)
        html = r.text or ""
        soup = BeautifulSoup(html, "html.parser")
        title = soup.title.get_text(" ", strip=True) if soup.title else None
        desc_tag = soup.find("meta", attrs={"name": lambda x: x and x.lower() == "description"})
        description = (desc_tag.get("content") or "").strip() if desc_tag else None
        links = [(a.get("href") or "").lower() for a in soup.find_all("a")]
        forms_text = " ".join(f.get_text(" ", strip=True).lower() + " " + str(f.attrs).lower() for f in soup.find_all("form"))
        low = html.lower()
        tel_links = [l for l in links if l.startswith("tel:")]
        mail_links = [l for l in links if l.startswith("mailto:")]
        socials = {}
        for a in links:
            for net in ("instagram.com", "facebook.com", "linkedin.com", "twitter.com", "x.com", "youtube.com"):
                if net in a and net not in socials:
                    socials[net] = a
        return {
            "provided": True,
            "site_loaded": r.is_success,
            "http_status": r.status_code,
            "final_url": str(r.url),
            "title": title,
            "meta_description": description,
            "has_booking_form": any(t in forms_text for t in ("book", "appointment", "reserve", "reservation", "schedule")),
            "has_contact_form": ("form" in forms_text and any(t in forms_text for t in ("contact", "message", "inquiry", "enquiry"))),
            "public_phone_on_site": tel_links[0].replace("tel:", "") if tel_links else None,
            "public_email_on_site": mail_links[0].replace("mailto:", "") if mail_links else None,
            "social_links_on_site": socials,
            "tech_hints": {
                "wordpress": "wp-content" in low or "wp-json" in low,
                "react_or_next": "_next/static" in low or "react" in low,
                "shopify": "cdn.shopify.com" in low,
                "wix": "wix.com" in low or "wixstatic" in low,
            },
        }
    except Exception as e:
        logger.info(f"website fetch failed for {url}: {type(e).__name__}")
        return {"provided": True, "site_loaded": False, "error": type(e).__name__}


def _ddg_sync(query: str, max_results: int = 6) -> list:
    try:
        from ddgs import DDGS
        with DDGS() as ddgs:
            out = []
            for r in ddgs.text(query, max_results=max_results):
                out.append({"title": r.get("title"), "url": r.get("href") or r.get("url"),
                            "snippet": r.get("body") or r.get("snippet")})
            return out
    except Exception as e:
        logger.info(f"ddg search unavailable: {type(e).__name__}")
        return []


async def web_search(query: str, max_results: int = 6) -> list:
    if not query:
        return []
    try:
        return await asyncio.to_thread(_ddg_sync, query, max_results)
    except Exception:
        return []


async def gather_public_info(lead: dict) -> dict:
    """Collect verified public facts for a lead. Real data only."""
    name = lead.get("business_name", "")
    location = lead.get("location", "")
    website = lead.get("website")

    website_signals, search_results = await asyncio.gather(
        fetch_website_signals(website) if website else _noop(),
        web_search(f"{name} {location}") if name else _noop_list(),
    )

    # Discover a likely official site / socials from search results if the lead lacks them
    discovered = {"website": None, "socials": {}}
    if not website:
        for res in search_results:
            u = (res.get("url") or "")
            host = urlparse(u).hostname or ""
            if any(net in host for net in ("instagram.com", "facebook.com", "linkedin.com")):
                for net in ("instagram.com", "facebook.com", "linkedin.com"):
                    if net in host and net not in discovered["socials"]:
                        discovered["socials"][net] = u
            elif host and not any(s in host for s in ("google.", "justdial", "tripadvisor", "zomato", "yelp",
                                                      "facebook", "instagram", "youtube", "wikipedia", "indiamart")):
                if discovered["website"] is None:
                    discovered["website"] = u

    return {
        "website": website_signals,
        "search_results": search_results,
        "discovered": discovered,
        "osm_source": lead.get("source_url"),
    }


async def _noop():
    return {"provided": False}


async def _noop_list():
    return []
