"""
generate_story_feed.py — Fraudit Pro: Story Feed Generator

Finds providers with the highest risk score changes and notable anomalies,
then writes top 10 to StoryFeed table (top 5 auto-published).

Usage:
    python scripts/generate_story_feed.py
"""

import os
import json
from datetime import datetime, timezone

import requests

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


def fetch_high_risk_providers():
    """Fetch providers with highest risk scores."""
    url = (
        f"{SUPABASE_URL}/rest/v1/Provider"
        "?select=id,name,city,state,riskScore,anomalies,billingHistory,totalPaid"
        "&riskScore=gte.50"
        "&order=riskScore.desc"
        "&limit=200"
    )
    resp = requests.get(url, headers=HEADERS)
    resp.raise_for_status()
    return resp.json()


def compute_billing_delta(billing_history):
    """Compute year-over-year billing change percentage."""
    if not billing_history or not isinstance(billing_history, list):
        return None
    sorted_bh = sorted(billing_history, key=lambda x: x.get("year", 0))
    if len(sorted_bh) < 2:
        return None
    latest = sorted_bh[-1].get("amount", 0)
    prev = sorted_bh[-2].get("amount", 0)
    if prev == 0:
        return None
    return ((latest - prev) / prev) * 100


def classify_signal(anomalies, delta):
    """Classify the type of signal."""
    anomaly_text = " ".join(anomalies).lower()
    if "ghost" in anomaly_text:
        return "ghost"
    if "debarr" in anomaly_text:
        return "debarred"
    if delta and abs(delta) > 100:
        return "billing_spike"
    return "default"


def generate_headline(provider, signal_type, delta):
    """Generate a headline for the signal."""
    name = provider["name"]
    city = provider["city"]
    state = provider["state"]

    if signal_type == "ghost":
        return f"Ghost operation signal: {name} in {city}, {state}"
    if signal_type == "debarred":
        return f"Debarred entity alert: {name} in {city}, {state}"
    if signal_type == "billing_spike" and delta:
        direction = "surge" if delta > 0 else "drop"
        return f"Billing {direction}: {name} ({city}, {state})"
    return f"High risk flagged: {name} ({city}, {state})"


def generate_detail(provider, delta):
    """Generate detail text."""
    parts = []
    if provider.get("anomalies"):
        parts.append(provider["anomalies"][0])
    if delta:
        parts.append(f"Year-over-year billing change: {delta:+.1f}%")
    parts.append(f"Risk score: {provider['riskScore']}/100")
    return " | ".join(parts)


def upsert_story(story):
    """Insert a story into StoryFeed."""
    url = f"{SUPABASE_URL}/rest/v1/StoryFeed"
    resp = requests.post(url, headers=HEADERS, json=story)
    resp.raise_for_status()
    return resp.json()


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Missing SUPABASE env vars")
        return

    providers = fetch_high_risk_providers()
    print(f"Fetched {len(providers)} high-risk providers")

    # Score each provider for story-worthiness
    candidates = []
    for p in providers:
        delta = compute_billing_delta(p.get("billingHistory"))
        anomalies = p.get("anomalies", [])

        # Prioritize ghost operations and debarred entities
        score = p["riskScore"]
        anomaly_text = " ".join(anomalies).lower()
        if "ghost" in anomaly_text:
            score += 30
        if "debarr" in anomaly_text:
            score += 25
        if delta and abs(delta) > 100:
            score += 20
        if "billing spike" in anomaly_text:
            score += 15

        signal_type = classify_signal(anomalies, delta)
        headline = generate_headline(p, signal_type, delta)
        detail = generate_detail(p, delta)

        candidates.append({
            "provider": p,
            "score": score,
            "signal_type": signal_type,
            "headline": headline,
            "detail": detail,
            "delta": delta,
        })

    # Sort by score descending, take top 10
    candidates.sort(key=lambda x: x["score"], reverse=True)
    top10 = candidates[:10]

    print(f"\nGenerating {len(top10)} story feed entries:")

    for i, c in enumerate(top10):
        published = i < 5  # Auto-publish top 5
        story = {
            "type": c["signal_type"],
            "providerId": c["provider"]["id"],
            "headline": c["headline"],
            "detail": c["detail"],
            "delta": c["delta"],
            "published": published,
            "detectedAt": datetime.now(timezone.utc).isoformat(),
        }

        result = upsert_story(story)
        status = "PUBLISHED" if published else "draft"
        print(f"  [{status}] {c['headline']}")

    print(f"\nDone. {min(5, len(top10))} published, {max(0, len(top10) - 5)} draft.")


if __name__ == "__main__":
    main()
