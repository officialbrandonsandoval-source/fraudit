# Fraudit — Follow the Money

Real-time fraud risk scores built on public government data. Search any provider, address, city, state, or zip code.

## What is Fraudit?

Fraudit is a public-facing tool that aggregates government payment data and surfaces statistical anomalies in healthcare provider billing. It was inspired by investigative journalist Nick Shirley, who spent months manually cross-referencing addresses and billing records to expose $170M+ in suspected California Medicaid fraud — work that led to a congressional testimony.

Fraudit does in seconds what used to take months: score every provider 0–100 based on how far their billing deviates from statistical norms, flag anomalies, and generate shareable reports journalists can act on immediately.

**This is a research tool, not an enforcement instrument.** A high risk score means billing patterns deviate from peers — it is not proof of fraud.

## Data Sources

- **CMS Medicare Physician & Supplier** — Provider-level payment data from data.cms.gov
- **USASpending.gov** — Federal contracts, grants, and loans
- **IRS 990s** — Nonprofit tax filings (public record)
- **State Business Registries** — Entity registration and licensing data

## Running the Data Pipeline

```bash
# Install Python dependencies
pip3 install supabase requests cuid2

# Ingest CMS Medicare data for California + run scoring
python3 scripts/ingest_cms.py

# Run scoring engine standalone
python3 scripts/score_providers.py
```

## Development

```bash
npm install
npm run dev
```

Requires `.env.local` with Supabase credentials:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## How to Contribute

- **Submit tips** on any provider page — anonymous, crowdsourced ground truth that improves scoring
- **Report bugs** via GitHub issues
- **Journalists**: reach out via the /contact page for data access and collaboration

## Tech Stack

- Next.js 16 + React 19
- Supabase (PostgreSQL)
- Tailwind CSS v4
- Deployed on Vercel
