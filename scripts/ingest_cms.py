"""
ingest_cms.py — CMS Medicare/Medicaid Provider Payment Data Ingestion

This script will:
1. Download public CMS provider payment datasets from data.cms.gov
   - Medicare Provider Utilization & Payment Data
   - Medicaid State Drug Utilization Data
   - Home Health Agency (HHA) provider data
2. Parse CSV/JSON responses and normalize provider records
3. Match providers by NPI number and address
4. Calculate per-provider payment totals by year and program
5. Load cleaned records into the PostgreSQL `Provider` table via Prisma

Data sources:
- https://data.cms.gov/provider-summary-by-type-of-service
- https://data.cms.gov/Medicare-Physician-Supplier
- https://data.cms.gov/provider-compliance

Usage:
    python scripts/ingest_cms.py --year 2023 --state CA
"""

# TODO: Implement CMS data ingestion pipeline
# Step 1: Fetch data from CMS API endpoints
# Step 2: Parse and normalize provider records
# Step 3: Deduplicate by NPI
# Step 4: Calculate payment aggregates
# Step 5: Upsert into database

if __name__ == "__main__":
    print("CMS ingestion script — not yet implemented")
