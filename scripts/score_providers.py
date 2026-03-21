"""
score_providers.py — Risk Scoring Engine v3

Percentile-based normalization: computes raw anomaly scores across all 607K
providers, then converts to percentile ranks so the single highest-risk
provider = 100 and median ≈ 50.
"""

import os
import sys
import math
import time
import re


def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if not os.path.exists(env_path):
        env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
    env = {}
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, val = line.split('=', 1)
                env[key.strip()] = val.strip().strip('"')
    return env


SUITE_RE = re.compile(r'\b(suite|ste|unit|apt|#)\b', re.IGNORECASE)
RESIDENTIAL_RE = re.compile(
    r'\b(apt|apartment|condo|trailer|mobile home|lot)\b', re.IGNORECASE
)


def fetch_all_providers(client, supabase_url, supabase_key):
    """Load all providers in batches of 1000 with retry logic."""
    from supabase import create_client

    all_providers = []
    offset = 0
    page_size = 1000
    while True:
        for attempt in range(5):
            try:
                result = (
                    client.table("Provider")
                    .select("id, name, address, city, state, zip, programs, totalPaid, anomalies, ownerId")
                    .range(offset, offset + page_size - 1)
                    .execute()
                )
                break
            except Exception as e:
                if attempt < 4:
                    wait = 3 * (attempt + 1)
                    print(f"  Retry {attempt+1} at offset {offset} (waiting {wait}s): {e}")
                    time.sleep(wait)
                    client = create_client(supabase_url, supabase_key)
                else:
                    raise
        batch = result.data or []
        all_providers.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
        if len(all_providers) % 50000 < page_size:
            print(f"  Loaded {len(all_providers):,} providers...")
        # Small delay to avoid hammering the API
        if offset % 10000 == 0:
            time.sleep(0.5)
    return all_providers


def compute_raw_scores(all_providers):
    """Compute raw anomaly score for each provider."""
    total = len(all_providers)
    print(f"  Computing raw scores for {total:,} providers...")

    # --- Pre-compute group stats ---

    # State medians for totalPaid
    by_state = {}
    for p in all_providers:
        st = p.get("state") or "XX"
        by_state.setdefault(st, []).append(p["totalPaid"] or 0)
    state_median = {}
    for st, vals in by_state.items():
        vals.sort()
        n = len(vals)
        state_median[st] = vals[n // 2]

    # Program medians
    by_program = {}
    for p in all_providers:
        progs = p.get("programs") or []
        if isinstance(progs, str):
            progs = [progs]
        for prog in progs:
            by_program.setdefault(prog, []).append(p["totalPaid"] or 0)
    program_median = {}
    for prog, vals in by_program.items():
        vals.sort()
        n = len(vals)
        program_median[prog] = vals[n // 2]

    # Zip-code group stats (mean, std)
    by_zip = {}
    for p in all_providers:
        z = p.get("zip") or "00000"
        by_zip.setdefault(z, []).append(p["totalPaid"] or 0)
    zip_stats = {}
    for z, vals in by_zip.items():
        n = len(vals)
        mean = sum(vals) / n
        variance = sum((x - mean) ** 2 for x in vals) / n if n > 1 else 0
        std = math.sqrt(variance) if variance > 0 else 1
        zip_stats[z] = (mean, std)

    # Owner concentration: how many providers per owner
    owner_counts = {}
    for p in all_providers:
        oid = p.get("ownerId")
        if oid:
            owner_counts[oid] = owner_counts.get(oid, 0) + 1

    # Owner zip concentration: owner with many providers in same zip
    owner_zip_counts = {}
    for p in all_providers:
        oid = p.get("ownerId")
        z = p.get("zip") or "00000"
        if oid:
            key = f"{oid}_{z}"
            owner_zip_counts[key] = owner_zip_counts.get(key, 0) + 1

    # --- Score each provider ---
    raw_scores = []
    for p in all_providers:
        paid = p["totalPaid"] or 0
        state = p.get("state") or "XX"
        zipcode = p.get("zip") or "00000"
        address = p.get("address") or ""
        oid = p.get("ownerId")
        progs = p.get("programs") or []
        if isinstance(progs, str):
            progs = [progs]

        score = 0.0

        # 1. Billing vs state median
        sm = state_median.get(state, 1)
        if sm > 0 and paid > sm:
            ratio = paid / sm
            if ratio > 5:
                score += 25
            elif ratio > 3:
                score += 15
            elif ratio > 2:
                score += 8
            elif ratio > 1.5:
                score += 3

        # 2. Billing vs program median
        if progs:
            max_prog_ratio = 0
            for prog in progs:
                pm = program_median.get(prog, 1)
                if pm > 0:
                    max_prog_ratio = max(max_prog_ratio, paid / pm)
            if max_prog_ratio > 5:
                score += 20
            elif max_prog_ratio > 3:
                score += 12
            elif max_prog_ratio > 2:
                score += 6

        # 3. Z-score within zip group
        zmean, zstd = zip_stats.get(zipcode, (0, 1))
        z = (paid - zmean) / zstd if zstd > 0 else 0
        if z > 4:
            score += 20
        elif z > 3:
            score += 14
        elif z > 2:
            score += 8
        elif z > 1.5:
            score += 3

        # 4. Corporate entity / owner concentration flags
        if oid:
            oc = owner_counts.get(oid, 1)
            if oc >= 10:
                score += 15
            elif oc >= 5:
                score += 8
            elif oc >= 3:
                score += 3

            # Zip concentration for this owner
            ozc = owner_zip_counts.get(f"{oid}_{zipcode}", 1)
            if ozc >= 5:
                score += 10
            elif ozc >= 3:
                score += 5

        # 5. Suite / residential address
        if SUITE_RE.search(address):
            score += 3
        if RESIDENTIAL_RE.search(address):
            score += 5

        # 6. Low volume (suspiciously low billing — potential shell)
        if paid < 1000 and oid and owner_counts.get(oid, 1) >= 3:
            score += 8

        # 7. Absolute volume tiers
        if paid > 5_000_000:
            score += 15
        elif paid > 1_000_000:
            score += 8
        elif paid > 500_000:
            score += 4

        raw_scores.append(score)

    return raw_scores


def percentile_normalize(raw_scores):
    """Convert raw scores to percentile ranks (1-100)."""
    n = len(raw_scores)
    print(f"  Normalizing {n:,} scores to percentiles...")

    # Build sorted list of (raw_score, original_index)
    indexed = sorted(enumerate(raw_scores), key=lambda x: x[1])

    percentiles = [0] * n
    i = 0
    while i < n:
        # Find all tied scores
        j = i
        while j < n and indexed[j][1] == indexed[i][1]:
            j += 1
        # All tied providers get the same percentile (average rank)
        # number of providers with strictly lower score = i
        pct = math.floor((i / n) * 100)
        pct = max(1, pct)  # minimum score = 1
        for k in range(i, j):
            percentiles[indexed[k][0]] = pct
        i = j

    return percentiles


def print_distribution(percentiles):
    """Print score distribution summary."""
    bands = [
        ("90-100", 90, 101),
        ("70-89", 70, 90),
        ("50-69", 50, 70),
        ("30-49", 30, 50),
        ("Below 30", 0, 30),
    ]
    print("\n  Score Distribution:")
    print(f"  {'Band':<12} {'Count':>10} {'Pct':>8}")
    print(f"  {'-'*32}")
    total = len(percentiles)
    for label, lo, hi in bands:
        count = sum(1 for s in percentiles if lo <= s < hi)
        pct = count / total * 100
        print(f"  {label:<12} {count:>10,} {pct:>7.1f}%")
    print(f"  {'Total':<12} {total:>10,}")


def update_providers(client, all_providers, percentiles, supabase_url, supabase_key):
    """Batch update riskScore for all providers."""
    from supabase import create_client

    total = len(all_providers)
    batch_size = 500
    updated = 0
    errors = 0

    print(f"\n  Updating {total:,} providers in batches of {batch_size}...")

    for i in range(0, total, batch_size):
        batch_end = min(i + batch_size, total)
        for attempt in range(3):
            try:
                for j in range(i, batch_end):
                    client.table("Provider").update({
                        "riskScore": percentiles[j],
                    }).eq("id", all_providers[j]["id"]).execute()
                updated += batch_end - i
                break
            except Exception as e:
                if attempt < 2:
                    time.sleep(3)
                    client = create_client(supabase_url, supabase_key)
                else:
                    print(f"  Failed batch starting at {i}: {e}")
                    errors += batch_end - i

        if updated % 5000 < batch_size or i + batch_size >= total:
            print(f"  Updated {updated:,}/{total:,} providers...")

    print(f"  Update complete: {updated:,} succeeded, {errors:,} failed")
    return client


def run_scoring(dry_run=False):
    from supabase import create_client

    env = load_env()
    supabase_url = env["NEXT_PUBLIC_SUPABASE_URL"]
    supabase_key = env["SUPABASE_SERVICE_ROLE_KEY"]
    client = create_client(supabase_url, supabase_key)

    # Step 1: Load all providers
    print("\n  Step 1: Loading all providers...")
    all_providers = fetch_all_providers(client, supabase_url, supabase_key)
    print(f"  Loaded {len(all_providers):,} providers total")

    # Step 2: Compute raw anomaly scores
    print("\n  Step 2: Computing raw anomaly scores...")
    raw_scores = compute_raw_scores(all_providers)

    # Step 3: Percentile normalization
    print("\n  Step 3: Percentile normalization...")
    percentiles = percentile_normalize(raw_scores)

    # Step 4: Print distribution
    print_distribution(percentiles)

    # Raw score stats
    raw_nonzero = [s for s in raw_scores if s > 0]
    print(f"\n  Raw score stats: min={min(raw_scores):.0f}, max={max(raw_scores):.0f}, "
          f"nonzero={len(raw_nonzero):,}/{len(raw_scores):,}")

    if dry_run:
        print("\n  --dry-run mode: skipping database update")
        return

    # Step 5: Update all providers
    print("\n  Step 4: Updating Supabase...")
    client = update_providers(client, all_providers, percentiles, supabase_url, supabase_key)

    print("\n  Scoring v3 complete!")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    print("=== Risk Scoring Engine v3 — Percentile Normalization ===")
    if dry_run:
        print("  (DRY RUN — no database writes)")
    run_scoring(dry_run=dry_run)
    print("=== Done ===")
