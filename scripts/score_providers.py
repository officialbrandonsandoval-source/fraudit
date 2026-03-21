"""
score_providers.py — Anomaly Scoring Engine

This script will:
1. Load all providers from the database
2. For each provider, calculate statistical baselines:
   - Median billing amount by zip code and program type
   - Average patient count per provider in the same area
   - Typical license-to-first-claim timeline
3. Generate anomaly flags when a provider deviates significantly:
   - Billing > 300% of zip/program median
   - Patient addresses clustered at fewer locations than expected
   - License issued within 120 days of first claim
   - Owner linked to previously excluded/sanctioned providers
4. Compute a composite risk score (0-100) based on weighted anomaly signals
5. Update each provider's riskScore and anomalies fields in the database

Scoring weights (v1):
   - Billing deviation:    35%
   - Timeline anomaly:     20%
   - Patient clustering:   15%
   - Owner network flags:  20%
   - Multi-program overlap: 10%

Usage:
    python scripts/score_providers.py
"""

# TODO: Implement scoring engine
# Step 1: Fetch all providers from database
# Step 2: Group by zip + program for baseline calculation
# Step 3: Calculate z-scores for billing amounts
# Step 4: Check license-to-claim timelines
# Step 5: Run owner/address network analysis
# Step 6: Compute weighted composite score
# Step 7: Update database with scores and anomaly flags

if __name__ == "__main__":
    print("Scoring engine — not yet implemented")
