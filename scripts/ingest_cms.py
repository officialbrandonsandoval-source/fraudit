"""
ingest_cms.py — CMS Medicare Provider Payment Data Ingestion (California)

Downloads real CMS Medicare physician/supplier payment data for CA,
deduplicates by NPI, and upserts into Supabase Provider table.
Then runs the scoring engine.
"""

import os
import sys
import json
import requests


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


def fetch_cms_data():
    """Paginate through CMS API for CA providers (by Provider, 2022)."""
    base_url = "https://data.cms.gov/data-api/v1/dataset/8ba584c6-a43a-4b0b-a35a-eb9a59e3a571/data"
    all_records = []
    page_size = 5000

    for offset in range(0, 10000, page_size):
        params = {
            "filter[Rndrng_Prvdr_State_Abrvtn]": "CA",
            "size": page_size,
            "offset": offset,
        }
        print(f"  Fetching offset={offset}...")
        resp = requests.get(base_url, params=params, timeout=120)
        resp.raise_for_status()
        data = resp.json()

        if not data:
            break

        all_records.extend(data)
        print(f"  Got {len(data)} records (total: {len(all_records)})")

        if len(data) < page_size:
            break

    return all_records


def deduplicate_by_npi(records):
    """Group by NPI, sum payments, keep last address seen."""
    providers = {}
    for r in records:
        npi = r.get("Rndrng_NPI")
        if not npi:
            continue
        payment = float(r.get("Tot_Mdcr_Pymt_Amt") or 0)

        first = r.get("Rndrng_Prvdr_First_Name", "")
        last = r.get("Rndrng_Prvdr_Last_Org_Name", "")
        if first and last:
            name = f"{first} {last}"
        elif last:
            name = last
        else:
            name = "Unknown"

        if npi in providers:
            providers[npi]["totalPaid"] += payment
        else:
            providers[npi] = {
                "name": name,
                "address": r.get("Rndrng_Prvdr_St1", ""),
                "city": r.get("Rndrng_Prvdr_City", ""),
                "state": r.get("Rndrng_Prvdr_State_Abrvtn", "CA"),
                "zip": r.get("Rndrng_Prvdr_Zip5", ""),
                "totalPaid": payment,
            }

    return providers


def upsert_to_supabase(providers, supabase_url, supabase_key):
    """Upsert providers into Supabase Provider table."""
    from supabase import create_client
    client = create_client(supabase_url, supabase_key)

    from cuid2 import cuid_wrapper
    cuid_generate = cuid_wrapper()

    rows = []
    for npi, p in providers.items():
        rows.append({
            "id": cuid_generate(),
            "name": p["name"],
            "address": p["address"],
            "city": p["city"],
            "state": p["state"],
            "zip": p["zip"],
            "programs": ["Medicare"],
            "totalPaid": round(p["totalPaid"], 2),
            "riskScore": 0,
            "anomalies": [],
        })

    # Batch upsert in chunks of 500
    batch_size = 500
    total = len(rows)
    for i in range(0, total, batch_size):
        batch = rows[i:i + batch_size]
        client.table("Provider").insert(batch).execute()
        print(f"  Inserted batch {i // batch_size + 1} ({min(i + batch_size, total)}/{total})")

    return total


def main():
    env = load_env()
    supabase_url = env["NEXT_PUBLIC_SUPABASE_URL"]
    supabase_key = env["SUPABASE_SERVICE_ROLE_KEY"]

    print("=== CMS Medicare Data Ingestion (California) ===")
    print()

    # Step 1: Fetch
    print("[1/4] Fetching CMS Medicare provider payment data for CA...")
    records = fetch_cms_data()
    print(f"  Total raw records: {len(records)}")
    print()

    # Step 2: Deduplicate
    print("[2/4] Deduplicating by NPI...")
    providers = deduplicate_by_npi(records)
    print(f"  Unique providers: {len(providers)}")
    print()

    # Step 3: Upsert
    print("[3/4] Upserting into Supabase...")
    count = upsert_to_supabase(providers, supabase_url, supabase_key)
    print(f"  Inserted {count} providers")
    print()

    # Step 4: Run scoring
    print("[4/4] Running scoring engine...")
    sys.path.insert(0, os.path.dirname(__file__))
    from score_providers import run_scoring
    run_scoring(supabase_url, supabase_key)

    print()
    print("=== Ingestion complete ===")


if __name__ == "__main__":
    main()
