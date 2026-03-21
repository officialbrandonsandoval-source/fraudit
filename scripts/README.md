# Fraudit Data Pipeline

## Overview

These scripts ingest public government data, cross-reference providers, and generate fraud risk scores. The pipeline runs in sequence:

1. **Ingest** → Pull raw data from public APIs
2. **Match** → Deduplicate and link provider records across sources
3. **Score** → Calculate statistical anomalies and composite risk scores

## Scripts

| Script | Purpose | Data Source |
|--------|---------|-------------|
| `ingest_cms.py` | Medicare/Medicaid provider payment data | data.cms.gov |
| `ingest_usaspending.py` | Federal grants, contracts, and loans | USASpending.gov |
| `ingest_ca_registry.py` | CA business registration and licensing | CA Secretary of State |
| `score_providers.py` | Anomaly detection and risk scoring | Internal (computed) |

## Running the Pipeline

```bash
# Full pipeline
python scripts/ingest_cms.py --year 2023 --state CA
python scripts/ingest_usaspending.py --fiscal-year 2023
python scripts/ingest_ca_registry.py
python scripts/score_providers.py
```

## Data Sources

All data used by Fraudit is publicly available:

- **CMS**: Centers for Medicare & Medicaid Services publishes provider payment data under the Freedom of Information Act
- **USASpending.gov**: Required by the DATA Act to publish all federal award data
- **CA Secretary of State**: Business entity filings are public record

## Scoring Methodology

The risk score (0-100) is a weighted composite of statistical anomaly signals. A high score indicates statistical deviation from expected patterns — it is **not** an accusation of fraud.
