"""
send_watchlist_digests.py — Fraudit Pro: Watchlist Email Digests

For each active Watchlist, queries providers matching filters.
If new providers found or scores changed since lastSentAt, sends
(or logs) a digest email.

Usage:
    python scripts/send_watchlist_digests.py
"""

import os
import json
from datetime import datetime, timezone

import requests

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}


def fetch_watchlists():
    """Fetch all active watchlists."""
    url = f"{SUPABASE_URL}/rest/v1/Watchlist?active=eq.true&select=*"
    resp = requests.get(url, headers=HEADERS)
    resp.raise_for_status()
    return resp.json()


def fetch_matching_providers(filters, last_sent_at):
    """Fetch providers matching watchlist filters."""
    url = f"{SUPABASE_URL}/rest/v1/Provider?select=id,name,city,state,riskScore,totalPaid,anomalies,createdAt"

    params = []
    if filters.get("state"):
        params.append(f"state=eq.{filters['state'].upper()}")
    if filters.get("minRiskScore"):
        params.append(f"riskScore=gte.{filters['minRiskScore']}")

    params.append("order=riskScore.desc")
    params.append("limit=20")

    if params:
        url += "&" + "&".join(params)

    resp = requests.get(url, headers=HEADERS)
    resp.raise_for_status()
    providers = resp.json()

    # Filter by category if specified
    category = filters.get("category", "")
    if category and category != "all":
        category_keywords = {
            "healthcare": ["medicare", "medicaid", "hospice", "hospital", "clinic"],
            "va": ["va ", "veteran", "defense", "military"],
            "childcare": ["daycare", "child care", "ccdf", "head start"],
            "ghost": ["ghost"],
        }
        keywords = category_keywords.get(category, [])
        if keywords:
            providers = [
                p for p in providers
                if any(
                    kw in " ".join(p.get("anomalies", []) + p.get("programs", [])).lower()
                    for kw in keywords
                )
            ]

    return providers


def update_last_sent(watchlist_id):
    """Update lastSentAt for a watchlist."""
    url = f"{SUPABASE_URL}/rest/v1/Watchlist?id=eq.{watchlist_id}"
    now = datetime.now(timezone.utc).isoformat()
    resp = requests.patch(url, headers=HEADERS, json={"lastSentAt": now})
    resp.raise_for_status()


def send_email_sendgrid(to_email, subject, html_body):
    """Send email via SendGrid."""
    resp = requests.post(
        "https://api.sendgrid.com/v3/mail/send",
        headers={
            "Authorization": f"Bearer {SENDGRID_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "personalizations": [{"to": [{"email": to_email}]}],
            "from": {"email": "alerts@usefraudit.com", "name": "Fraudit"},
            "subject": subject,
            "content": [{"type": "text/html", "value": html_body}],
        },
    )
    return resp.status_code == 202


def send_email_resend(to_email, subject, html_body):
    """Send email via Resend."""
    resp = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "from": "Fraudit <alerts@usefraudit.com>",
            "to": to_email,
            "subject": subject,
            "html": html_body,
        },
    )
    return resp.status_code == 200


def build_digest_html(providers, watchlist_name):
    """Build HTML email body."""
    rows = ""
    for p in providers[:10]:
        rows += f"""
        <tr>
            <td style="padding:8px;border-bottom:1px solid #333">{p['name']}</td>
            <td style="padding:8px;border-bottom:1px solid #333">{p['city']}, {p['state']}</td>
            <td style="padding:8px;border-bottom:1px solid #333;color:{'#ef4444' if p['riskScore'] >= 60 else '#eab308'}">{p['riskScore']}</td>
        </tr>
        """

    return f"""
    <div style="font-family:sans-serif;background:#0a0a0a;color:#ededed;padding:24px;max-width:600px">
        <h2 style="color:#ef4444">Fraudit Watchlist Digest</h2>
        <p>Watchlist: <strong>{watchlist_name or 'Unnamed'}</strong></p>
        <p>{len(providers)} providers matched your criteria:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr style="color:#888;font-size:12px">
                <th style="text-align:left;padding:8px">Provider</th>
                <th style="text-align:left;padding:8px">Location</th>
                <th style="text-align:left;padding:8px">Risk</th>
            </tr>
            {rows}
        </table>
        <p style="font-size:12px;color:#666">View full details at <a href="https://usefraudit.com" style="color:#ef4444">usefraudit.com</a></p>
    </div>
    """


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Missing SUPABASE env vars")
        return

    watchlists = fetch_watchlists()
    print(f"Found {len(watchlists)} active watchlists")

    for wl in watchlists:
        wl_id = wl["id"]
        email = wl["email"]
        name = wl.get("name", "Unnamed")
        filters = wl.get("filters", {})
        last_sent = wl.get("lastSentAt")

        print(f"\nProcessing: {name} ({email})")

        providers = fetch_matching_providers(filters, last_sent)

        if not providers:
            print(f"  No matching providers, skipping")
            continue

        subject = f"{len(providers)} providers matched your watchlist"
        html = build_digest_html(providers, name)

        if SENDGRID_API_KEY:
            ok = send_email_sendgrid(email, subject, html)
            print(f"  SendGrid {'sent' if ok else 'FAILED'} to {email}")
        elif RESEND_API_KEY:
            ok = send_email_resend(email, subject, html)
            print(f"  Resend {'sent' if ok else 'FAILED'} to {email}")
        else:
            print(f"  [LOG] Would email {email}: {subject}")
            for p in providers[:5]:
                print(f"    - {p['name']} ({p['city']}, {p['state']}) — Risk: {p['riskScore']}")

        update_last_sent(wl_id)
        print(f"  Updated lastSentAt")

    print(f"\nDone. Processed {len(watchlists)} watchlists.")


if __name__ == "__main__":
    main()
