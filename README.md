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

## Current prototype

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
- `tools/catalogue-audit.html` — browser-based catalogue structure audit

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
