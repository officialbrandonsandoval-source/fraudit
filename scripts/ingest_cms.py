"""
ingest_cms.py — CMS Medicare Provider Payment Data Ingestion (ALL 50 STATES)

Downloads real CMS Medicare physician/supplier payment data for every US state,
deduplicates by NPI, scores each provider, and upserts into Supabase.
"""

import os
import sys
import time
import requests


ALL_STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
    "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
    "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
    "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"
]

CMS_BASE_URL = "https://data.cms.gov/data-api/v1/dataset/8ba584c6-a43a-4b0b-a35a-eb9a59e3a571/data"
PAGE_SIZE = 5000


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


def fetch_state(state: str) -> list:
    """Paginate through ALL records for a given state — no page cap."""
    all_records = []
    offset = 0

    while True:
        params = {
            "filter[Rndrng_Prvdr_State_Abrvtn]": state,
            "size": PAGE_SIZE,
            "offset": offset,
        }
        try:
            resp = requests.get(CMS_BASE_URL, params=params, timeout=120)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"    ⚠ Error at offset {offset}: {e} — retrying once...")
            time.sleep(5)
            try:
                resp = requests.get(CMS_BASE_URL, params=params, timeout=120)
                data = resp.json()
            except Exception as e2:
                print(f"    ✗ Failed again: {e2} — skipping page")
                break

        if not data:
            break

        all_records.extend(data)
        offset += PAGE_SIZE

        if len(data) < PAGE_SIZE:
            break

    return all_records


def deduplicate_by_npi(records: list, default_state: str) -> dict:
    """Group by NPI, sum payments, keep last address seen."""
    providers = {}
    for r in records:
        npi = r.get("Rndrng_NPI")
        if not npi:
            continue
        payment = float(r.get("Tot_Mdcr_Pymt_Amt") or 0)

        first = r.get("Rndrng_Prvdr_First_Name", "")
        last = r.get("Rndrng_Prvdr_Last_Org_Name", "")
        name = f"{first} {last}".strip() if (first or last) else "Unknown"

        if npi in providers:
            providers[npi]["totalPaid"] += payment
        else:
            providers[npi] = {
                "name": name,
                "address": r.get("Rndrng_Prvdr_St1", ""),
                "city": r.get("Rndrng_Prvdr_City", ""),
                "state": r.get("Rndrng_Prvdr_State_Abrvtn", default_state),
                "zip": str(r.get("Rndrng_Prvdr_Zip5", "") or ""),
                "totalPaid": payment,
            }

    return providers


def upsert_to_supabase(providers: dict, client) -> int:
    """Upsert providers into Supabase Provider table in batches of 500."""
    import uuid
    rows = []
    for npi, p in providers.items():
        rows.append({
            "id": str(uuid.uuid4()),
            "name": p["name"][:255],
            "address": p["address"][:255],
            "city": p["city"][:100],
            "state": p["state"][:2],
            "zip": p["zip"][:10],
            "programs": ["Medicare"],
            "totalPaid": round(p["totalPaid"], 2),
            "riskScore": 0,
            "anomalies": [],
        })

    batch_size = 500
    total = len(rows)
    for i in range(0, total, batch_size):
        batch = rows[i:i + batch_size]
        client.table("Provider").upsert(batch, on_conflict="id").execute()

    return total


def main():
    env = load_env()
    supabase_url = env["NEXT_PUBLIC_SUPABASE_URL"]
    supabase_key = env["SUPABASE_SERVICE_ROLE_KEY"]

    from supabase import create_client
    client = create_client(supabase_url, supabase_key)

    print("=" * 60)
    print("  CMS Medicare Data Ingestion — ALL 50 STATES")
    print("=" * 60)
    print()

    grand_total_records = 0
    grand_total_providers = 0

    for i, state in enumerate(ALL_STATES, 1):
        print(f"[{i:02d}/{len(ALL_STATES)}] {state} — fetching...", end="", flush=True)

        records = fetch_state(state)
        providers = deduplicate_by_npi(records, state)
        count = upsert_to_supabase(providers, client)

        grand_total_records += len(records)
        grand_total_providers += count

        total_paid = sum(p["totalPaid"] for p in providers.values())
        print(f" {count} providers | ${total_paid:,.0f} total")

    print()
    print(f"Ingestion complete: {grand_total_providers:,} unique providers across all states")
    print(f"Raw records processed: {grand_total_records:,}")
    print()

    # Run scoring engine on everything
    print("Running scoring engine on all providers...")
    sys.path.insert(0, os.path.dirname(__file__))
    from score_providers import run_scoring
    run_scoring(supabase_url, supabase_key)

    print()
    print("=" * 60)
    print("  ALL DONE")
    print("=" * 60)


if __name__ == "__main__":
    main()
