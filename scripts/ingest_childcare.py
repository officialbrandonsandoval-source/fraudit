"""
ingest_childcare.py — Child Care (CCDF) Fraud Detection

Fetches licensed child care provider data from California's Community Care
Licensing Division (CCLD) via data.ca.gov, detects fraud signals, and
upserts into Provider table.

Usage:
    python scripts/ingest_childcare.py
"""

import os
import sys
import time
import json
import uuid
import hashlib
import re
import requests
from collections import defaultdict
from datetime import datetime, timedelta


# data.ca.gov CCLD facility data — multiple resource IDs to try
CKAN_BASE = "https://data.ca.gov/api/3/action/datastore_search"
# Known resource IDs for CA child care / community care licensing data
RESOURCE_IDS = [
    "17ca-cld-facilities",   # placeholder
]

# Alternative: CA Health and Human Services Open Data
CHHS_SEARCH_URL = "https://data.ca.gov/api/3/action/package_search"
CHHS_RESOURCE_URL = "https://data.ca.gov/api/3/action/datastore_search"

# Fallback: direct CCLD facility data
CCLD_API_URL = "https://data.ca.gov/api/3/action/datastore_search"

# Residential address indicators (absence of commercial markers)
COMMERCIAL_MARKERS = re.compile(
    r'\b(suite|ste|unit|floor|fl|bldg|building|office|ofc|rm|room|dept|#)\b',
    re.IGNORECASE
)


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
    raw = f"ccdf:{name}:{address}:{state}".lower().strip()
    return hashlib.sha256(raw.encode()).hexdigest()[:25]


def is_residential_address(address: str) -> bool:
    """Heuristic: address is likely residential if it lacks commercial markers."""
    if not address:
        return False
    return not COMMERCIAL_MARKERS.search(address)


def find_childcare_resource_id() -> str | None:
    """Search data.ca.gov for child care facility datasets."""
    search_terms = [
        "community care licensing facility",
        "child care facility",
        "licensed child care",
    ]

    for term in search_terms:
        try:
            print(f"  Searching data.ca.gov for: {term}")
            resp = requests.get(
                CHHS_SEARCH_URL,
                params={"q": term, "rows": 5},
                timeout=30
            )
            resp.raise_for_status()
            results = resp.json().get("result", {}).get("results", [])

            for dataset in results:
                resources = dataset.get("resources", [])
                for res in resources:
                    fmt = (res.get("format") or "").upper()
                    if fmt in ("CSV", "JSON", "API") or "datastore" in (res.get("url") or ""):
                        resource_id = res.get("id")
                        name = dataset.get("title", "")
                        print(f"    Found: {name} (resource: {resource_id})")
                        # Check if it has data
                        try:
                            check = requests.get(
                                CCLD_API_URL,
                                params={"resource_id": resource_id, "limit": 1},
                                timeout=15
                            )
                            check_data = check.json()
                            if check_data.get("success") and check_data.get("result", {}).get("total", 0) > 100:
                                total = check_data["result"]["total"]
                                print(f"    Has {total} records — using this!")
                                return resource_id
                        except Exception:
                            continue
        except Exception as e:
            print(f"    Search failed: {e}")
            continue

    return None


def fetch_ckan_data(resource_id: str, limit: int = 32000) -> list:
    """Fetch all records from a CKAN datastore resource."""
    all_records = []
    offset = 0
    page_size = 1000

    while offset < limit:
        try:
            resp = requests.get(
                CCLD_API_URL,
                params={
                    "resource_id": resource_id,
                    "limit": page_size,
                    "offset": offset,
                },
                timeout=60
            )
            resp.raise_for_status()
            data = resp.json()

            if not data.get("success"):
                print(f"  API returned success=false at offset {offset}")
                break

            records = data.get("result", {}).get("records", [])
            if not records:
                break

            all_records.extend(records)
            print(f"  Fetched {len(all_records)} records...")

            if len(records) < page_size:
                break

            offset += page_size
            time.sleep(0.3)

        except Exception as e:
            print(f"  Error at offset {offset}: {e}")
            time.sleep(3)
            break

    return all_records


def normalize_facility(record: dict) -> dict | None:
    """Normalize a CCLD facility record to Provider schema."""
    # Try multiple field name patterns (CKAN datasets vary)
    name = (
        record.get("FACILITY_NAME") or
        record.get("facility_name") or
        record.get("Facility Name") or
        record.get("FACNAME") or
        record.get("name") or
        ""
    ).strip()

    if not name:
        return None

    address = (
        record.get("FACILITY_ADDRESS") or
        record.get("facility_address") or
        record.get("Facility Address") or
        record.get("ADDRESS") or
        record.get("address") or
        ""
    ).strip()

    city = (
        record.get("FACILITY_CITY") or
        record.get("facility_city") or
        record.get("Facility City") or
        record.get("CITY") or
        record.get("city") or
        ""
    ).strip()

    state = (
        record.get("FACILITY_STATE") or
        record.get("facility_state") or
        record.get("Facility State") or
        record.get("STATE") or
        "CA"
    ).strip()

    zip_code = (
        record.get("FACILITY_ZIP") or
        record.get("facility_zip") or
        record.get("Facility Zip") or
        record.get("ZIP") or
        record.get("zip") or
        ""
    ).strip()
    if zip_code:
        zip_code = zip_code[:5]

    capacity = 0
    cap_raw = (
        record.get("FACILITY_CAPACITY") or
        record.get("facility_capacity") or
        record.get("Facility Capacity") or
        record.get("CAPACITY") or
        record.get("capacity") or
        0
    )
    try:
        capacity = int(cap_raw)
    except (ValueError, TypeError):
        capacity = 0

    facility_type = (
        record.get("FACILITY_TYPE") or
        record.get("facility_type") or
        record.get("Facility Type") or
        record.get("TYPE") or
        ""
    ).strip()

    license_date = None
    date_raw = (
        record.get("LICENSE_FIRST_DATE") or
        record.get("license_first_date") or
        record.get("License First Date") or
        record.get("LICENSEE_DATE") or
        record.get("license_date") or
        ""
    )
    if date_raw:
        for fmt in ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"]:
            try:
                license_date = datetime.strptime(str(date_raw).strip()[:19], fmt)
                break
            except ValueError:
                continue

    return {
        "name": name,
        "address": address or "N/A",
        "city": city or "Unknown",
        "state": state or "CA",
        "zip": zip_code or "00000",
        "capacity": capacity,
        "facilityType": facility_type,
        "licenseDate": license_date,
    }


def detect_childcare_signals(provider: dict, address_counts: dict) -> list:
    """Detect child care fraud signals."""
    signals = []

    capacity = provider.get("capacity", 0)
    address = provider.get("address", "")
    license_date = provider.get("licenseDate")
    address_key = address.lower().strip()

    # Signal 1: High-capacity at residential address
    if capacity > 30 and is_residential_address(address):
        signals.append("High-capacity child care at apparent residential address")

    # Signal 2: Multiple licenses at same address
    if address_key and address_key != "n/a" and address_counts.get(address_key, 0) >= 2:
        signals.append("Multiple child care licenses at same address")

    # Signal 3: Recently licensed (< 6 months)
    if license_date:
        six_months_ago = datetime.now() - timedelta(days=180)
        if license_date > six_months_ago:
            signals.append("Recently licensed child care provider")

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

    # --- Phase 1: Find and fetch child care data ---
    print("=== Child Care (CCDF) Fraud Detection ===\n")
    print("Phase 1: Finding child care dataset on data.ca.gov...")

    resource_id = find_childcare_resource_id()

    records = []
    if resource_id:
        print(f"\nPhase 2: Fetching data from resource {resource_id}...")
        records = fetch_ckan_data(resource_id)
    else:
        print("\n  Could not find suitable dataset on data.ca.gov")
        print("  Trying HHS/ACF CCDF fallback...")

        # Fallback: try fetching from ACF open data
        try:
            fallback_url = "https://data.ca.gov/api/3/action/datastore_search"
            # Try a broader search with known CCLD-related resources
            for rid in ["15bef547-1e43-472b-a643-94804b4e46fa",
                        "a36e1a8e-4218-4469-8d11-ace0f37b51a7"]:
                print(f"  Trying resource ID: {rid}...")
                try:
                    resp = requests.get(
                        fallback_url,
                        params={"resource_id": rid, "limit": 1},
                        timeout=15
                    )
                    data = resp.json()
                    if data.get("success") and data.get("result", {}).get("total", 0) > 0:
                        total = data["result"]["total"]
                        print(f"    Found {total} records!")
                        records = fetch_ckan_data(rid)
                        break
                except Exception:
                    continue
        except Exception as e:
            print(f"  Fallback failed: {e}")

    if not records:
        print("\n  WARNING: Could not retrieve child care data from any source.")
        print("  This is a known issue — CA data.ca.gov APIs change resource IDs.")
        print("  The script framework is ready; re-run once the correct resource ID is found.")
        print("  Document this and move on per instructions.\n")
        # Still create the script structure — just exit cleanly
        return

    # --- Phase 2: Normalize ---
    print(f"\nPhase 3: Normalizing {len(records)} records...")
    normalized = []
    for r in records:
        n = normalize_facility(r)
        if n:
            normalized.append(n)

    print(f"  Normalized {len(normalized)} facilities")

    # --- Phase 3: Detect fraud signals ---
    print("\nPhase 4: Detecting fraud signals...")

    # Count addresses for multi-license detection
    address_counts = defaultdict(int)
    for p in normalized:
        addr = (p.get("address") or "").lower().strip()
        if addr and addr != "n/a":
            address_counts[addr] += 1

    provider_list = []
    flagged = 0
    multi_signal = 0

    for p in normalized:
        signals = detect_childcare_signals(p, address_counts)

        anomalies = list(signals)
        risk_boost = len(signals) * 20

        # Badge: 2+ signals = child care fraud risk
        if len(signals) >= 2:
            anomalies.append("Child care fraud risk")
            multi_signal += 1

        provider = {
            "id": make_stable_id(p["name"], p["address"], p["state"]),
            "name": p["name"],
            "address": p["address"],
            "city": p["city"],
            "state": p["state"],
            "zip": p["zip"],
            "totalPaid": 0,
            "programs": ["Child Care (CCDF)"],
            "riskScore": min(risk_boost, 100),
            "anomalies": anomalies,
            "npi": None,
            "billingHistory": json.dumps([]),
        }

        if p.get("licenseDate"):
            provider["licenseDate"] = p["licenseDate"].isoformat()

        provider_list.append(provider)
        if signals:
            flagged += 1

    print(f"  Flagged {flagged} providers with fraud signals")
    print(f"  {multi_signal} providers with 2+ signals (child care fraud risk badge)")

    # --- Phase 4: Upsert to Supabase ---
    print(f"\nPhase 5: Upserting {len(provider_list)} child care providers to Supabase...")

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

    print(f"\n=== Done: {success} child care providers upserted ===")

    # Signal breakdown
    signal_counts = defaultdict(int)
    for p in provider_list:
        for a in p.get("anomalies", []):
            signal_counts[a] += 1
    for signal, count in sorted(signal_counts.items(), key=lambda x: -x[1]):
        print(f"    {signal}: {count}")


if __name__ == "__main__":
    main()
