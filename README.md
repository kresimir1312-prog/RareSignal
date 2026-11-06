# RareSignal

**Independent Pokémon TCG Market Intelligence**

RareSignal is an English-first Pokémon card discovery and market-value research project.

## Product direction

- Free Card Finder with exact card identity and printing/variant separation
- Global market context with every estimate labelled by market and currency
- Condition-matched completed sales as the primary valuation evidence
- 30-day and 90-day medians, sale volume, observed range, trend and confidence
- Separate raw-card and graded-card values
- Transparent, dated observations and source attribution
- Multilingual architecture planned; English is the first interface language

RareSignal estimates what an exact Pokémon card is realistically worth. It does not provide country-specific buying costs, shipping calculations or delivered-price recommendations. Asking prices are not treated as completed-sale evidence.

## Latest market report\n\n- [Three-card market review — 6 November 2026](reports/2026-11-06-market-review.html): Umbreon VMAX, Giratina V and Base Set Charizard. Third-party references are clearly labelled; no BUY signals are assigned.\n\n## Current prototype

The research desk is available at `prototype.html`, with responsive styling in `prototype.css` and English catalogue search/card details in `prototype.js`.

The prototype now includes:
- TCGdex-powered English card search and identity details
- A completed-sales estimator for user-entered comparable prices
- 30-day and 90-day medians, sale count, range and simple period-over-period comparison
- Explicit condition, market and currency labels
- Historical workbook references displayed in their original source currency
- Clear separation between catalogue identity and market valuation

The estimator calculates only the data entered by the user. It is not a live marketplace feed or independently verified market estimate. The v3.9 candidate snapshot is historical and must not be represented as current pricing.

- `index.html` — project overview
- `styles.css` — overview visual system
- `app.js` — overview Card Finder
- `prototype.html` — research desk and value estimator
- `prototype.css` — research desk styling
- `prototype.js` — research desk interactions
- `market-engine.js` — completed-sale valuation and evidence-gated signal functions
- `tools/catalogue-audit.html` — browser-based catalogue structure audit

## Market Intelligence Engine (v1)

The dependency-free `market-engine.js` module provides a first, testable valuation layer:

- Accepts only completed sales with exact card and variant IDs.
- Keeps RAW and PSA 10 observations separate.
- Requires an explicit raw condition and separates market and currency groups.
- Deduplicates stable sale IDs and reports excluded observations with reasons.
- Calculates 30-day and 90-day medians, prior-period median, trend, sample counts and observed range.
- Flags IQR outliers for review; it does not silently delete them.
- Produces a transparent confidence score and conservative entry-price signal gate.
- Does not fetch, fabricate or convert market data. A live source adapter and verified observation store are still required.

The initial signal policy requires confidence of at least 70/100, eight comparable sales in 90 days and two sources before considering a BUY CANDIDATE. These are provisional research thresholds, not a promise of investment performance. BUY CANDIDATE is not an instruction to buy. Signals remain unavailable when evidence is insufficient.

Observation contract: `data/schemas/market-observation-v1.schema.json`.

## Catalogue validation

Open `tools/catalogue-audit.html` in a browser (or via a static preview server) and run the catalogue validation. This is a structural sample, not a full audit of every set.

## Data and attribution

Card catalogue data and card images are provided by [TCGdex](https://www.tcgdex.net/) through its public API. TCGdex is an independent community project and is not affiliated with or endorsed by Nintendo or The Pokémon Company. See the [TCGdex cards database](https://github.com/tcgdex/cards-database) and its licence before redistributing catalogue data or images.

RareSignal is an independent research project and is not affiliated with or endorsed by The Pokémon Company, Nintendo, Creatures or GAME FREAK.

## Development

This is a static prototype. It does not yet provide accounts, subscriptions, portfolio tracking or a connected live marketplace sales feed. Market data must be added as a separate, source-attributed layer and must never be inferred from catalogue metadata.

For local preview, serve this folder with any static web server, for example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Completed-sales ingestion (Phase 2)

A local, source-neutral CSV importer is available at `tools/import-market-observations.mjs`. It converts completed-sale exports into immutable JSONL batches and writes a provenance manifest containing the input SHA-256 and row-level rejection reasons.

Example:

```bash
node tools/import-market-observations.mjs --input path/to/completed-sales.csv --out data/observations/batches/2026-11-06-source-name.jsonl
```

The importer validates exact card/variant identifiers, English language, RAW/PSA10 grade type, condition, completed status, ISO sale date, positive price, uppercase currency and source attribution. It rejects listings, lots, duplicate sale IDs and future-dated observations. It never overwrites an existing batch. See `data/observations/README.md` and `data/templates/completed-sales-import-template.csv`.

This is an offline import utility, not a marketplace connector. It does not scrape websites, access private APIs or claim that a source offers downloadable sold data. Import only transactions that the source legitimately makes available and that may be retained under its terms. No completed-sale feed is connected yet.
