# SoldComps automatic collection

Official API documentation: https://www.soldcomps.io/docs

## Free-tier safeguards

- Free allowance: 700 credits/month.
- Cost: 20 credits per search + 1 per returned sale.
- Four searches, maximum 50 returned each: at most 280 credits per run.
- Runs on the 1st and 15th: at most 560 automation credits/month.
- 140 credits remain reserved.
- Before searches, the collector checks the free `/v1/usage` endpoint and requires the `free` plan with at least 280 monthly credits remaining. It does not intentionally use prepaid credits.
- The committed monthly ledger caps the workflow at two runs and 560 credits. Manual use of the same SoldComps account shares the allowance.

## Setup

1. Create a free API key: https://www.soldcomps.io/signup
2. GitHub repository → **Settings → Secrets and variables → Actions → New repository secret**.
3. Name: `SOLDCOMPS_API_KEY`; value: your API key.
4. GitHub repository → **Actions → RareSignal SoldComps collection → Run workflow**.

Never put the API key in source code, commits, public files, the website or chat.

## Search scope

- Umbreon VMAX 215/203 Evolving Skies — PSA 10 and Near Mint searches.
- Giratina V 186/196 Lost Origin — PSA 10 and Near Mint searches.
- eBay US, USD, last 90 days, maximum 50 returned per query.

## Hybrid acceptance policy

New results are split into two feeds:

- `auto-approved.json`: strict, high-confidence English PSA 10 matches that pass every deterministic check. Each entry includes a normalized `observation` ready for batch CSV export, plus the original listing and the rule-set that accepted it.
- `pending-review.json`: all ambiguous matches, every RAW result, unsupported/uncertain conditions, unknown accepted Best Offer prices, conflicting profile matches, outliers and other flagged records.

Automatic acceptance is intentionally narrow. It requires the exact target card name, set, card number, alternate-art wording, an explicit English/ENG marker, PSA 10 wording, a supported sale format and currency, a valid eBay item URL, a valid non-future sold date, a positive sold price, and no unresolved Best Offer price. Possible lots/proxies/reprints and non-English markers are excluded. RAW cards are never auto-accepted because title and marketplace condition labels cannot establish Near Mint condition reliably.

Auto-approved records remain in a separate public evidence feed. They are not silently written into the browser-local historical database. In Market Data Manager, load the feed and export all qualifying records as one CSV batch; import that CSV once through the existing validator. The original listing URL and source provenance remain attached. No exchange-rate conversion or shipping-price adjustment is applied.

The feed contains public listing information and is committed to this public repository. It never contains the API key.

## Automated quality triage

The collector adds the following fields to each pending candidate:
- `review_flags`: language, card number, grade, raw-condition, Best Offer, sale date, price, URL and provider-outlier warnings.
- `quality_tier`: `HIGH_RISK`, `NEEDS_REVIEW` or `PRELIMINARY_MATCH`.
- `valuation_eligible`: `false` for pending records; strict matches are stored separately with `true` and an explicit auto-approval rule-set.
- `review_status`: remains `PENDING`.

Important interpretation:
- Search-title language checks are heuristic. Missing an explicit English marker is a review flag, not proof that a card is foreign.
- Marketplace condition labels do not prove card condition. Raw NM requires manual inspection or reliable condition evidence.
- A Best Offer sale with unknown accepted price is not suitable for valuation.
- Duplicate detection uses eBay item IDs during collection; near-duplicate title/date/price patterns are flagged for review, not automatically deleted.
- A preliminary match is not an approved transaction. Every record still needs human confirmation.

The initial 113-record feed remains pending and is not retroactively auto-approved. The new strict rules apply to newly collected results only. This avoids silently promoting old records that were gathered before the stricter acceptance gate existed.
