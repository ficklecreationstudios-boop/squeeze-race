# Squeeze Race

Live market trigger board for a 20-name squeeze/liquidity watchlist.

## Live architecture

The browser polls `/api/market` every 10 seconds. The Next.js server reads `POLYGON_API_KEY` and requests a grouped U.S. stock snapshot, keeping the API key server-side. Polygon's stock snapshot includes current trade/quote and day/previous-day aggregates; the app derives RVOL as current daily volume / previous-day volume. Polygon documents its stock snapshots as current market snapshots and its U.S. stock APIs support REST and WebSocket delivery. citeturn2search0turn2search9

The squeeze metrics are intentionally separated from the live price adapter. Short interest is a periodic position snapshot, while FINRA explicitly distinguishes it from daily short-sale volume. FINRA provides a Reg SHO daily short-sale-volume dataset/API, but that is not equivalent to short interest. citeturn0search1turn0search4

## Setup

1. Copy `.env.example` to `.env.local`.
2. Put your provider key in `POLYGON_API_KEY`.
3. Run:

```
npm install
npm run dev
```

The browser should show `LIVE` when the provider responds.

Without a key, the board remains clearly marked `DEMO`; it does not pretend the sample values are live.

## Trigger engine

- FUEL: SI >= 20% AND DTC >= 5.
- PRE-SQUEEZE: price >= breakout AND RVOL >= 2x AND one of CTB >= 5%, availability <= 500k, FTD >= 1% float, or short-volume divergence >= 5pp.
- ACTIVE: price >= breakout AND RVOL >= 3x AND CTB >= 5% AND one of availability <= 250k, CTB >= 10%, FTD >= 1%, or short-volume divergence >= 5pp.
- INVALIDATED: price <= 95% of breakout OR SI < 20% OR material dilution/resale event.
- GYGY LIQUIDITY: market cap < $25M AND RVOL >= 3x AND float turnover >= 25%.

These are mechanical research rules, not predictions.

## Data integrity

The application never treats a missing live field as a positive signal. Every market observation carries provider, timestamp and freshness. Price/volume may be LIVE; SI/FTD remain lagged unless a separate verified adapter is connected; CTB and shares available are provider-specific and are not invented.

For real-time browser streaming rather than 10-second polling, a WebSocket provider can be added behind the same server-side adapter boundary. Finnhub documents real-time U.S. stock trades over WebSocket and says polling is not recommended for real-time updates. citeturn1search0turn1search1

## CI

GitHub Actions runs TypeScript checking and a production Next.js build on pushes/PRs to main.
