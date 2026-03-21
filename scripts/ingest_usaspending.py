"""
ingest_usaspending.py — USASpending.gov Grant & Contract Data Ingestion

This script will:
1. Query the USASpending.gov API for federal awards (grants, contracts, loans)
2. Filter by CFDA program codes relevant to healthcare, childcare, housing
3. Extract recipient organizations, amounts, and award dates
4. Cross-reference recipients with providers in our database
5. Flag any providers receiving funds from multiple federal programs

Data source:
- https://api.usaspending.gov/api/v2/search/spending_by_award/
- https://api.usaspending.gov/api/v2/recipient/

Usage:
    python scripts/ingest_usaspending.py --fiscal-year 2023
"""

# TODO: Implement USASpending ingestion pipeline
# Step 1: Query awards API with pagination
# Step 2: Filter by relevant CFDA codes
# Step 3: Normalize recipient names and addresses
# Step 4: Match against existing providers
# Step 5: Update totalPaid and programs fields

if __name__ == "__main__":
    print("USASpending ingestion script — not yet implemented")
