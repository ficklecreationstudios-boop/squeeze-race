# Squeeze Race

A live multi-plane research trigger board for a 20-name squeeze/liquidity watchlist.

## Keyless provider mesh

- **Price / intraday volume / historical candles:** Yahoo Finance chart endpoint, with Stooq daily fallback. No API key.
- **20-day breakout:** highest high from the prior 20 completed daily sessions.
- **Intraday RVOL:** current regular-session cumulative volume divided by the 20-session average daily volume, normalized by elapsed regular-session time. This replaces the old current-day/previous-day approximation.
- **Short interest / DTC:** FINRA Consolidated Short Interest public API. SI is bi-monthly settlement data; DTC is recomputed as current short position / FINRA average daily volume.
- **Short-volume divergence:** FINRA Reg SHO Daily Short Sale Volume public API; latest short-volume percentage minus the mean of the prior up-to-20 observations. FINRA explicitly distinguishes this flow measure from short-interest positions.
- **Float / market cap:** TradingView public scanner, matching the keyless architecture used by OpenTerminal. OpenTerminal documents a no-key mesh using public Nasdaq/Yahoo/Stooq/TradingView endpoints and warns that these are not execution-grade licensed feeds.
- **CTB / shares available:** deliberately DATA-GAP. No verified universal keyless per-name live borrow-fee feed is being invented.
- **FTD:** deliberately DATA-GAP for now. The SEC publishes authoritative CNS FTD files semi-monthly, but this revision does not yet parse the ZIP files. SEC notes FTD can arise from both long and short activity.

## Provenance

Every metric carries source, observation timestamp and freshness. Provider failure produces nulls/DATA-GAP rather than recycled sample values. Missing CTB, availability and FTD cannot create a positive squeeze trigger.

## Trigger engine

- FUEL: SI >= 20% AND DTC >= 5.
- PRE-SQUEEZE: price >= 20-day high AND RVOL >= 2x AND one stress condition: CTB >= 5%, availability <= 500k, FTD >= 1% float, or short-volume divergence >= 5pp.
- ACTIVE: price >= 20-day high AND RVOL >= 3x AND CTB >= 5% AND one active stress condition: availability <= 250k, CTB >= 10%, FTD >= 1% float, or short-volume divergence >= 5pp.
- INVALIDATED: price <= 95% of 20-day high OR SI < 20%.
- GYGY LIQUIDITY: market cap < $25M AND RVOL >= 3x AND float turnover >= 25%.
- DATA-GAP: required fields are unavailable; no positive squeeze state is fabricated.

These are configurable research rules, not predictions or investment advice.

## Open-source references

- https://github.com/ErTasselli/OpenTerminal — MIT, zero-key public market-data mesh.
- https://github.com/guanquann/Stocksera — useful reference for FINRA short volume, SEC FTD and IBKR borrow integrations; its separate API requires a key, so Squeeze Race does not depend on that API.

## Runtime

Browser refresh: 10 seconds. Slow structural data cache: 5 minutes. Historical price/volume cache: 60 seconds. Phase transitions persist in localStorage and can trigger browser notifications.

## Verification

npm install
npm run typecheck
npm run build
npm run dev

No market-data environment variables are required.
