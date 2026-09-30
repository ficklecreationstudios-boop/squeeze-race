# Squeeze Race

A live multi-plane research trigger board for a 20-name squeeze/liquidity watchlist.

## Keyless provider mesh

- **Price / intraday volume / historical candles:** Yahoo Finance chart endpoint, with Stooq daily fallback. No API key.
- **20-day breakout:** highest high from the prior 20 completed daily sessions.
- **Intraday RVOL:** current regular-session cumulative volume divided by the 20-session average daily volume, normalized by elapsed regular-session time. This replaces the old current-day/previous-day approximation.
- **Short interest / DTC:** FINRA Consolidated Short Interest public API. SI is bi-monthly settlement data; DTC is recomputed as current short position / FINRA average daily volume.
- **Short-volume divergence:** FINRA Reg SHO Daily Short Sale Volume public API; latest short-volume percentage minus the mean of the prior up-to-20 observations. FINRA explicitly distinguishes this flow measure from short-interest positions.
- **Float / market cap:** TradingView public scanner, matching the keyless architecture used by OpenTerminal. OpenTerminal documents a no-key mesh using public Nasdaq/Yahoo/Stooq/TradingView endpoints and warns that these are not execution-grade licensed feeds.
- **CTB / shares available:** IBorrowDesk public report/API feed when reachable; page fallback is accepted as a dated SNAPSHOT because IBorrowDesk is a single-broker Interactive Brokers feed, not market-wide borrow. If unavailable, fields remain null/DATA-GAP.
- **FTD:** SEC CNS fails-to-deliver ZIP files, with both current and legacy public path fallbacks and a descriptive User-Agent. SEC publishes these semi-monthly and notes FTD can arise from both long and short activity.

## Provenance

Every metric carries source, observation timestamp and freshness. Provider failure produces nulls/DATA-GAP rather than recycled sample values. Missing CTB, availability and FTD cannot create a positive squeeze trigger.

## Trigger engine

- FUEL: SI >= 20% AND DTC >= 5.
- PRE-SQUEEZE: price >= 20-day high AND RVOL >= 2x AND one stress condition: CTB >= 5%, availability <= 500k, FTD >= 1% float, or short-volume divergence >= 5pp.
- ACTIVE: price >= 20-day high AND RVOL >= 3x AND CTB >= 5% AND one active stress condition: availability <= 250k, CTB >= 10%, FTD >= 1% float, or short-volume divergence >= 5pp.
- INVALIDATED: SI < 20%. Price below the breakout no longer invalidates structural fuel; it simply prevents PRE-SQUEEZE/ACTIVE.
- GYGY LIQUIDITY: market cap < $25M AND RVOL >= 3x AND float turnover >= 25%.
- MONITOR: SI >= 20% but DTC < 5; tracked without mislabeling it as fuel or invalidated.\n- DATA-GAP: required fields are unavailable; no positive squeeze state is fabricated.

These are configurable research rules, not predictions or investment advice.

## Open-source references

- https://github.com/ErTasselli/OpenTerminal — MIT, zero-key public market-data mesh.
- https://github.com/guanquann/Stocksera — useful reference for FINRA short volume, SEC FTD and IBKR borrow integrations; its separate API requires a key, so Squeeze Race does not depend on that API.

## Provider diagnostics\n\n`/api/market` exposes per-field coverage, phase counts and provider availability. The UI shows coverage as `available/20`; missing CTB, availability or FTD are not treated as zero or negative squeeze evidence.\n\n## Runtime

Browser refresh: 10 seconds. Slow structural data cache: 5 minutes. Historical price/volume cache: 60 seconds. Phase transitions persist in localStorage and can trigger browser notifications.

## Verification

npm install
npm run typecheck
npm run build
npm run dev

No market-data environment variables are required.
