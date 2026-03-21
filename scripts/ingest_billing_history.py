#!/usr/bin/env python3
"""
Ingest CMS Medicare billing history by year into Provider.billingHistory JSONB.
Also backfills NPI for providers that don't have one yet.

Usage:
  python scripts/ingest_billing_history.py --year 2022
  python scripts/ingest_billing_history.py --year 2022 --year 2023
"""

import argparse
import json
import os
import sys
import time
from collections import defaultdict

import psycopg2
import psycopg2.extras
import requests
from dotenv import load_dotenv

# CMS "by Provider" API endpoints per year (pre-aggregated Tot_Mdcr_Pymt_Amt)
# Source: "Medicare Physician & Other Practitioners - by Provider" from data.cms.gov
YEAR_API = {
    2019: "https://data.cms.gov/data-api/v1/dataset/6a53afe5-1cbc-4b33-9dc8-926ee532dc66/data",
    2020: "https://data.cms.gov/data-api/v1/dataset/29d799aa-c660-44fe-a51a-72c4b3e661ac/data",
    2021: "https://data.cms.gov/data-api/v1/dataset/44e0a489-666c-4ea4-a1a2-360b6cdc19db/data",
    2022: "https://data.cms.gov/data-api/v1/dataset/21555c17-ec1b-4e74-b2c6-925c6cbb3147/data",
    2023: "https://data.cms.gov/data-api/v1/dataset/8ba584c6-a43a-4b0b-a35a-eb9a59e3a571/data",
}

PAGE_SIZE = 5000


def load_env():
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    load_dotenv(env_path)
    url = os.environ.get("DATABASE_URL")
    if not url:
        load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
        url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL not found")
        sys.exit(1)
    return url


def fetch_year_data(year: int):
    """
    Paginate through CMS API for a given year.
    Returns: npi_totals {npi: total_amount}, npi_names {npi: (name, state)}
    """
    base_url = YEAR_API.get(year)
    if not base_url:
        print(f"  ERROR: No API endpoint for year {year}")
        return {}, {}

    print(f"  Fetching {year} data from CMS API (paginated)...")

    totals: dict[str, float] = defaultdict(float)
    npi_names: dict[str, tuple[str, str]] = {}
    offset = 0
    total_records = 0

    while True:
        params = {"size": PAGE_SIZE, "offset": offset}
        for attempt in range(3):
            try:
                resp = requests.get(base_url, params=params, timeout=120)
                resp.raise_for_status()
                data = resp.json()
                break
            except Exception as e:
                if attempt < 2:
                    print(f"    Retry {attempt+1} at offset {offset}: {e}")
                    time.sleep(5)
                else:
                    print(f"    Failed at offset {offset}: {e} — stopping pagination")
                    data = []

        if not data:
            break

        for r in data:
            npi = (r.get("Rndrng_NPI") or "").strip()
            amt_str = r.get("Tot_Mdcr_Pymt_Amt") or "0"
            if not npi:
                continue
            try:
                amt = float(amt_str)
            except ValueError:
                continue
            totals[npi] += amt

            if npi not in npi_names:
                first = (r.get("Rndrng_Prvdr_First_Name") or "").strip()
                last = (r.get("Rndrng_Prvdr_Last_Org_Name") or "").strip()
                state = (r.get("Rndrng_Prvdr_State_Abrvtn") or "").strip()
                name = f"{first} {last}".strip()
                if name and state:
                    npi_names[npi] = (name, state)

        total_records += len(data)
        offset += PAGE_SIZE

        if total_records % 50000 < PAGE_SIZE:
            print(f"    ...{total_records:,} records, {len(totals):,} unique NPIs")

        if len(data) < PAGE_SIZE:
            break

    print(f"  {year}: {total_records:,} records -> {len(totals):,} unique NPIs")
    return dict(totals), npi_names


def backfill_npis(conn, npi_names: dict[str, tuple[str, str]]):
    """Match providers without NPI by name+state from CMS data."""
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM "Provider" WHERE npi IS NOT NULL')
    existing = cur.fetchone()[0]
    if existing > 0:
        print(f"  {existing:,} providers already have NPIs, skipping backfill")
        cur.close()
        return

    print(f"  Backfilling NPIs from {len(npi_names):,} CMS name+state mappings...")

    # Build reverse: (lower_name, lower_state) -> npi
    name_to_npi: dict[tuple[str, str], str] = {}
    for npi, (name, state) in npi_names.items():
        key = (name.lower(), state.lower())
        if key not in name_to_npi:
            name_to_npi[key] = npi

    cur.execute('SELECT id, name, state FROM "Provider" WHERE npi IS NULL')
    providers = cur.fetchall()
    print(f"  {len(providers):,} providers need NPI")

    matched = 0
    batch = []
    for pid, pname, pstate in providers:
        key = (pname.lower().strip(), pstate.lower().strip())
        npi = name_to_npi.get(key)
        if npi:
            batch.append((npi, pid))
            matched += 1
        if len(batch) >= 1000:
            psycopg2.extras.execute_batch(
                cur, 'UPDATE "Provider" SET npi = %s WHERE id = %s', batch
            )
            conn.commit()
            batch = []

    if batch:
        psycopg2.extras.execute_batch(
            cur, 'UPDATE "Provider" SET npi = %s WHERE id = %s', batch
        )
        conn.commit()

    cur.close()
    print(f"  Backfilled {matched:,} NPIs")


def ingest_year(conn, year: int, npi_totals: dict[str, float]):
    """
    Match NPI totals to providers and bulk-update billingHistory
    using a temp table + single UPDATE for speed.
    """
    cur = conn.cursor()

    # Get NPI->ID mapping
    cur.execute('SELECT id, npi FROM "Provider" WHERE npi IS NOT NULL')
    npi_to_id = {npi.strip(): pid for pid, npi in cur.fetchall()}
    print(f"  {len(npi_to_id):,} providers with NPI to match")

    # Build matched list
    matches = []
    for npi, amount in npi_totals.items():
        pid = npi_to_id.get(npi)
        if pid:
            matches.append((pid, round(amount, 2)))

    print(f"  Matched {len(matches):,} NPIs for {year}")
    if not matches:
        cur.close()
        return 0

    # Use temp table + bulk UPDATE for speed
    cur.execute("""
        CREATE TEMP TABLE _billing_update (
            provider_id TEXT,
            amount NUMERIC
        ) ON COMMIT DROP
    """)

    # Bulk insert into temp table
    psycopg2.extras.execute_values(
        cur,
        "INSERT INTO _billing_update (provider_id, amount) VALUES %s",
        matches,
        page_size=5000,
    )
    print(f"  Loaded {len(matches):,} rows into temp table")

    # Single bulk UPDATE: remove existing entry for this year, append new one
    cur.execute(
        """
        UPDATE "Provider" p
        SET "billingHistory" = (
            COALESCE(
                (SELECT jsonb_agg(elem)
                 FROM jsonb_array_elements(p."billingHistory") elem
                 WHERE (elem->>'year')::int != %s),
                '[]'::jsonb
            ) || jsonb_build_object('year', %s, 'amount', bu.amount)
        )
        FROM _billing_update bu
        WHERE p.id = bu.provider_id
        """,
        (year, year),
    )
    updated = cur.rowcount
    conn.commit()

    cur.close()
    print(f"  Updated {updated:,} providers with {year} billing data")
    return updated


def main():
    parser = argparse.ArgumentParser(description="Ingest CMS billing history by year")
    parser.add_argument(
        "--year", type=int, action="append", required=True,
        help="Year(s) to ingest (e.g., --year 2022 --year 2023)",
    )
    args = parser.parse_args()

    db_url = load_env()
    conn = psycopg2.connect(db_url)

    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM "Provider" WHERE npi IS NOT NULL')
    npi_count = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM "Provider"')
    total_count = cur.fetchone()[0]
    cur.close()
    print(f"Providers: {total_count:,} total, {npi_count:,} with NPI")

    total_updated = 0
    npi_backfilled = npi_count > 0

    for year in sorted(args.year):
        print(f"\n--- Year {year} ---")
        npi_totals, npi_names = fetch_year_data(year)

        # Reconnect for each year to avoid stale connections
        try:
            conn.close()
        except Exception:
            pass
        conn = psycopg2.connect(db_url)

        if not npi_backfilled:
            backfill_npis(conn, npi_names)
            npi_backfilled = True

        updated = ingest_year(conn, year, npi_totals)
        total_updated += updated

    cur = conn.cursor()
    cur.execute("""SELECT COUNT(*) FROM "Provider" WHERE "billingHistory" != '[]'::jsonb""")
    populated = cur.fetchone()[0]
    cur.close()
    conn.close()

    print(f"\nDone! {total_updated:,} provider-year updates")
    print(f"Providers with billing history: {populated:,}")


if __name__ == "__main__":
    main()
