"""
ingest_childcare_national.py — National Child Care (CCDF) Fraud Detection

Pulls licensed child care provider data for all 50 states (skips CA — already done).
Strategy per state:
  1. State open data portals (Socrata/CKAN) where available
  2. Fallback: USASpending.gov CFDA 93.575 (Child Care Development Block Grant)
  3. Normalize to Provider schema, detect fraud signals, upsert to Supabase

Usage:
    python scripts/ingest_childcare_national.py
"""

import os
import sys
import time
import json
import hashlib
import re
import requests
from collections import defaultdict
from datetime import datetime, timedelta

# Residential address heuristic
COMMERCIAL_MARKERS = re.compile(
    r'\b(suite|ste|unit|floor|fl|bldg|building|office|ofc|rm|room|dept|#)\b',
    re.IGNORECASE
)

# All 50 states minus CA
ALL_STATES = [
    "AL", "AK", "AZ", "AR", "CO", "CT", "DE", "FL", "GA", "HI",
    "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA",
    "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM",
    "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD",
    "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]

# State FIPS codes for USASpending
STATE_FIPS = {
    "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CO": "08",
    "CT": "09", "DE": "10", "FL": "12", "GA": "13", "HI": "15",
    "ID": "16", "IL": "17", "IN": "18", "IA": "19", "KS": "20",
    "KY": "21", "LA": "22", "ME": "23", "MD": "24", "MA": "25",
    "MI": "26", "MN": "27", "MS": "28", "MO": "29", "MT": "30",
    "NE": "31", "NV": "32", "NH": "33", "NJ": "34", "NM": "35",
    "NY": "36", "NC": "37", "ND": "38", "OH": "39", "OK": "40",
    "OR": "41", "PA": "42", "RI": "44", "SC": "45", "SD": "46",
    "TN": "47", "TX": "48", "UT": "49", "VT": "50", "VA": "51",
    "WA": "53", "WV": "54", "WI": "55", "WY": "56",
}

# State full names for USASpending
STATE_NAMES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida",
    "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois",
    "IN": "Indiana", "IA": "Iowa", "KS": "Kansas", "KY": "Kentucky",
    "LA": "Louisiana", "ME": "Maine", "MD": "Maryland", "MA": "Massachusetts",
    "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
    "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire",
    "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
    "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania",
    "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota",
    "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
    "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming",
}

# ─── Known state open data portal endpoints ───
# Socrata domains with known child care / licensed facility datasets
# Format: { state: (domain, dataset_id) }
# These are Socrata SODA API endpoints
SOCRATA_DATASETS = {
    "TX": ("data.texas.gov", "bc5r-88dy"),       # TX HHS Licensed Child Care
    "NY": ("data.ny.gov", "cb42-qumz"),           # NY OCFS Child Care Regulated Programs
    "IL": ("data.illinois.gov", "bc3k-wfp3"),     # IL DCFS Licensed Day Care
    "FL": ("data.fldfs.com", None),               # search needed
    "PA": ("data.pa.gov", "ajn5-kaxt"),           # PA DHS Child Care
    "OH": ("data.ohio.gov", "5nct-u374"),         # OH JFS Child Care
    "NC": ("data.nc.gov", None),                  # search needed
    "CO": ("data.colorado.gov", "a9rr-k8mu"),     # CO Child Care Facilities
    "CT": ("data.ct.gov", "h8mr-dn95"),           # CT OEC Licensed Child Care
    "MD": ("data.maryland.gov", "jin5-37rc"),      # MD Child Care Centers
    "MO": ("data.mo.gov", "jz25-gkge"),           # MO DSS Child Care
    "IN": ("data.indiana.gov", None),             # search needed
    "WA": ("data.wa.gov", "2cqm-k8d4"),          # WA DEL Licensed Child Care
    "MA": ("data.mass.gov", None),                # search needed
    "VA": ("data.virginia.gov", "yi7e-2gqx"),     # VA DSS Licensed Child Care
    "MN": ("data.minnesota.gov", None),           # search needed
    "WI": ("data.wisconsin.gov", None),           # search needed
    "OR": ("data.oregon.gov", "djkh-m8qa"),       # OR Child Care Facilities
    "SC": ("data.sc.gov", None),                  # search needed
    "NJ": ("data.nj.gov", "h7es-94wm"),          # NJ DCF Licensed Child Care
}


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
    if not address:
        return False
    return not COMMERCIAL_MARKERS.search(address)


# ─── Socrata SODA API fetcher ───

def search_socrata_for_childcare(domain: str) -> str | None:
    """Search a Socrata domain for child care datasets via discovery API."""
    search_terms = ["child care", "childcare", "day care", "licensed care", "CCDF"]
    for term in search_terms:
        try:
            url = f"https://api.us.socrata.com/api/catalog/v1"
            resp = requests.get(url, params={
                "domains": domain,
                "search_context": domain,
                "q": term,
                "limit": 5,
            }, timeout=15)
            if resp.status_code != 200:
                continue
            results = resp.json().get("results", [])
            for r in results:
                res = r.get("resource", {})
                dataset_id = res.get("id")
                name = res.get("name", "")
                if dataset_id and any(kw in name.lower() for kw in
                                     ["child care", "childcare", "day care", "daycare",
                                      "licensed", "ccdf", "provider", "facility"]):
                    return dataset_id
        except Exception:
            continue
    return None


def fetch_socrata_data(domain: str, dataset_id: str, limit: int = 50000) -> list:
    """Fetch records from a Socrata SODA API endpoint."""
    all_records = []
    offset = 0
    page_size = 1000

    while offset < limit:
        try:
            url = f"https://{domain}/resource/{dataset_id}.json"
            resp = requests.get(url, params={
                "$limit": page_size,
                "$offset": offset,
            }, timeout=60)

            if resp.status_code == 404:
                return []
            resp.raise_for_status()
            records = resp.json()

            if not isinstance(records, list) or not records:
                break

            all_records.extend(records)
            if len(records) < page_size:
                break

            offset += page_size
            time.sleep(0.3)
        except Exception as e:
            if offset == 0:
                return []  # dataset doesn't work
            break

    return all_records


# ─── USASpending.gov fallback ───

def fetch_usaspending_awards(state_code: str, limit: int = 500) -> list:
    """Fetch CCDF grant awards from USASpending.gov for a state."""
    url = "https://api.usaspending.gov/api/v2/search/spending_by_award/"
    payload = {
        "filters": {
            "award_type_codes": ["02", "03", "04", "05"],
            "award_amounts": [],
            "cfda_numbers": ["93.575"],
            "place_of_performance_locations": [
                {"country": "USA", "state": state_code}
            ],
        },
        "fields": [
            "Award ID", "Recipient Name", "Place of Performance City Code",
            "Place of Performance State Code", "Place of Performance Zip5",
            "Description", "Award Amount", "recipient_id",
            "Place of Performance Address Line 1",
        ],
        "page": 1,
        "limit": limit,
        "sort": "Award Amount",
        "order": "desc",
        "subawards": False,
    }

    all_results = []
    page = 1

    while True:
        payload["page"] = page
        try:
            resp = requests.post(url, json=payload, timeout=60)
            if resp.status_code == 422:
                # No results for this state
                return []
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])
            if not results:
                break
            all_results.extend(results)
            if not data.get("page_metadata", {}).get("hasNext", False):
                break
            page += 1
            time.sleep(0.5)
        except Exception as e:
            if page == 1:
                return []
            break

    return all_results


def normalize_usaspending_award(record: dict, state: str) -> dict | None:
    """Normalize a USASpending award record to our provider schema."""
    name = (record.get("Recipient Name") or "").strip()
    if not name:
        return None

    address = (record.get("Place of Performance Address Line 1") or "").strip()
    city = (record.get("Place of Performance City Code") or "").strip()
    zip_code = (record.get("Place of Performance Zip5") or "").strip()

    amount = 0
    try:
        amount = float(record.get("Award Amount") or 0)
    except (ValueError, TypeError):
        pass

    return {
        "name": name,
        "address": address or "N/A",
        "city": city or "Unknown",
        "state": state,
        "zip": zip_code[:5] if zip_code else "00000",
        "capacity": 0,
        "facilityType": "CCDF Grant Recipient",
        "licenseDate": None,
        "totalPaid": amount,
    }


# ─── Socrata record normalizer ───

def normalize_socrata_record(record: dict, state: str) -> dict | None:
    """Normalize a Socrata child care facility record."""
    # Try many field name patterns
    name = ""
    for key in ["facility_name", "provider_name", "name", "program_name",
                 "business_name", "dba_name", "center_name", "agency_name",
                 "FACILITY_NAME", "PROVIDER_NAME", "NAME"]:
        val = record.get(key, "")
        if val and str(val).strip():
            name = str(val).strip()
            break

    if not name:
        # Try first string-like field that looks like a name
        for k, v in record.items():
            if isinstance(v, str) and len(v) > 3 and "name" in k.lower():
                name = v.strip()
                break

    if not name:
        return None

    address = ""
    for key in ["facility_address", "address", "street_address", "address_line_1",
                 "location_address", "physical_address", "street",
                 "FACILITY_ADDRESS", "ADDRESS"]:
        val = record.get(key, "")
        if val and str(val).strip():
            address = str(val).strip()
            break

    city = ""
    for key in ["facility_city", "city", "physical_city", "location_city",
                 "FACILITY_CITY", "CITY"]:
        val = record.get(key, "")
        if val and str(val).strip():
            city = str(val).strip()
            break

    zip_code = ""
    for key in ["facility_zip", "zip", "zip_code", "zipcode", "postal_code",
                 "physical_zip", "FACILITY_ZIP", "ZIP"]:
        val = record.get(key, "")
        if val and str(val).strip():
            zip_code = str(val).strip()[:5]
            break

    capacity = 0
    for key in ["capacity", "licensed_capacity", "total_capacity",
                 "facility_capacity", "max_capacity", "CAPACITY"]:
        val = record.get(key, "")
        if val:
            try:
                capacity = int(val)
                break
            except (ValueError, TypeError):
                continue

    facility_type = ""
    for key in ["facility_type", "type", "program_type", "license_type",
                 "provider_type", "category", "FACILITY_TYPE", "TYPE"]:
        val = record.get(key, "")
        if val and str(val).strip():
            facility_type = str(val).strip()
            break

    license_date = None
    for key in ["license_date", "license_first_date", "original_license_date",
                 "issue_date", "approval_date", "effective_date",
                 "LICENSE_DATE", "LICENSE_FIRST_DATE"]:
        val = record.get(key, "")
        if val:
            for fmt in ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%m/%d/%Y",
                        "%m-%d-%Y", "%Y-%m-%dT%H:%M:%S.%f"]:
                try:
                    license_date = datetime.strptime(str(val).strip()[:19], fmt)
                    break
                except ValueError:
                    continue
            if license_date:
                break

    return {
        "name": name,
        "address": address or "N/A",
        "city": city or "Unknown",
        "state": state,
        "zip": zip_code or "00000",
        "capacity": capacity,
        "facilityType": facility_type,
        "licenseDate": license_date,
        "totalPaid": 0,
    }


# ─── Fraud signal detection ───

def detect_childcare_signals(provider: dict, address_counts: dict) -> list:
    signals = []
    capacity = provider.get("capacity", 0)
    address = provider.get("address", "")
    address_key = address.lower().strip()

    # Signal 1: High-capacity at residential address
    if capacity > 30 and is_residential_address(address):
        signals.append("High-capacity child care at apparent residential address")

    # Signal 2: Multiple licenses at same address
    if address_key and address_key != "n/a" and address_counts.get(address_key, 0) >= 2:
        signals.append("Multiple child care licenses at same address")

    return signals


# ─── State data fetcher ───

def fetch_state_data(state: str) -> list:
    """Try to fetch child care data for a state. Returns normalized records."""
    records = []

    # Strategy 1: Known Socrata dataset
    if state in SOCRATA_DATASETS:
        domain, dataset_id = SOCRATA_DATASETS[state]

        if dataset_id:
            raw = fetch_socrata_data(domain, dataset_id)
            if raw:
                for r in raw:
                    n = normalize_socrata_record(r, state)
                    if n:
                        records.append(n)
                if records:
                    return records

        # Try searching for a dataset on this domain
        found_id = search_socrata_for_childcare(domain)
        if found_id:
            raw = fetch_socrata_data(domain, found_id)
            if raw:
                for r in raw:
                    n = normalize_socrata_record(r, state)
                    if n:
                        records.append(n)
                if records:
                    return records

    # Strategy 2: USASpending.gov CFDA 93.575 fallback
    awards = fetch_usaspending_awards(state)
    for a in awards:
        n = normalize_usaspending_award(a, state)
        if n:
            records.append(n)

    return records


# ─── Main ───

def main():
    env = load_env()

    supabase_url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not supabase_url or not supabase_key:
        print("Missing Supabase credentials in .env")
        sys.exit(1)

    from supabase import create_client
    client = create_client(supabase_url, supabase_key)

    print("=" * 60)
    print("  NATIONAL CHILD CARE (CCDF) INGEST — All 50 States")
    print("=" * 60)
    print(f"  Skipping CA (already ingested)")
    print(f"  Processing {len(ALL_STATES)} states\n")

    grand_total = 0
    grand_flagged = 0
    grand_multi = 0
    states_with_data = 0
    states_without_data = []

    for idx, state in enumerate(ALL_STATES, 1):
        print(f"\n[{idx}/{len(ALL_STATES)}] {state} ({STATE_NAMES.get(state, state)})")
        print("-" * 40)

        # Fetch data
        normalized = fetch_state_data(state)

        if not normalized:
            print(f"  No data found for {state}")
            states_without_data.append(state)
            continue

        states_with_data += 1
        print(f"  Found {len(normalized)} providers")

        # Count addresses for multi-license detection
        address_counts = defaultdict(int)
        for p in normalized:
            addr = (p.get("address") or "").lower().strip()
            if addr and addr != "n/a":
                address_counts[addr] += 1

        # Build provider records with fraud signals, deduplicate by ID
        seen_ids = {}
        flagged = 0
        multi_signal = 0

        for p in normalized:
            pid = make_stable_id(p["name"], p["address"], p["state"])
            if pid in seen_ids:
                continue  # skip duplicate

            signals = detect_childcare_signals(p, address_counts)
            anomalies = list(signals)
            risk_boost = len(signals) * 20

            if len(signals) >= 2:
                anomalies.append("Child care fraud risk")
                multi_signal += 1

            provider = {
                "id": pid,
                "name": p["name"],
                "address": p["address"],
                "city": p["city"],
                "state": p["state"],
                "zip": p["zip"],
                "totalPaid": p.get("totalPaid", 0),
                "programs": ["Child Care (CCDF)"],
                "riskScore": min(risk_boost, 100),
                "anomalies": anomalies,
                "npi": None,
                "billingHistory": json.dumps([]),
            }

            if p.get("licenseDate"):
                provider["licenseDate"] = p["licenseDate"].isoformat()

            seen_ids[pid] = provider
            if signals:
                flagged += 1

        provider_list = list(seen_ids.values())

        # Upsert to Supabase
        batch_size = 200
        success = 0
        for i in range(0, len(provider_list), batch_size):
            batch = provider_list[i:i + batch_size]
            for attempt in range(3):
                try:
                    client.table("Provider").upsert(batch, on_conflict="id").execute()
                    success += len(batch)
                    break
                except Exception as e:
                    if attempt < 2:
                        time.sleep(3)
                    else:
                        print(f"  Batch upsert failed: {e}")

        grand_total += success
        grand_flagged += flagged
        grand_multi += multi_signal
        print(f"  Upserted {success} providers | {flagged} flagged | {multi_signal} multi-signal")

    # ─── Summary ───
    print("\n" + "=" * 60)
    print("  NATIONAL INGEST COMPLETE")
    print("=" * 60)
    print(f"  States with data: {states_with_data}/{len(ALL_STATES)}")
    print(f"  Total providers ingested: {grand_total}")
    print(f"  Total flagged: {grand_flagged}")
    print(f"  Total multi-signal (fraud risk badge): {grand_multi}")

    if states_without_data:
        print(f"\n  States with no data found: {', '.join(states_without_data)}")

    print("\nDone.")


if __name__ == "__main__":
    main()
