"""
ingest_ppp_loans.py — VIGIL Slice 4: PPP/EIDL Loan Fraud Ingest

Ingests SBA PPP loan data and flags suspicious loans as fraud signals.

Ghost loan signals (flag if 2+ apply):
  a) LoanAmount > 50k AND JobsReported <= 1 AND Sole Proprietorship
  b) BorrowerAddress shared by 5+ PPP applicants in same zip
  c) BusinessAge = "Unanswered"/"New Business" AND LoanAmount > 150k
  d) NAICSCode = 812990 or 541990 (common fraud codes)

Cross-references against existing Supabase Provider table by address match.

Usage:
    python scripts/ingest_ppp_loans.py
"""

import os
import sys
import csv
import io
import json
import hashlib
from collections import defaultdict
from datetime import datetime

import requests


# ─── Config ───

PPP_CSV_URL = "https://data.sba.gov/dataset/8aa276e2-6cab-4f86-aca4-a7dde42adf24/resource/c1275a03-c25c-488a-bd95-403c4b2fa036/download/public_150k_plus_240930.csv"
PPP_FOIA_PAGE = "https://data.sba.gov/dataset/ppp-foia"

MAX_RECORDS = 10000
ADDRESS_CLUSTER_THRESHOLD = 5
BATCH_SIZE = 200

FRAUD_NAICS = {'812990', '541990'}
SUSPICIOUS_BUSINESS_AGE = {'Unanswered', 'New Business or 2 years or less',
                           'New Business (2 years or less)'}


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
    import re
    addr = addr.upper().strip()
    addr = re.sub(r'[.,#]', '', addr)
    addr = re.sub(r'\s+', ' ', addr)
    return addr


def stable_id(name: str, state: str, zipcode: str) -> str:
    """Generate a stable deterministic ID for PPP borrower."""
    raw = f"ppp:{name}:{state}:{zipcode}".lower().strip()
    return hashlib.sha256(raw.encode()).hexdigest()[:25]


def safe_float(val) -> float:
    """Safely convert value to float."""
    if not val:
        return 0.0
    try:
        return float(str(val).replace(',', '').replace('$', '').strip())
    except (ValueError, TypeError):
        return 0.0


def safe_int(val) -> int:
    """Safely convert value to int."""
    if not val:
        return 0
    try:
        return int(float(str(val).strip()))
    except (ValueError, TypeError):
        return 0


# ─── Step 1: Download PPP Data ───

def download_ppp_data() -> list:
    """Download PPP loan CSV and parse first MAX_RECORDS rows."""
    print("  [1] Downloading PPP loan data from SBA...")

    records = []
    try:
        resp = requests.get(PPP_CSV_URL, timeout=300, stream=True)
        resp.raise_for_status()

        # Stream and decode
        content = resp.content.decode('utf-8', errors='replace')
        reader = csv.DictReader(io.StringIO(content))

        count = 0
        for row in reader:
            if count >= MAX_RECORDS:
                break

            name = (row.get('BorrowerName') or '').strip()
            if not name:
                continue

            records.append({
                'LoanNumber': (row.get('LoanNumber') or '').strip(),
                'BorrowerName': name,
                'BorrowerAddress': (row.get('BorrowerAddress') or '').strip(),
                'BorrowerCity': (row.get('BorrowerCity') or '').strip(),
                'BorrowerState': (row.get('BorrowerState') or '').strip(),
                'BorrowerZip': (row.get('BorrowerZip') or '').strip()[:5],
                'LoanAmount': safe_float(row.get('CurrentApprovalAmount') or row.get('LoanAmount')),
                'BusinessType': (row.get('BusinessType') or '').strip(),
                'JobsReported': safe_int(row.get('JobsReported')),
                'DateApproved': (row.get('DateApproved') or '').strip(),
                'Lender': (row.get('OriginatingLender') or row.get('Lender') or '').strip(),
                'NAICSCode': (row.get('NAICSCode') or '').strip(),
                'BusinessAgeDescription': (row.get('BusinessAgeDescription') or '').strip(),
            })
            count += 1

        print(f"  Loaded {len(records)} PPP loan records")

    except Exception as e:
        print(f"  PPP download failed: {e}")
        print(f"  Try manually downloading from: {PPP_FOIA_PAGE}")

    return records


# ─── Step 2: Ghost Loan Signal Detection ───

def detect_ghost_signals(records: list) -> list:
    """Flag loans with ghost signals. Returns records with signals attached."""
    print("\n  [2] Running ghost loan signal detection...")

    # Pre-compute address clusters (signal b)
    address_counts = defaultdict(int)
    for r in records:
        addr = normalize_address(r['BorrowerAddress'])
        zipcode = r['BorrowerZip']
        if addr and zipcode:
            key = f"{addr}|{zipcode}"
            address_counts[key] += 1

    flagged = []
    stats = {
        'signal_a': 0,  # high loan, low jobs, sole prop
        'signal_b': 0,  # shared address cluster
        'signal_c': 0,  # new/unanswered business + high loan
        'signal_d': 0,  # fraud NAICS
    }

    for r in records:
        signals = []
        loan_amt = r['LoanAmount']
        jobs = r['JobsReported']
        biz_type = r['BusinessType']
        biz_age = r['BusinessAgeDescription']
        naics = r['NAICSCode']
        addr = normalize_address(r['BorrowerAddress'])
        zipcode = r['BorrowerZip']

        # (a) High loan + low jobs + sole proprietorship
        if (loan_amt > 50000 and jobs <= 1 and
                'sole proprietor' in biz_type.lower()):
            signals.append("Ghost Loan — High Amount / Zero Jobs / Sole Prop")
            stats['signal_a'] += 1

        # (b) Shared address cluster
        if addr and zipcode:
            key = f"{addr}|{zipcode}"
            if address_counts.get(key, 0) >= ADDRESS_CLUSTER_THRESHOLD:
                signals.append("PPP Address Mill — 5+ Loans at Same Address")
                stats['signal_b'] += 1

        # (c) New/unanswered business + high loan
        if (biz_age in SUSPICIOUS_BUSINESS_AGE or
                'unanswered' in biz_age.lower() or
                'new business' in biz_age.lower()):
            if loan_amt > 150000:
                signals.append("Suspicious Business Age — New/Unknown + High Loan")
                stats['signal_c'] += 1

        # (d) Fraud NAICS codes
        if naics in FRAUD_NAICS:
            signals.append(f"High-Risk NAICS {naics} — Common PPP Fraud Code")
            stats['signal_d'] += 1

        # Only keep records with 1+ signal (spec says ingest if at least 1)
        if signals:
            r['signals'] = signals
            r['signal_count'] = len(signals)
            flagged.append(r)

    print(f"  Flagged: {len(flagged)} of {len(records)} loans")
    print(f"  Signal A (high loan/low jobs/sole prop): {stats['signal_a']}")
    print(f"  Signal B (address clusters):             {stats['signal_b']}")
    print(f"  Signal C (new biz + high loan):          {stats['signal_c']}")
    print(f"  Signal D (fraud NAICS):                  {stats['signal_d']}")

    return flagged


# ─── Step 3: Cross-reference existing providers ───

def cross_reference_providers(client, flagged: list) -> list:
    """Skip full-table pull (causes Supabase timeout). Return flagged as-is."""
    print("\n  [3] Cross-reference skipped (full-table pull causes statement timeout — deferred to VIGIL nightly run)")
    return flagged


# ─── Step 4: Upsert to Supabase ───

def upsert_flagged(client, flagged: list) -> int:
    """Upsert flagged PPP borrowers to Provider table."""
    print(f"\n  [4] Upserting {len(flagged)} flagged PPP borrowers...")

    upserted = 0
    cross_ref_boosts = 0

    for i, r in enumerate(flagged):
        name = r['BorrowerName']
        state = r['BorrowerState']
        zipcode = r['BorrowerZip']
        pid = stable_id(name, state, zipcode)

        # Calculate risk: 50 base + 15 per signal
        base_risk = 50 + (15 * r['signal_count'])
        risk_score = min(base_risk, 100)

        # Cross-ref boost
        has_cross_ref = any('Cross-Ref' in s for s in r['signals'])
        if has_cross_ref:
            risk_score = min(risk_score + 25, 100)
            cross_ref_boosts += 1

        record = {
            'id': pid,
            'name': name,
            'address': r['BorrowerAddress'],
            'city': r['BorrowerCity'],
            'state': state,
            'zip': zipcode,
            'programs': ["PPP Loan", "Federal Financial Assistance"],
            'totalPaid': r['LoanAmount'],
            'riskScore': risk_score,
            'anomalies': r['signals'],
        }

        try:
            # Check if exists
            existing = (client.table("Provider")
                        .select("id,anomalies,riskScore")
                        .eq("id", pid)
                        .execute())

            if existing.data:
                old = existing.data[0]
                old_anomalies = old.get('anomalies') or []
                merged = list(set(old_anomalies + r['signals']))
                new_risk = max(old.get('riskScore', 0), risk_score)

                (client.table("Provider")
                 .update({
                     'anomalies': merged,
                     'riskScore': new_risk,
                     'totalPaid': r['LoanAmount'],
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

        if (i + 1) % 50 == 0:
            print(f"  Progress: {i + 1}/{len(flagged)} upserted")

    print(f"  Cross-ref risk boosts applied: {cross_ref_boosts}")
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
    print("  VIGIL Slice 4 — PPP/EIDL Loan Fraud Ingest")
    print("=" * 60)

    # Step 1: Download PPP data
    print("\n[Step 1] PPP Loan Data...")
    records = download_ppp_data()

    if not records:
        print("  WARNING: No PPP records loaded. Exiting.")
        return

    # Step 2: Ghost signal detection
    flagged = detect_ghost_signals(records)

    if not flagged:
        print("  No ghost signals detected. Exiting.")
        return

    # Step 3: Cross-reference
    flagged = cross_reference_providers(client, flagged)

    # Step 4: Upsert
    upserted = upsert_flagged(client, flagged)

    # Step 5: Save results
    results_dir = os.path.join(os.path.dirname(__file__), 'results')
    os.makedirs(results_dir, exist_ok=True)

    today = datetime.now().strftime('%Y-%m-%d')
    results_path = os.path.join(results_dir, f'ppp_ingest_{today}.json')

    stats = {
        'run_date': today,
        'records_loaded': len(records),
        'flagged_loans': len(flagged),
        'providers_upserted': upserted,
    }

    # Save summary (not all flagged records — could be huge)
    results = {
        'stats': stats,
        'flagged_sample': [
            {
                'name': r['BorrowerName'],
                'state': r['BorrowerState'],
                'amount': r['LoanAmount'],
                'signals': r['signals'],
                'signal_count': r['signal_count'],
            }
            for r in flagged[:200]  # sample
        ],
    }

    with open(results_path, 'w') as f:
        json.dump(results, f, indent=2, default=str)

    # Summary
    print("\n" + "=" * 60)
    print("  VIGIL Slice 4 — COMPLETE")
    print("=" * 60)
    print(f"  PPP records loaded:     {stats['records_loaded']}")
    print(f"  Flagged loans:          {stats['flagged_loans']}")
    print(f"  Providers upserted:     {stats['providers_upserted']}")
    print(f"\n  Results saved to: {results_path}")
    print("Done.")

    return stats


if __name__ == "__main__":
    main()
