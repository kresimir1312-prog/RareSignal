# Completed-sale observation archive

This folder is the append-only archive for RareSignal market observations.

## Rules

- One JSON object per line (JSONL), one immutable batch per import.
- Never edit or replace a previously committed batch. Corrections must be new, clearly documented records or a new reviewed batch; do not silently rewrite history.
- Every batch must include its adjacent `.manifest.json` provenance file.
- Keep exact card ID, exact variant ID, condition, grade, market and currency intact.
- Only completed individual-card transactions are eligible. Exclude active listings, cancelled sales, lots/bundles, duplicate transactions and uncertain identities.
- Do not infer missing sale IDs, card IDs, variant IDs, grades, conditions, sold dates or prices.
- No currency conversion. Store the transaction currency as sold.
- Do not store personal buyer/seller data. Retain only the public transaction reference needed for verification.

## Import

From the repository root, run:

```bash
node tools/import-market-observations.mjs --input path/to/completed-sales.csv --out data/observations/batches/2026-11-06-source-name.jsonl
```

The importer writes a new JSONL file and a provenance manifest. It refuses to overwrite either. The manifest records the input CSV SHA-256, batch time, accepted/excluded counts and row-level rejection reasons.

CSV headers must use the observation field names:
`sale_id,card_id,variant_id,grade_type,condition,sale_status,sold_at,price,currency,market,source`
Optional columns: `language,source_url,is_lot,notes`.

- `grade_type`: `RAW` or `PSA10`
- `sale_status`: `COMPLETED`
- `condition`: required for RAW; use `PSA 10` for PSA10
- `sold_at`: ISO 8601 date/time
- `price`: numeric transaction amount
- `currency`: three-letter uppercase currency code
- `is_lot`: true/false
- `sale_id`: stable source transaction ID, not a made-up row number

The importer is deliberately source-neutral. It does not scrape marketplaces or fetch data. Only import sales you are entitled to access and retain under the source's terms. A source export that contains asking prices rather than completed transactions is not suitable.

The initial importer supports English cards only. Japanese and Simplified Chinese exclusive cards can be added through a later, explicit schema extension rather than silently mixed into this English batch.
