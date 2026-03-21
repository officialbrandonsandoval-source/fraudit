"""
ingest_ca_registry.py — California Business Registry Data

This script will:
1. Pull business entity records from the CA Secretary of State API
2. Extract registration dates, agent info, and entity status
3. Match businesses to providers by name and address
4. Flag providers whose business registration is suspiciously recent
   relative to their first government payment claim
5. Identify shared owners/agents across multiple provider entities

Data source:
- https://bizfileonline.sos.ca.gov/api (CA Secretary of State)
- CalGold licensing database

Usage:
    python scripts/ingest_ca_registry.py
"""

# TODO: Implement CA business registry ingestion
# Step 1: Query CA SOS business search API
# Step 2: Parse entity details (formation date, agent, status)
# Step 3: Match to providers by name/address fuzzy matching
# Step 4: Calculate days between formation and first claim
# Step 5: Build owner/agent relationship graph

if __name__ == "__main__":
    print("CA Registry ingestion script — not yet implemented")
