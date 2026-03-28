"""
detect_debarred_reentry.py — VIGIL Slice 3: Debarred Contractor Re-Entry Detection

Finds debarred/excluded contractors who reopened under new names and are
still receiving federal contracts.

Sources:
  1. SAM.gov Exclusion extract (CSV download + API fallback)
  2. USASpending.gov active federal awards (contracts A/B/C/D)
  3. Fuzzy matching to detect name variants

Usage:
    python scripts/detect_debarred_reentry.py
"""

import os
import sys
import csv
import io
import json
import time
import hashlib
from collections import defaultdict
from datetime import datetime
from difflib import SequenceMatcher

import requests

# Bump CSV field size limit for SAM.gov's large fields
csv.field_size_limit(10 * 1024 * 1024)


# ─── Config ───

OIG_CSV_URL = "https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv"
SAM_API_URL = "https://api.sam.gov/entity-information/v3/entities"

USASPENDING_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/"

FUZZY_EXACT_THRESHOLD = 0.85   # name-only match
FUZZY_STATE_THRESHOLD = 0.75   # name + same state match
USASPENDING_PAGES = 50         # 50 pages × 100 = 5000 awards
BATCH_SIZE = 200


# ─── Helpers ───

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


def normalize_name(name: str) -> str:
    """Normalize entity name for comparison."""
    if not name:
        return ""
    n = name.upper().strip()
    # Remove common suffixes
    for suffix in [' LLC', ' INC', ' CORP', ' LTD', ' CO', ' LP', ' LLP',
                   ' INCORPORATED', ' CORPORATION', ' COMPANY', ' LIMITED',
                   ',', '.']:
        n = n.replace(suffix, '')
    return ' '.join(n.split())


def fuzzy_ratio(a: str, b: str) -> float:
    """Return SequenceMatcher ratio between two strings."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def stable_id(prefix: str, name: str, state: str) -> str:
    """Generate a stable deterministic ID."""
    raw = f"{prefix}:{name}:{state}".lower().strip()
    return hashlib.sha256(raw.encode()).hexdigest()[:25]


# ─── Step 1: Exclusion Data (OIG primary, SAM API fallback) ───

def download_exclusions() -> list:
    """Download federal exclusion records. OIG primary, SAM API fallback."""
    records = []

    # Primary: OIG Exclusion List (reliable, 15MB CSV)
    print("  [1a] Downloading OIG Exclusion List...")
    try:
        resp = requests.get(OIG_CSV_URL, timeout=120)
        resp.raise_for_status()

        content = resp.content.decode('latin-1', errors='replace')
        reader = csv.DictReader(io.StringIO(content))

        for row in reader:
            # Skip reinstated individuals
            reindate = (row.get('REINDATE') or '').strip()
            if reindate and reindate != '00000000':
                continue

            # Use BUSNAME (business name) for entity matching; fall back to GENERAL
            busname = (row.get('BUSNAME') or '').strip()
            general = (row.get('GENERAL') or '').strip()
            name = busname or general
            if not name:
                continue

            state = (row.get('STATE') or '').strip()
            excl_type = (row.get('EXCLTYPE') or '').strip()

            records.append({
                'name': name,
                'state': state,
                'exclusionType': excl_type,
                'uei': '',
                'cage': '',
            })

        print(f"  OIG: {len(records)} active exclusion records loaded")

    except Exception as e:
        print(f"  OIG download failed: {e}")

    # Fallback: SAM.gov API (often rate-limited)
    if not records:
        print("  [1b] Trying SAM.gov API fallback...")
        try:
            resp = requests.get(SAM_API_URL, params={
                'exclusionStatusFlag': 'Y',
                'limit': 100,
                'api_key': 'DEMO_KEY',
            }, timeout=60)

            if resp.status_code == 200:
                data = resp.json()
                entities = data.get('entityData', [])
                for ent in entities:
                    core = ent.get('coreData', {})
                    entity_info = core.get('entityInformation', {})
                    phys = core.get('physicalAddress', {})
                    name = (entity_info.get('entityName') or '').strip()
                    state = (phys.get('stateOrProvinceCode') or '').strip()

                    if name:
                        records.append({
                            'name': name,
                            'state': state,
                            'exclusionType': '',
                            'uei': (entity_info.get('uniqueEntityId') or ''),
                            'cage': (entity_info.get('cageCode') or ''),
                        })

                print(f"  SAM API: {len(records)} exclusion records loaded")
        except Exception as e:
            print(f"  SAM API failed: {e}")

    return records


# ─── Step 2: USASpending Active Awards ───

def fetch_active_awards() -> list:
    """Fetch active federal contract awards from USASpending."""
    print("\n  [2] Fetching active federal awards from USASpending...")
    all_awards = []

    for page in range(1, USASPENDING_PAGES + 1):
        body = {
            "filters": {
                "time_period": [{
                    "start_date": "2024-01-01",
                    "end_date": "2025-12-31"
                }],
                "award_type_codes": ["A", "B", "C", "D"]
            },
            "fields": [
                "Recipient Name",
                "recipient_location_state_code",
                "Award Amount",
                "Awarding Agency",
                "Recipient UEI"
            ],
            "limit": 100,
            "page": page
        }

        try:
            resp = requests.post(USASPENDING_URL, json=body, timeout=60)
            if resp.status_code != 200:
                print(f"  Page {page}: HTTP {resp.status_code}")
                break

            data = resp.json()
            results = data.get('results', [])
            if not results:
                break

            for r in results:
                name = (r.get('Recipient Name') or '').strip()
                state = (r.get('recipient_location_state_code') or '').strip()
                amount = r.get('Award Amount', 0) or 0
                agency = (r.get('Awarding Agency') or '').strip()
                uei = (r.get('Recipient UEI') or '').strip()

                if name:
                    all_awards.append({
                        'name': name,
                        'state': state,
                        'amount': amount,
                        'agency': agency,
                        'uei': uei,
                    })

            print(f"  Page {page}: {len(results)} awards")
            time.sleep(0.5)  # rate limit

        except Exception as e:
            print(f"  Page {page} failed: {e}")
            break

    print(f"  Total active awards fetched: {len(all_awards)}")
    return all_awards


# ─── Step 3: Fuzzy Matching ───

def find_reentry_matches(exclusions: list, awards: list) -> list:
    """Fuzzy-match excluded entities against active award recipients."""
    print("\n  [3] Running fuzzy matching (exclusions × awards)...")
    matches = []
    seen = set()

    # Build normalized name/state lookup for exclusions
    excl_normalized = []
    for exc in exclusions:
        excl_normalized.append({
            **exc,
            'norm_name': normalize_name(exc['name']),
        })

    # Build normalized award lookup
    award_normalized = []
    for aw in awards:
        award_normalized.append({
            **aw,
            'norm_name': normalize_name(aw['name']),
        })

    total_comparisons = len(excl_normalized) * len(award_normalized)
    print(f"  Comparisons: {len(excl_normalized)} exclusions × {len(award_normalized)} awards = {total_comparisons:,}")

    checked = 0
    for exc in excl_normalized:
        exc_name = exc['norm_name']
        exc_state = exc.get('state', '').upper().strip()

        if not exc_name:
            continue

        for aw in award_normalized:
            aw_name = aw['norm_name']
            aw_state = aw.get('state', '').upper().strip()

            if not aw_name:
                continue

            checked += 1
            if checked % 500000 == 0:
                print(f"  Progress: {checked:,}/{total_comparisons:,} comparisons...")

            # Skip exact same name — we want re-entry under similar but different name
            # But exact matches are also suspicious (still operating under banned name)
            match_key = f"{exc_name}|{aw_name}|{aw_state}"
            if match_key in seen:
                continue

            ratio = fuzzy_ratio(exc_name, aw_name)

            matched = False
            match_type = ""

            # High confidence: name-only match > 0.85
            if ratio >= FUZZY_EXACT_THRESHOLD:
                matched = True
                match_type = "Name Match"

            # Medium confidence: same state + name > 0.75
            elif exc_state and aw_state and exc_state == aw_state and ratio >= FUZZY_STATE_THRESHOLD:
                matched = True
                match_type = "State+Name Match"

            if matched:
                seen.add(match_key)
                matches.append({
                    'excluded_name': exc['name'],
                    'excluded_state': exc.get('state', ''),
                    'excluded_type': exc.get('exclusionType', ''),
                    'award_name': aw['name'],
                    'award_state': aw.get('state', ''),
                    'award_amount': aw.get('amount', 0),
                    'award_agency': aw.get('agency', ''),
                    'award_uei': aw.get('uei', ''),
                    'match_ratio': round(ratio, 3),
                    'match_type': match_type,
                })

    print(f"  Matches found: {len(matches)}")
    return matches


# ─── Step 4: Upsert to Supabase ───

def upsert_matches(client, matches: list) -> int:
    """Create/update Provider records for matched entities."""
    print(f"\n  [4] Upserting {len(matches)} matched entities to Supabase...")

    upserted = 0
    for i, m in enumerate(matches):
        name = m['award_name']
        state = m['award_state']
        pid = stable_id("debarred", name, state)

        anomalies = [
            "Debarred Contractor Re-Entry Signal",
            "SAM.gov Exclusion Match",
        ]
        if m['match_type'] == "State+Name Match":
            anomalies.append("State+Name Fuzzy Match — Possible Rename")

        record = {
            'id': pid,
            'name': name,
            'address': '',
            'city': '',
            'state': state,
            'zip': '',
            'programs': ["Federal Contractor"],
            'totalPaid': float(m.get('award_amount', 0) or 0),
            'riskScore': 85,
            'anomalies': anomalies,
        }

        try:
            # Check if exists
            existing = (client.table("Provider")
                        .select("id,anomalies,riskScore,totalPaid")
                        .eq("id", pid)
                        .execute())

            if existing.data:
                # Update: merge anomalies, boost risk
                old = existing.data[0]
                old_anomalies = old.get('anomalies') or []
                merged = list(set(old_anomalies + anomalies))
                new_risk = min(max(old.get('riskScore', 0), 85), 100)
                new_paid = (old.get('totalPaid', 0) or 0) + float(m.get('award_amount', 0) or 0)

                (client.table("Provider")
                 .update({
                     'anomalies': merged,
                     'riskScore': new_risk,
                     'totalPaid': new_paid,
                 })
                 .eq('id', pid)
                 .execute())
            else:
                (client.table("Provider")
                 .insert(record)
                 .execute())

            upserted += 1

        except Exception as e:
            print(f"  Upsert failed for {name}: {e}")

        if (i + 1) % 25 == 0:
            print(f"  Progress: {i + 1}/{len(matches)} upserted")

    return upserted


# ─── Main ───

def main():
    env = load_env()

    supabase_url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not supabase_url or not supabase_key:
        print("Missing Supabase credentials")
        sys.exit(1)

    from supabase import create_client
    client = create_client(supabase_url, supabase_key)

    print("=" * 60)
    print("  VIGIL Slice 3 — Debarred Contractor Re-Entry Detection")
    print("=" * 60)

    # Step 1: Federal exclusions (OIG + SAM)
    print("\n[Step 1] Federal Exclusion Data...")
    exclusions = download_exclusions()

    if not exclusions:
        print("  WARNING: No exclusion records loaded. Exiting.")
        return

    # Step 2: Active federal awards
    awards = fetch_active_awards()

    if not awards:
        print("  WARNING: No active awards loaded. Exiting.")
        return

    # Step 3: Fuzzy matching
    matches = find_reentry_matches(exclusions, awards)

    # Step 4: Upsert
    upserted = 0
    if matches:
        upserted = upsert_matches(client, matches)

    # Step 5: Save results
    results_dir = os.path.join(os.path.dirname(__file__), 'results')
    os.makedirs(results_dir, exist_ok=True)

    today = datetime.now().strftime('%Y-%m-%d')
    results_path = os.path.join(results_dir, f'debarred_reentry_{today}.json')

    stats = {
        'run_date': today,
        'exclusions_loaded': len(exclusions),
        'awards_fetched': len(awards),
        'matches_found': len(matches),
        'providers_upserted': upserted,
    }

    results = {
        'stats': stats,
        'matches': matches,
    }

    with open(results_path, 'w') as f:
        json.dump(results, f, indent=2, default=str)

    # Summary
    print("\n" + "=" * 60)
    print("  VIGIL Slice 3 — COMPLETE")
    print("=" * 60)
    print(f"  Exclusions loaded:      {stats['exclusions_loaded']}")
    print(f"  Active awards fetched:  {stats['awards_fetched']}")
    print(f"  Re-entry matches found: {stats['matches_found']}")
    print(f"  Providers upserted:     {stats['providers_upserted']}")
    print(f"\n  Results saved to: {results_path}")
    print("Done.")

    return stats


if __name__ == "__main__":
    main()
