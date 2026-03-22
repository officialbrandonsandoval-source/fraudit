"""
ingest_va.py — VA (Veterans Affairs) Contractor Fraud Detection

Pulls VA contract award data from USASpending.gov API, detects shell company
fraud signals, and upserts into Provider table.

Usage:
    python scripts/ingest_va.py
"""

import os
import sys
import time
import json
import uuid
import hashlib
import requests
from collections import defaultdict


USASPENDING_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/"
PAGE_LIMIT = 100
TARGET_RECORDS = 10000

GENERIC_NAME_PATTERNS = ["solutions", "services", "holdings", "group", "llc"]


def load_env():
    for fname in ['.env.local', '.env']:
        env_path = os.path.join(os.path.dirname(__file__), '..', fname)
        if os.path.exists(env_path):
            env = {}
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, val = line.split('=', 1)
                        env[key.strip()] = val.strip().strip('"')
            return env
    print("No .env.local or .env found")
    sys.exit(1)


def make_stable_id(name: str, address: str, state: str) -> str:
    """Create a deterministic ID from name+address+state."""
    raw = f"va:{name}:{address}:{state}".lower().strip()
    return hashlib.sha256(raw.encode()).hexdigest()[:25]


def fetch_va_awards(page: int = 1) -> dict:
    """Fetch a page of VA contract awards from USASpending.gov."""
    payload = {
        "filters": {
            "agencies": [
                {
                    "type": "awarding",
                    "tier": "toptier",
                    "name": "Department of Veterans Affairs"
                }
            ],
            "award_type_codes": ["A", "B", "C", "D"],
            "time_period": [
                {"start_date": "2022-10-01", "end_date": "2025-09-30"}
            ]
        },
        "fields": [
            "Award ID",
            "Recipient Name",
            "recipient_id",
            "Award Amount",
            "Total Outlayed Amount",
            "Description",
            "Place of Performance City Code",
            "Place of Performance State Code",
            "Place of Performance Zip5",
            "Recipient Address Line 1",
            "Recipient City Code",
            "Recipient State Code",
            "Recipient Zip 5-digit",
            "Recipient DUNS Number"
        ],
        "page": page,
        "limit": PAGE_LIMIT,
        "sort": "Award Amount",
        "order": "desc"
    }

    try:
        resp = requests.post(USASPENDING_URL, json=payload, timeout=120)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"  Error fetching page {page}: {e}")
        time.sleep(5)
        try:
            resp = requests.post(USASPENDING_URL, json=payload, timeout=120)
            resp.raise_for_status()
            return resp.json()
        except Exception as e2:
            print(f"  Failed again: {e2}")
            return {"results": [], "page_metadata": {"hasNext": False}}


def detect_shell_signals(provider: dict, address_counts: dict) -> list:
    """Detect shell company fraud signals."""
    signals = []
    name = (provider.get("name") or "").lower()
    total_paid = provider.get("totalPaid") or 0
    address_key = (provider.get("address") or "").lower().strip()

    # Signal 1: High-value award to generically-named contractor
    if total_paid > 500_000:
        for pattern in GENERIC_NAME_PATTERNS:
            if pattern in name:
                signals.append("High-value award to generically-named contractor")
                break

    # Signal 2: Address shared by 3+ VA contractors
    if address_key and address_counts.get(address_key, 0) >= 3:
        signals.append("Address shared by multiple VA contractors")

    # Signal 3: Large award to non-licensed entity
    if total_paid > 1_000_000 and not provider.get("npi"):
        signals.append("Large award to non-licensed entity")

    return signals


def main():
    env = load_env()

    supabase_url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not supabase_url or not supabase_key:
        print("Missing Supabase credentials in .env.local")
        sys.exit(1)

    from supabase import create_client
    client = create_client(supabase_url, supabase_key)

    # --- Phase 1: Fetch VA awards ---
    print("=== VA Contractor Fraud Detection ===")
    print(f"Target: {TARGET_RECORDS} records from USASpending.gov\n")

    all_awards = []
    page = 1
    max_pages = TARGET_RECORDS // PAGE_LIMIT + 5

    while page <= max_pages:
        print(f"  Fetching page {page}...")
        result = fetch_va_awards(page)
        awards = result.get("results", [])

        if not awards:
            print(f"  No more results at page {page}")
            break

        all_awards.extend(awards)
        print(f"  Got {len(awards)} awards (total: {len(all_awards)})")

        has_next = result.get("page_metadata", {}).get("hasNext", False)
        if not has_next or len(all_awards) >= TARGET_RECORDS:
            break

        page += 1
        time.sleep(0.5)  # rate limit

    print(f"\nFetched {len(all_awards)} total VA contract awards")

    # --- Phase 2: Deduplicate by recipient name + address ---
    providers = {}
    for award in all_awards:
        name = (award.get("Recipient Name") or "").strip()
        if not name or name.upper() in ("REDACTED", "MULTIPLE RECIPIENTS", ""):
            continue

        address = (award.get("Recipient Address Line 1") or "").strip()
        city = (award.get("Recipient City Code") or "").strip()
        state = (award.get("Recipient State Code") or "").strip()
        zip_code = (award.get("Recipient Zip 5-digit") or "").strip()

        if not state:
            state = (award.get("Place of Performance State Code") or "").strip()
        if not city:
            city = (award.get("Place of Performance City Code") or "").strip()
        if not zip_code:
            zip_code = (award.get("Place of Performance Zip5") or "").strip()

        amount = 0
        try:
            amount = float(award.get("Award Amount") or 0)
        except (ValueError, TypeError):
            pass

        key = f"{name.lower()}|{state.lower()}"
        if key in providers:
            providers[key]["totalPaid"] += amount
        else:
            providers[key] = {
                "id": make_stable_id(name, address, state),
                "name": name,
                "address": address or "N/A",
                "city": city or "Unknown",
                "state": state or "Unknown",
                "zip": zip_code or "00000",
                "totalPaid": amount,
                "programs": ["VA Contractor"],
                "riskScore": 0,
                "anomalies": [],
                "npi": None,
                "billingHistory": json.dumps([]),
            }

    print(f"Deduplicated to {len(providers)} unique VA contractors\n")

    # --- Phase 3: Detect shell company signals ---
    provider_list = list(providers.values())

    # Count addresses for shared-address detection
    address_counts = defaultdict(int)
    for p in provider_list:
        addr = (p.get("address") or "").lower().strip()
        if addr and addr != "n/a":
            address_counts[addr] += 1

    flagged = 0
    for p in provider_list:
        signals = detect_shell_signals(p, address_counts)
        if signals:
            p["anomalies"] = signals
            p["riskScore"] = min(len(signals) * 15, 100)
            flagged += 1

    print(f"Flagged {flagged} providers with shell company signals")

    # --- Phase 4: Upsert to Supabase ---
    print(f"\nUpserting {len(provider_list)} VA contractors to Supabase...")

    batch_size = 200
    success = 0
    for i in range(0, len(provider_list), batch_size):
        batch = provider_list[i:i + batch_size]
        for attempt in range(3):
            try:
                client.table("Provider").upsert(batch, on_conflict="id").execute()
                success += len(batch)
                print(f"  Upserted batch {i // batch_size + 1} ({success}/{len(provider_list)})")
                break
            except Exception as e:
                if attempt < 2:
                    print(f"  Batch error (attempt {attempt + 1}): {e}")
                    time.sleep(3)
                else:
                    print(f"  Batch failed: {e}")

    print(f"\n=== Done: {success} VA contractors upserted ===")
    print(f"  Shell company signals detected: {flagged}")

    # Show signal breakdown
    signal_counts = defaultdict(int)
    for p in provider_list:
        for a in p.get("anomalies", []):
            signal_counts[a] += 1
    for signal, count in sorted(signal_counts.items(), key=lambda x: -x[1]):
        print(f"    {signal}: {count}")


if __name__ == "__main__":
    main()
