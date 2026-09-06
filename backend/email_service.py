"""Outreach email sending via Resend. Server-side only; RESEND_API_KEY never reaches the frontend."""
import os
import httpx

RESEND_API_URL = "https://api.resend.com/emails"
DEFAULT_FROM = "Virtelon Command Centre <onboarding@resend.dev>"


async def send_email(to: str, subject: str, html: str) -> dict:
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        raise RuntimeError("Email sending is not configured (RESEND_API_KEY missing)")
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"from": DEFAULT_FROM, "to": to, "subject": subject, "html": html},
        )
    if r.status_code >= 400:
        raise RuntimeError(f"Resend error {r.status_code}: {r.text}")
    return r.json()
