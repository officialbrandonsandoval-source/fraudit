"""
ingest_hospice.py — CMS Hospice Provider Data Ingestion + Ghost Hospice Detection

Downloads CMS Hospice Enrollments data, upserts into Supabase Provider table,
then flags "ghost hospices" — providers enrolled with Medicare but billing $0.
This catches the fraud pattern where fake hospices enroll in Medicare but bill
Medicaid instead, staying off the radar.

Finally generates a CA ghost hospice report JSON for the frontend.
"""

import os
import json
import time
import uuid
import requests
import psycopg2


# CMS Hospice Enrollments dataset (from data.cms.gov/data.json catalog)
HOSPICE_DATASET_ID = "25704213-e833-4b8b-9dbc-58dd17149209"
HOSPICE_API_URL = f"https://data.cms.gov/data-api/v1/dataset/{HOSPICE_DATASET_ID}/data"
PAGE_SIZE = 5000


def load_env():
    """Load env vars from .env or .env.local"""
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
    raise FileNotFoundError("No .env or .env.local found")


def fetch_hospice_data() -> list:
    """Paginate through ALL hospice enrollment records from CMS."""
    all_records = []
    offset = 0

    while True:
        params = {"size": PAGE_SIZE, "offset": offset}
        try:
            resp = requests.get(HOSPICE_API_URL, params=params, timeout=120)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"  ⚠ Error at offset {offset}: {e} — retrying...")
            time.sleep(5)
            try:
                resp = requests.get(HOSPICE_API_URL, params=params, timeout=120)
                resp.raise_for_status()
                data = resp.json()
            except Exception as e2:
                print(f"  ✗ Failed: {e2} — stopping pagination")
                break

        if not data:
            break

        all_records.extend(data)
        print(f"  Fetched {len(all_records)} records so far...")
        offset += PAGE_SIZE

        if len(data) < PAGE_SIZE:
            break

        time.sleep(0.5)

    return all_records


def parse_hospice_records(records: list) -> list:
    """Parse CMS hospice enrollment records into provider dicts.

    CMS Hospice Enrollments fields:
      - ORGANIZATION NAME, DOING BUSINESS AS NAME
      - NPI
      - ADDRESS LINE 1, ADDRESS LINE 2, CITY, STATE, ZIP CODE
      - INCORPORATION DATE, INCORPORATION STATE
      - PROPRIETARY_NONPROFIT
    Note: This is enrollment data — no payment fields. All providers start at $0.
    """
    providers = {}

    for r in records:
        # Use DBA name if available, fall back to org name
        dba = (r.get("DOING BUSINESS AS NAME") or "").strip()
        org = (r.get("ORGANIZATION NAME") or "").strip()
        name = dba if dba else org
        if not name:
            continue

        npi = (r.get("NPI") or "").strip()
        state = (r.get("STATE") or "").strip().upper()
        if not state:
            continue

        addr1 = (r.get("ADDRESS LINE 1") or "").strip()
        addr2 = (r.get("ADDRESS LINE 2") or "").strip()
        address = f"{addr1} {addr2}".strip() if addr2 else addr1

        city = (r.get("CITY") or "").strip()
        zipcode = str(r.get("ZIP CODE") or "")[:5]  # Take first 5 digits

        # Dedup by NPI (preferred) or name+state+zip
        key = npi if npi else f"{name}|{state}|{zipcode}"

        if key not in providers:
            providers[key] = {
                "name": name[:255],
                "npi": npi if npi else None,
                "address": address[:255],
                "city": city[:100],
                "state": state[:2],
                "zip": zipcode,
                "totalPaid": 0,  # Enrollment data has no payment — starts at $0
            }

    return list(providers.values())


def upsert_hospice_providers(providers: list, conn):
    """Upsert hospice providers using psycopg2 with batched operations."""
    cur = conn.cursor()

    # First, get all existing NPIs to avoid per-row lookups
    print("  Loading existing NPIs...")
    cur.execute('SELECT npi, id, programs FROM "Provider" WHERE npi IS NOT NULL')
    existing_by_npi = {}
    for row in cur.fetchall():
        existing_by_npi[row[0]] = {"id": row[1], "programs": row[2]}

    # Separate into updates vs inserts
    to_insert = []
    updated = 0

    for p in providers:
        npi = p.get("npi")
        if npi and npi in existing_by_npi:
            ex = existing_by_npi[npi]
            if "Medicare Hospice" not in (ex["programs"] or []):
                new_programs = list(ex["programs"] or []) + ["Medicare Hospice"]
                cur.execute(
                    'UPDATE "Provider" SET programs = %s::text[] WHERE id = %s',
                    (new_programs, ex["id"])
                )
                updated += 1
        else:
            to_insert.append(p)

    conn.commit()
    print(f"  Updated {updated} existing providers with Medicare Hospice program")

    # Batch insert new providers
    batch_size = 200
    inserted = 0
    for i in range(0, len(to_insert), batch_size):
        batch = to_insert[i:i + batch_size]
        values = []
        for p in batch:
            values.append((
                str(uuid.uuid4()),
                p["name"],
                p["address"],
                p["city"],
                p["state"],
                p["zip"],
                ["Medicare Hospice"],
                0,
                0,
                [],
                p.get("npi"),
                json.dumps([]),
            ))

        args_str = ",".join(
            cur.mogrify(
                "(%s, %s, %s, %s, %s, %s, %s::text[], %s, %s, %s::text[], %s, %s::jsonb)",
                v
            ).decode()
            for v in values
        )
        cur.execute(
            f'''INSERT INTO "Provider" (id, name, address, city, state, zip, programs, "totalPaid", "riskScore", anomalies, npi, "billingHistory")
                VALUES {args_str}
                ON CONFLICT (id) DO NOTHING'''
        )
        conn.commit()
        inserted += len(batch)
        print(f"  Inserted {inserted}/{len(to_insert)}...")

    cur.close()
    return inserted, updated


def flag_ghost_hospices(conn) -> int:
    """Flag enrolled hospice providers with $0 Medicare billing."""
    cur = conn.cursor()

    # Clear any existing ghost hospice anomalies to avoid duplicates
    cur.execute('''
        UPDATE "Provider"
        SET anomalies = array_remove(anomalies, 'Enrolled hospice with $0 Medicare billing — possible ghost operation')
        WHERE programs::text LIKE '%Medicare Hospice%'
    ''')

    # Flag ghost hospices
    cur.execute('''
        UPDATE "Provider"
        SET
          anomalies = array_append(anomalies, 'Enrolled hospice with $0 Medicare billing — possible ghost operation'),
          "riskScore" = LEAST(100, "riskScore" + 25)
        WHERE
          programs::text LIKE '%Medicare Hospice%'
          AND ("totalPaid" = 0 OR "totalPaid" IS NULL)
    ''')

    flagged = cur.rowcount
    conn.commit()
    cur.close()
    return flagged


def generate_ca_report(conn):
    """Generate CA ghost hospice report JSON."""
    cur = conn.cursor()
    cur.execute('''
        SELECT name, address, city, zip, "riskScore", anomalies
        FROM "Provider"
        WHERE state = 'CA'
          AND programs::text LIKE '%%Medicare Hospice%%'
          AND ("totalPaid" = 0 OR "totalPaid" IS NULL)
        ORDER BY "riskScore" DESC
        LIMIT 100
    ''')

    rows = cur.fetchall()
    cur.close()

    report = []
    for row in rows:
        anomalies = row[5]
        if isinstance(anomalies, str):
            try:
                anomalies = json.loads(anomalies)
            except (json.JSONDecodeError, TypeError):
                anomalies = [anomalies] if anomalies else []
        elif not isinstance(anomalies, list):
            anomalies = list(anomalies) if anomalies else []

        report.append({
            "name": row[0],
            "address": row[1],
            "city": row[2],
            "zip": row[3],
            "riskScore": row[4],
            "anomalies": anomalies,
        })

    report_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'reports', 'ca-ghost-hospices.json')
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)

    print(f"  CA ghost hospice report: {len(report)} providers written")
    return report


def get_top_ghost_hospices(conn, limit=5):
    """Get top ghost hospices by risk score."""
    cur = conn.cursor()
    cur.execute('''
        SELECT name, city, state, "riskScore", "totalPaid"
        FROM "Provider"
        WHERE programs::text LIKE '%%Medicare Hospice%%'
          AND ("totalPaid" = 0 OR "totalPaid" IS NULL)
        ORDER BY "riskScore" DESC
        LIMIT %s
    ''', (limit,))
    rows = cur.fetchall()
    cur.close()
    return rows


def main():
    env = load_env()
    database_url = env["DATABASE_URL"]

    print("=" * 60)
    print("  CMS Hospice Provider Ingestion + Ghost Detection")
    print("=" * 60)
    print()

    # Step 1: Fetch all hospice enrollment data
    print(f"Downloading hospice enrollment data from CMS...")
    print(f"  Dataset: {HOSPICE_DATASET_ID}")
    records = fetch_hospice_data()
    print(f"  Total records downloaded: {len(records)}")
    if records:
        print(f"  Sample fields: {list(records[0].keys())[:8]}")
    print()

    # Step 2: Parse and deduplicate
    print("Parsing and deduplicating providers...")
    providers = parse_hospice_records(records)
    print(f"  Unique hospice providers: {len(providers)}")

    state_counts = {}
    for p in providers:
        st = p["state"]
        state_counts[st] = state_counts.get(st, 0) + 1
    top_states = sorted(state_counts.items(), key=lambda x: -x[1])[:10]
    print(f"  Top states: {', '.join(f'{s}({c})' for s, c in top_states)}")
    print()

    # Step 3: Upsert to Supabase
    print("Connecting to database...")
    conn = psycopg2.connect(database_url, connect_timeout=30, options="-c statement_timeout=120000")
    print("Upserting hospice providers...")
    inserted, updated = upsert_hospice_providers(providers, conn)
    print(f"  Inserted: {inserted}, Updated (added program): {updated}")
    print()

    # Step 4: Flag ghost hospices
    print("Flagging ghost hospices (enrolled but $0 billing)...")
    flagged = flag_ghost_hospices(conn)
    print(f"  Ghost hospices flagged: {flagged}")
    print()

    # Step 5: Generate CA report
    print("Generating CA ghost hospice report...")
    ca_report = generate_ca_report(conn)
    print()

    # Step 6: Top 5 ghost hospices
    print("Top 5 highest-risk ghost hospices:")
    top5 = get_top_ghost_hospices(conn, 5)
    for i, (name, city, state, score, paid) in enumerate(top5, 1):
        print(f"  {i}. {name} — {city}, {state} — Risk: {score} — Paid: ${paid or 0:,.0f}")
    print()

    conn.close()

    print("=" * 60)
    print("  SUMMARY")
    print("=" * 60)
    print(f"  Hospice providers ingested: {len(providers)}")
    print(f"  Ghost hospices flagged: {flagged}")
    print(f"  CA report entries: {len(ca_report)}")
    print("=" * 60)


if __name__ == "__main__":
    main()
