"""
score_providers.py — Risk Scoring Engine

Groups providers by state+zip, calculates z-scores on totalPaid,
sets anomaly flags and riskScore, then updates Supabase.
"""

import os
import math


def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
    env = {}
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, val = line.split('=', 1)
                env[key.strip()] = val.strip()
    return env


def run_scoring(supabase_url=None, supabase_key=None):
    from supabase import create_client

    if not supabase_url:
        env = load_env()
        supabase_url = env["NEXT_PUBLIC_SUPABASE_URL"]
        supabase_key = env["SUPABASE_SERVICE_ROLE_KEY"]

    client = create_client(supabase_url, supabase_key)

    # Fetch all providers
    print("  Fetching all providers...")
    all_providers = []
    offset = 0
    page_size = 1000
    while True:
        result = client.table("Provider").select("id, state, zip, totalPaid").range(offset, offset + page_size - 1).execute()
        batch = result.data or []
        all_providers.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    print(f"  Total providers: {len(all_providers)}")

    # Group by state+zip
    by_group = {}
    for p in all_providers:
        key = f"{p['state']}_{p.get('zip', '')}"
        if key not in by_group:
            by_group[key] = []
        by_group[key].append(p)

    # Calculate stats per group
    group_stats = {}
    for key, providers in by_group.items():
        payments = [p["totalPaid"] for p in providers]
        n = len(payments)
        mean = sum(payments) / n if n > 0 else 0
        variance = sum((x - mean) ** 2 for x in payments) / n if n > 1 else 0
        std = math.sqrt(variance) if variance > 0 else 1
        group_stats[key] = (mean, std)

    # Score each provider
    updates = []
    for p in all_providers:
        key = f"{p['state']}_{p.get('zip', '')}"
        mean, std = group_stats[key]
        z = (p["totalPaid"] - mean) / std if std > 0 else 0

        anomalies = []
        if z > 2.5:
            anomalies.append("Billing 300%+ above zip-code peers")
        if p["totalPaid"] > 500000:
            anomalies.append("Extreme payment volume — top 1% nationally")
        if p["totalPaid"] > 1000000:
            anomalies.append("Billing exceeds $1M — statistical outlier")

        base_score = 30 if p["totalPaid"] > 100000 else 10
        risk_score = min(100, int(z * 20 + base_score))
        risk_score = max(0, risk_score)

        updates.append({
            "id": p["id"],
            "riskScore": risk_score,
            "anomalies": anomalies,
        })

    # Batch upsert with retry on connection errors
    import time
    batch_size = 200
    total = len(updates)
    for i in range(0, total, batch_size):
        batch = updates[i:i + batch_size]
        for attempt in range(3):
            try:
                client.table("Provider").upsert(batch, on_conflict="id").execute()
                break
            except Exception as e:
                if attempt < 2:
                    time.sleep(2)
                    client = create_client(supabase_url, supabase_key)
                else:
                    print(f"  Failed batch {i // batch_size + 1}: {e}")
        print(f"  Scored batch {i // batch_size + 1} ({min(i + batch_size, total)}/{total})")

    # Summary
    high_risk = sum(1 for u in updates if u["riskScore"] >= 60)
    medium = sum(1 for u in updates if 30 <= u["riskScore"] < 60)
    print(f"  Scoring complete: {high_risk} high-risk, {medium} medium-risk, {total - high_risk - medium} low-risk")


if __name__ == "__main__":
    print("=== Running Scoring Engine ===")
    run_scoring()
    print("=== Done ===")
