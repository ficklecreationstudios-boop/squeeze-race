# Squeeze Race

A research dashboard for mechanically screening a squeeze/liquidity watchlist.

## Current release

This first release is a demo/snapshot board, not a live market feed. Sample observations are explicitly marked SNAPSHOT or DEMO. Short interest and FTD data are lagged; CTB and shares available are provider/broker specific.

## Trigger engine

- SQUEEZE FUEL: SI >= 20% AND DTC >= 5.
- PRE-SQUEEZE: price >= breakout AND RVOL >= 2x AND one stress signal: CTB >= 5%, availability <= 500,000, FTD >= 1% of float, or short-volume divergence >= 5 percentage points.
- ACTIVE SQUEEZE MECHANICS: price >= breakout AND RVOL >= 3x AND CTB >= 5% AND one: availability <= 250,000, CTB >= 10%, FTD >= 1%, or short-volume divergence >= 5pp.
- INVALIDATED: price <= 95% of breakout OR SI < 20% OR material dilution/resale event.
- GYGY LIQUIDITY EVENT: market cap < $25M AND RVOL >= 3x AND float turnover >= 25%; intentionally separate from classic short-interest squeeze logic.

## Included

- 20-ticker trigger board.
- Selected-ticker metric panel.
- Exact rule view.
- $500 example strategy simulator.
- Explicit DEMO/SNAPSHOT freshness labels.
- GitHub Actions typecheck/build workflow.

## Run

npm install
npm run dev

Open http://localhost:3000.

This is a research tool. Thresholds are mechanical screening rules and do not guarantee a squeeze or investment outcome.
