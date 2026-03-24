"""
detect_ghost_operations.py — VIGIL Slice 1: Ghost Operations Detection Engine

Cross-references Medicare providers against 3+ public data sources to detect
"ghost operations" — entities that bill federal programs but have no verifiable
real-world footprint.

Sources:
  1. HHS OIG Exclusion List (excluded/banned providers)
  2. SAM.gov Debarment records (federal contractor bans)
  3. OpenCorporates (business registration verification)
  4. Address clustering (shared-address mill detection)

Usage:
    python scripts/detect_ghost_operations.py
"""

import os
import sys
import csv
import io
import json
import time
import re
import zipfile
import hashlib
from collections import defaultdict
from datetime import datetime

import requests
from thefuzz import fuzz


# ─── Config ───

BATCH_SIZE = 1000
OIG_CSV_URL = "https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv"
SAM_API_URL = "https://api.sam.gov/entity-information/v3/entities"
SAM_ZIP_URL = "https://sam.gov/api/prod/fileextractservices/v1/api/download?fileName=EXCLUSION_PUBLIC_EXTRACT_V2.ZIP"
OPENCORP_URL = "https://api.opencorporates.com/v0.4/companies/search"
OPENCORP_RATE_LIMIT = 0.5   # seconds between requests
OPENCORP_MAX_PER_RUN = 100  # max OpenCorporates calls per run

RESIDENTIAL_PATTERNS = re.compile(
    r'\b(apt|unit|#|ste)\b.*\b\d{5}\b', re.IGNORECASE
)
ADDRESS_CLUSTER_THRESHOLD = 5  # providers at same address = mill signal


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


def normalize_address(addr: str) -> str:
    """Normalize address for comparison."""
    if not addr:
        return ""
    addr = addr.upper().strip()
    addr = re.sub(r'[.,#]', '', addr)
    addr = re.sub(r'\s+', ' ', addr)
    return addr


def is_residential_signal(address: str) -> bool:
    """Check if address looks residential (APT/UNIT/# combined with patterns)."""
    if not address:
        return False
    upper = address.upper()
    markers = ['APT ', 'APT.', 'UNIT ', 'UNIT.', '# ']
    return any(m in upper for m in markers)


# ─── Step 2: OIG Exclusion List ───

def download_oig_exclusions() -> dict:
    """Download OIG exclusion CSV and index by NPI."""
    print("  Downloading OIG Exclusion List...")
    npi_index = {}
    name_index = defaultdict(list)

    try:
        resp = requests.get(OIG_CSV_URL, timeout=120)
        resp.raise_for_status()

        # OIG CSV uses latin-1 encoding
        content = resp.content.decode('latin-1', errors='replace')
        reader = csv.DictReader(io.StringIO(content))

        count = 0
        for row in reader:
            npi = (row.get('NPI') or '').strip()
            name = (row.get('GENERAL') or '').strip()
            addr = (row.get('ADDRESS') or '').strip()
            state = (row.get('STATE') or '').strip()
            excldate = (row.get('EXCLDATE') or '').strip()
            reindate = (row.get('REINDATE') or '').strip()

            # Skip if reinstated
            if reindate:
                continue

            entry = {
                'npi': npi,
                'name': name,
                'address': addr,
                'state': state,
                'excldate': excldate,
            }

            if npi:
                npi_index[npi] = entry

            if name:
                name_index[name.upper()].append(entry)

            count += 1

        print(f"  OIG: {count} active exclusions loaded ({len(npi_index)} with NPI)")
        return {'npi': npi_index, 'name': name_index}

    except Exception as e:
        print(f"  WARNING: OIG download failed: {e}")
        return {'npi': {}, 'name': {}}


# ─── Step 3: SAM.gov Debarment ───

def download_sam_exclusions() -> list:
    """Fetch SAM.gov exclusion records. Try API first, fall back to ZIP."""
    print("  Fetching SAM.gov exclusions...")
    records = []

    # Try API first
    try:
        resp = requests.get(SAM_API_URL, params={
            'purposeOfRegistrationCode': 'Z2',
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
                name = entity_info.get('entityName', '') or ''
                addr = (phys.get('addressLine1', '') or '')
                city = (phys.get('city', '') or '')
                state = (phys.get('stateOrProvinceCode', '') or '')

                records.append({
                    'name': name.strip(),
                    'address': addr.strip(),
                    'city': city.strip(),
                    'state': state.strip(),
                })

            print(f"  SAM API: {len(records)} exclusion records")
            if records:
                return records

    except Exception as e:
        print(f"  SAM API failed ({e}), trying ZIP fallback...")

    # ZIP fallback
    try:
        resp = requests.get(SAM_ZIP_URL, timeout=120)
        if resp.status_code == 200:
            z = zipfile.ZipFile(io.BytesIO(resp.content))
            for name in z.namelist():
                if name.endswith('.csv') or name.endswith('.CSV'):
                    with z.open(name) as f:
                        content = f.read().decode('latin-1', errors='replace')
                        reader = csv.DictReader(io.StringIO(content))
                        for row in reader:
                            ent_name = (row.get('Name') or row.get('name') or
                                        row.get('FIRM') or '').strip()
                            addr = (row.get('Address') or row.get('ADDRESS') or
                                    row.get('Street') or '').strip()
                            state = (row.get('State') or row.get('STATE') or '').strip()

                            if ent_name:
                                records.append({
                                    'name': ent_name,
                                    'address': addr,
                                    'city': '',
                                    'state': state,
                                })
                    break

            print(f"  SAM ZIP: {len(records)} exclusion records")
    except Exception as e:
        print(f"  WARNING: SAM.gov download failed: {e}")

    return records


def check_sam_match(provider_name: str, provider_addr: str, sam_records: list) -> bool:
    """Check if provider matches any SAM exclusion by fuzzy name or address."""
    pname = provider_name.upper().strip()
    paddr = normalize_address(provider_addr)

    for rec in sam_records:
        rname = rec['name'].upper().strip()
        raddr = normalize_address(rec['address'])

        # Fuzzy name match (Levenshtein distance ≤ 2)
        if pname and rname and fuzz.ratio(pname, rname) >= 90:
            return True

        # Address match
        if paddr and raddr and len(paddr) > 10 and paddr == raddr:
            return True

    return False


# ─── Step 4: OpenCorporates business verification ───

def check_opencorporates(name: str, state: str, call_count: int) -> tuple[bool, int]:
    """Check if business exists in state registry. Returns (found, new_call_count)."""
    if call_count >= OPENCORP_MAX_PER_RUN:
        return True, call_count  # assume exists if we've hit limit

    state_lower = state.lower()
    try:
        time.sleep(OPENCORP_RATE_LIMIT)
        resp = requests.get(OPENCORP_URL, params={
            'q': name,
            'jurisdiction_code': f'us_{state_lower}',
            'inactive': 'false',
        }, timeout=15)

        call_count += 1

        if resp.status_code == 200:
            data = resp.json()
            companies = data.get('results', {}).get('companies', [])
            return len(companies) > 0, call_count
        elif resp.status_code == 429:
            print("  OpenCorporates rate limited, pausing...")
            time.sleep(10)
            return True, call_count  # assume exists on rate limit
        else:
            return True, call_count  # assume exists on error

    except Exception:
        return True, call_count  # assume exists on error


# ─── Step 5: Address clustering ───

def build_address_clusters(providers: list) -> dict:
    """Map normalized address → count of providers."""
    clusters = defaultdict(int)
    for p in providers:
        addr = normalize_address(p.get('address', ''))
        if addr and len(addr) > 5:
            key = f"{addr}|{p.get('state', '')}"
            clusters[key] += 1
    return clusters


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
    print("  VIGIL Slice 1 — Ghost Operations Detection Engine")
    print("=" * 60)

    # ─── Step 1: Pull Medicare providers ───
    # Focus on riskScore >= 40 to avoid paginating all 752K rows — most impactful subset first
    print("\n[Step 1] Pulling high-risk Medicare providers from Supabase (riskScore >= 40)...")

    all_providers = []
    offset = 0
    while True:
        resp = (client.table("Provider")
                .select("id,npi,name,address,city,state,riskScore,programs,anomalies")
                .contains("programs", ["Medicare"])
                .gte("riskScore", 40)
                .range(offset, offset + BATCH_SIZE - 1)
                .execute())

        batch = resp.data or []
        if not batch:
            break

        all_providers.extend(batch)
        offset += BATCH_SIZE
        print(f"  Loaded {len(all_providers)} so far...")

        if len(batch) < BATCH_SIZE:
            break

    print(f"  Found {len(all_providers)} Medicare providers (riskScore >= 40)")

    if not all_providers:
        print("  No Medicare providers found. Exiting.")
        return

    # ─── Step 2: OIG Exclusion cross-reference ───
    print("\n[Step 2] OIG Exclusion List cross-reference...")
    oig_data = download_oig_exclusions()

    # ─── Step 3: SAM.gov Debarment check ───
    print("\n[Step 3] SAM.gov debarment check...")
    sam_records = download_sam_exclusions()

    # ─── Step 4 & 5: Process each provider ───
    print("\n[Step 4-5] Processing providers — ghost signals, address clusters...")

    # Build address clusters first
    address_clusters = build_address_clusters(all_providers)

    # Track stats
    stats = {
        'total_checked': 0,
        'oig_matches': 0,
        'sam_matches': 0,
        'ghost_signals': 0,
        'address_clusters': 0,
        'providers_updated': 0,
    }

    updates = []  # (id, new_anomalies, risk_boost)
    opencorp_calls = 0

    for i, provider in enumerate(all_providers):
        if i > 0 and i % 100 == 0:
            print(f"  Progress: {i}/{len(all_providers)} checked | "
                  f"OIG={stats['oig_matches']} SAM={stats['sam_matches']} "
                  f"Ghost={stats['ghost_signals']} Clusters={stats['address_clusters']}")

        stats['total_checked'] += 1
        pid = provider['id']
        npi = (provider.get('npi') or '').strip()
        name = (provider.get('name') or '').strip()
        address = (provider.get('address') or '').strip()
        state = (provider.get('state') or '').strip()
        risk_score = provider.get('riskScore', 0) or 0
        existing_anomalies = provider.get('anomalies') or []

        new_anomalies = []
        risk_boost = 0
        ghost_signal_count = 0
        flagged_oig = False
        flagged_sam = False

        # ── OIG check ──
        if npi and npi in oig_data['npi']:
            if "OIG Exclusion — Active Federal Ban" not in existing_anomalies:
                new_anomalies.append("OIG Exclusion — Active Federal Ban")
                risk_boost += 30
                stats['oig_matches'] += 1
                flagged_oig = True

        # ── SAM check ──
        if sam_records and not flagged_oig:
            if check_sam_match(name, address, sam_records):
                if "SAM.gov Debarred — Federal Contractor Ban" not in existing_anomalies:
                    new_anomalies.append("SAM.gov Debarred — Federal Contractor Ban")
                    risk_boost += 25
                    stats['sam_matches'] += 1
                    flagged_sam = True

        # ── Ghost signals (only if not already flagged by OIG/SAM) ──
        if not flagged_oig and not flagged_sam:
            # (a) Residential address signal
            if is_residential_signal(address):
                ghost_signal_count += 1

            # (b) No business registration + elevated risk
            if risk_score > 40 and opencorp_calls < OPENCORP_MAX_PER_RUN:
                found, opencorp_calls = check_opencorporates(name, state, opencorp_calls)
                if not found:
                    ghost_signal_count += 1

            # (c) Address cluster (mill signal)
            addr_key = f"{normalize_address(address)}|{state}"
            if address_clusters.get(addr_key, 0) >= ADDRESS_CLUSTER_THRESHOLD:
                if "Address Mill — High-Volume Shared Address" not in existing_anomalies:
                    new_anomalies.append("Address Mill — High-Volume Shared Address")
                    stats['address_clusters'] += 1
                    ghost_signal_count += 1

        # ── Apply ghost signal tag ──
        if ghost_signal_count >= 2:
            if "Ghost Operation Signal" not in existing_anomalies:
                new_anomalies.append("Ghost Operation Signal")
                risk_boost += 20
                stats['ghost_signals'] += 1

        # ── Queue update if we have new anomalies ──
        if new_anomalies:
            updates.append({
                'id': pid,
                'new_anomalies': new_anomalies,
                'risk_boost': risk_boost,
                'current_risk': risk_score,
                'current_anomalies': existing_anomalies,
            })

    print(f"\n  Scan complete: {stats['total_checked']} checked, {len(updates)} to update")

    # ─── Step 6: Upsert to Supabase ───
    print("\n[Step 6] Upserting flagged providers to Supabase...")

    for i, upd in enumerate(updates):
        merged_anomalies = list(upd['current_anomalies']) + upd['new_anomalies']
        new_risk = min(upd['current_risk'] + upd['risk_boost'], 100)

        try:
            (client.table("Provider")
             .update({
                 'anomalies': merged_anomalies,
                 'riskScore': new_risk,
             })
             .eq('id', upd['id'])
             .execute())
            stats['providers_updated'] += 1
        except Exception as e:
            print(f"  Update failed for {upd['id']}: {e}")

        if (i + 1) % 50 == 0:
            print(f"  Updated {i + 1}/{len(updates)} providers")

    # ─── Summary ───
    print("\n" + "=" * 60)
    print("  VIGIL Slice 1 — COMPLETE")
    print("=" * 60)
    print(f"  Total providers checked:  {stats['total_checked']}")
    print(f"  OIG exclusion matches:    {stats['oig_matches']}")
    print(f"  SAM.gov debarment matches:{stats['sam_matches']}")
    print(f"  Ghost operation signals:  {stats['ghost_signals']}")
    print(f"  Address mill clusters:    {stats['address_clusters']}")
    print(f"  Providers updated:        {stats['providers_updated']}")

    # ─── Save results JSON ───
    results_dir = os.path.join(os.path.dirname(__file__), 'results')
    os.makedirs(results_dir, exist_ok=True)

    today = datetime.now().strftime('%Y-%m-%d')
    results_path = os.path.join(results_dir, f'ghost_detection_{today}.json')

    results = {
        'run_date': today,
        'stats': stats,
        'flagged_providers': [
            {
                'id': u['id'],
                'new_anomalies': u['new_anomalies'],
                'risk_boost': u['risk_boost'],
            }
            for u in updates
        ],
    }

    with open(results_path, 'w') as f:
        json.dump(results, f, indent=2)

    print(f"\n  Results saved to: {results_path}")
    print("Done.")

    return stats


if __name__ == "__main__":
    main()
