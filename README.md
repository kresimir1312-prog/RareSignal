# RareSignal

**Independent Pokémon TCG Market Intelligence**

RareSignal is an English-first, European-focused Pokémon TCG card discovery and market research project.

## MVP direction

- Free Card Finder with exact card identity and variant separation
- European market context with EUR as the default currency
- Transparent, dated market observations
- Research reports and investment analysis
- Multilingual architecture planned; English is the first interface language

## Current prototype

The initial prototype is a static website using the TCGdex public API for English card catalogue data.

- `index.html` — page structure
- `styles.css` — responsive visual system
- `app.js` — Card Finder interaction, set filtering and card detail loading
- `tools/catalogue-audit.html` — browser-based 100-card catalogue structure audit

## Catalogue validation

Open `tools/catalogue-audit.html` in a browser (or via a static preview server) and run the 100-card validation. The audit samples 20 cards from one representative set in each of five eras and reports field coverage and failed requests. Review the selected set names in the JSON report; this is a structural sample, not a full audit of every set.

## Data and attribution

Card catalogue data and card images are provided by [TCGdex](https://www.tcgdex.net/) through its public API. TCGdex is an independent community project and is not affiliated with or endorsed by Nintendo or The Pokémon Company. See the [TCGdex cards database](https://github.com/tcgdex/cards-database) and its licence before redistributing catalogue data or images.

RareSignal is an independent research project and is not affiliated with or endorsed by The Pokémon Company, Nintendo, Creatures or GAME FREAK.

## Development

This is a static prototype. It does not yet provide user accounts, paid memberships, portfolio tracking, live marketplace prices or investment signals. Market data must be added as a separate, source-attributed layer and must not be inferred from catalogue data.

For local preview, serve this folder with any static web server, for example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.
