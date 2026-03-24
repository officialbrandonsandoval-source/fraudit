"""
detect_death_billing.py — VIGIL Slice 2: Deceased Patient Billing Detector

Cross-references Medicare providers against CMS utilization data to detect
providers billing for deceased or extremely high-risk beneficiaries — one of
the most common and provable forms of Medicare fraud.

Sources:
  1. CMS Provider Utilization & Payment Data (Medicare Physician & Other Suppliers)
  2. CMS beneficiary risk scores and age demographics
  3. Internal address clustering (shared-address mill detection)

Signals:
  - Beneficiary avg risk score > 2.5 with high service volume
  - >30% of beneficiaries aged 85+ (deceased/near-death billing proxy)
  - High average allowed amount per beneficiary (inflated billing)
  - Address mills: 5+ providers sharing one address

Usage:
    python scripts/detect_death_billing.py
"""

import os
import sys
import re
import json
import time
from collections import defaultdict
from datetime import datetime

import requests


# ─── Config ───

BATCH_SIZE = 1000
CMS_DATA_URL = "https://data.cms.gov/data-api/v1/dataset/8ba584c6-a43a-4b0b-a35a-eb9a59e3a571/data"
CMS_RATE_LIMIT = 0.25      # seconds between CMS requests
CMS_MAX_LOOKUPS = 2000     # max NPI lookups per run

ADDRESS_CLUSTER_THRESHOLD = 5   # providers at same address = mill signal
BENE_RISK_THRESHOLD = 2.5       # beneficiary avg risk score threshold
HIGH_AGE_PERCENT_THRESHOLD = 0.30  # 30% of beneficiaries aged 85+
HIGH_VOLUME_THRESHOLD = 500     # total services indicating high volume
HIGH_AVG_ALLOWED_THRESHOLD = 50000  # total allowed amt ($) — high for a single provider


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
    """Normalize address for clustering comparison."""
    if not addr:
        return ""
    addr = addr.upper().strip()
    addr = re.sub(r'[.,#]', '', addr)
    addr = re.sub(r'\s+', ' ', addr)
    return addr


def _float(val) -> float:
    """Safe float conversion."""
    try:
        return float(val) if val else 0.0
    except (ValueError, TypeError):
        return 0.0


# ─── Step 1: CMS Utilization Data Lookup ───

def query_cms_for_npi(npi: str, session: requests.Session) -> dict | None:
    """Query CMS Provider Utilization data for a specific NPI.
    Uses the CMS data-api v1 endpoint with correct field names.
    Returns parsed utilization metrics or None."""
    try:
        resp = session.get(CMS_DATA_URL, params={
            'filter[Rndrng_NPI]': npi,
            'size': 10,
        }, timeout=30)

        if resp.status_code == 429:
            time.sleep(5)
            return None
        if resp.status_code != 200:
            return None

        rows = resp.json()
        if not rows or not isinstance(rows, list):
            return None

        # CMS returns one row per provider (aggregate level)
        # Use the first/primary record
        row = rows[0]

        total_services = _float(row.get('Tot_Srvcs'))
        total_benes = _float(row.get('Tot_Benes'))
        total_allowed = _float(row.get('Tot_Mdcr_Alowd_Amt'))
        total_charged = _float(row.get('Tot_Sbmtd_Chrg'))
        bene_risk = _float(row.get('Bene_Avg_Risk_Scre'))
        bene_avg_age = _float(row.get('Bene_Avg_Age'))

        # Age breakdown counts
        age_lt65 = _float(row.get('Bene_Age_LT_65_Cnt'))
        age_65_74 = _float(row.get('Bene_Age_65_74_Cnt'))
        age_75_84 = _float(row.get('Bene_Age_75_84_Cnt'))
        age_gt84 = _float(row.get('Bene_Age_GT_84_Cnt'))

        # Percentage of beneficiaries aged 85+
        total_age_benes = age_lt65 + age_65_74 + age_75_84 + age_gt84
        age_85_plus_pct = age_gt84 / total_age_benes if total_age_benes > 0 else 0

        # Per-beneficiary allowed amount
        avg_allowed_per_bene = total_allowed / total_benes if total_benes > 0 else 0

        return {
            'total_services': total_services,
            'total_benes': total_benes,
            'total_allowed': round(total_allowed, 2),
            'total_charged': round(total_charged, 2),
            'avg_risk_score': round(bene_risk, 4),
            'bene_avg_age': round(bene_avg_age, 1),
            'age_85_plus_pct': round(age_85_plus_pct, 4),
            'age_gt84_count': int(age_gt84),
            'avg_allowed_per_bene': round(avg_allowed_per_bene, 2),
            'provider_type': row.get('Rndrng_Prvdr_Type', ''),
        }

    except Exception:
        return None


# ─── Step 2: Address Clustering ───

def build_address_clusters(providers: list) -> dict:
    """Map normalized address|state → list of provider IDs."""
    clusters = defaultdict(list)
    for p in providers:
        addr = normalize_address(p.get('address', ''))
        if addr and len(addr) > 5:
            key = f"{addr}|{p.get('state', '')}"
            clusters[key].append(p['id'])
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
    print("  VIGIL Slice 2 — Deceased Patient Billing Detector")
    print("=" * 60)

    # ─── Step 1: Pull Medicare providers ───
    # Filter riskScore 40-89 to keep dataset manageable (skip already maxed + untouched low risk)
    print("\n[Step 1] Pulling Medicare providers from Supabase (riskScore 40-89)...")

    all_providers = []
    offset = 0
    while True:
        resp = (client.table("Provider")
                .select("id,npi,name,address,city,state,riskScore,programs,anomalies,totalPaid")
                .contains("programs", ["Medicare"])
                .gte("riskScore", 40)
                .lt("riskScore", 90)
                .range(offset, offset + BATCH_SIZE - 1)
                .execute())

        batch = resp.data or []
        if not batch:
            break

        all_providers.extend(batch)
        offset += BATCH_SIZE
        if len(all_providers) % 10000 == 0:
            print(f"  Loaded {len(all_providers)} so far...")

        if len(batch) < BATCH_SIZE:
            break

    print(f"  Found {len(all_providers)} Medicare providers (riskScore 40-89)")

    if not all_providers:
        print("  No eligible providers found. Exiting.")
        return

    # ─── Step 2: Query CMS for each provider with NPI ───
    print("\n[Step 2] Querying CMS utilization data for provider NPIs...")

    providers_with_npi = [p for p in all_providers if (p.get('npi') or '').strip()]
    print(f"  {len(providers_with_npi)} providers have NPIs (max {CMS_MAX_LOOKUPS} lookups)")

    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Fraudit-VIGIL/2.0 (Medicare fraud detection research)',
        'Accept': 'application/json',
    })

    cms_data = {}  # npi → utilization dict
    lookups = 0
    cms_hits = 0
    cms_errors = 0

    for i, provider in enumerate(providers_with_npi):
        if lookups >= CMS_MAX_LOOKUPS:
            print(f"  Hit CMS lookup limit ({CMS_MAX_LOOKUPS}), stopping API queries")
            break

        npi = provider['npi'].strip()
        if not npi:
            continue

        if i > 0 and i % 100 == 0:
            print(f"  CMS lookups: {i}/{len(providers_with_npi)} "
                  f"(hits={cms_hits}, errors={cms_errors})")

        result = query_cms_for_npi(npi, session)
        lookups += 1

        if result:
            cms_data[npi] = result
            cms_hits += 1
        else:
            cms_errors += 1

        time.sleep(CMS_RATE_LIMIT)

    print(f"  CMS query complete: {cms_hits} hits, {cms_errors} misses/errors")

    # ─── Step 3: Detect death billing signals ───
    print("\n[Step 3] Analyzing death billing signals...")

    stats = {
        'total_checked': 0,
        'cms_matched': cms_hits,
        'high_mortality_risk': 0,
        'high_age_billing': 0,
        'high_avg_allowed': 0,
        'address_clusters': 0,
        'providers_flagged': 0,
        'providers_updated': 0,
    }

    # Build address clusters
    address_clusters = build_address_clusters(all_providers)
    mill_addresses = {k: v for k, v in address_clusters.items()
                      if len(v) >= ADDRESS_CLUSTER_THRESHOLD}
    print(f"  Found {len(mill_addresses)} address clusters with {ADDRESS_CLUSTER_THRESHOLD}+ providers")

    updates = []

    for provider in all_providers:
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

        # ── CMS utilization signals ──
        cms = cms_data.get(npi)
        if cms:
            # Signal 1: High beneficiary risk score + high volume
            # Risk score > 2.5 means patients are very sick; combined with
            # high service volume this suggests billing for dying/deceased
            if (cms['avg_risk_score'] > BENE_RISK_THRESHOLD
                    and cms['total_services'] > HIGH_VOLUME_THRESHOLD):
                signal = "Deceased/High-Mortality Beneficiary Billing Pattern"
                if signal not in existing_anomalies:
                    new_anomalies.append(signal)
                    risk_boost += 20
                    stats['high_mortality_risk'] += 1

            # Signal 2: High percentage of 85+ aged beneficiaries
            # >30% of patients 85+ is unusual — possible billing for deceased
            if cms['age_85_plus_pct'] > HIGH_AGE_PERCENT_THRESHOLD:
                signal = "Extreme-Age Beneficiary Concentration (85+)"
                if signal not in existing_anomalies:
                    new_anomalies.append(signal)
                    risk_boost += 15
                    stats['high_age_billing'] += 1

            # Signal 3: Unusually high total allowed amount
            if (cms['total_allowed'] > HIGH_AVG_ALLOWED_THRESHOLD
                    and cms['total_services'] > 100):
                signal = "Inflated Per-Service Billing — High Avg Allowed Amount"
                if signal not in existing_anomalies:
                    new_anomalies.append(signal)
                    risk_boost += 10
                    stats['high_avg_allowed'] += 1

        # ── Address mill detection ──
        addr_key = f"{normalize_address(address)}|{state}"
        if addr_key in mill_addresses:
            signal = "Address Mill — High-Volume Shared Address"
            if signal not in existing_anomalies:
                new_anomalies.append(signal)
                risk_boost += 10
                stats['address_clusters'] += 1

        # ── Queue update ──
        if new_anomalies:
            stats['providers_flagged'] += 1
            updates.append({
                'id': pid,
                'name': name,
                'npi': npi,
                'state': state,
                'new_anomalies': new_anomalies,
                'risk_boost': risk_boost,
                'current_risk': risk_score,
                'current_anomalies': existing_anomalies,
                'cms_data': cms,
            })

    print(f"\n  Signals detected:")
    print(f"    High-mortality risk:      {stats['high_mortality_risk']}")
    print(f"    Extreme-age billing (85+):{stats['high_age_billing']}")
    print(f"    Inflated avg allowed:     {stats['high_avg_allowed']}")
    print(f"    Address mill clusters:    {stats['address_clusters']}")
    print(f"  Total providers to flag:    {stats['providers_flagged']}")

    # ─── Step 4: Upsert to Supabase ───
    print("\n[Step 4] Upserting flagged providers to Supabase...")

    for i, upd in enumerate(updates):
        merged_anomalies = list(set(upd['current_anomalies'] + upd['new_anomalies']))
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
    print("  VIGIL Slice 2 — COMPLETE")
    print("=" * 60)
    print(f"  Total providers checked:     {stats['total_checked']}")
    print(f"  CMS utilization matches:     {stats['cms_matched']}")
    print(f"  High-mortality risk flagged:  {stats['high_mortality_risk']}")
    print(f"  Extreme-age billing flagged:  {stats['high_age_billing']}")
    print(f"  Inflated billing flagged:     {stats['high_avg_allowed']}")
    print(f"  Address mill clusters:        {stats['address_clusters']}")
    print(f"  Providers updated:            {stats['providers_updated']}")

    # ─── Save results JSON ───
    results_dir = os.path.join(os.path.dirname(__file__), 'results')
    os.makedirs(results_dir, exist_ok=True)

    today = datetime.now().strftime('%Y-%m-%d')
    results_path = os.path.join(results_dir, f'death_billing_{today}.json')

    results = {
        'run_date': today,
        'stats': stats,
        'flagged_providers': [
            {
                'id': u['id'],
                'name': u['name'],
                'npi': u['npi'],
                'state': u['state'],
                'new_anomalies': u['new_anomalies'],
                'risk_boost': u['risk_boost'],
                'cms_data': u['cms_data'],
            }
            for u in updates
        ],
    }

    with open(results_path, 'w') as f:
        json.dump(results, f, indent=2, default=str)

    print(f"\n  Results saved to: {results_path}")
    print("Done.")

    return stats


if __name__ == "__main__":
    main()
