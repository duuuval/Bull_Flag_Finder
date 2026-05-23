# BFF · Bull Flag Finder

A daily bull flag scanner for the S&P 1500. No paywall, no email signup, no API keys required.

```
██████  ███████      ████████
██   ██ ██          ██
██████  █████      █████
██   ██ ██        ██
██████  ██       ██
```

## How it works

1. GitHub Action runs at 22:30 UTC, Monday–Friday
2. Fetches S&P 500 + 400 + 600 constituents from Wikipedia
3. Pulls 1 year of daily bars from Yahoo Finance (no API key)
4. Detects bull flag patterns: 20%+ pole, 3-20 day consolidation, ≤20% pullback
5. Scores each candidate on a 100-point rubric (pole/flag/context)
6. Writes results to `public/latest.json` and `public/scans/YYYY-MM-DD.json`
7. Commits results back to the repo
8. Vercel rebuilds the site automatically

## Setup

After cloning to a fresh GitHub repo:

1. Push the code to GitHub
2. Connect the repo to Vercel — no env vars needed
3. The GitHub Action will run on its first scheduled tick, or trigger it manually from Actions → BFF Daily Scan → Run workflow
4. After the first successful scan, `public/latest.json` will populate and the site will show real data

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
npm run scan       # run the scanner locally (~5 min for full universe)
```

## File structure

```
bff/
├── .github/workflows/scan.yml      # Daily cron
├── scripts/
│   ├── scan.mjs                    # Main scan orchestrator
│   ├── universe.mjs                # S&P 1500 fetcher
│   ├── yahoo.mjs                   # Yahoo Finance client
│   ├── detection.mjs               # Pole/flag pattern detection
│   ├── scoring.mjs                 # 100-pt rubric
│   └── ema.mjs                     # EMA + percentile helpers
├── public/
│   ├── latest.json                 # Current scan (read by UI)
│   ├── scans/YYYY-MM-DD.json       # Archived scans (per-day history)
│   └── universe-fallback.json      # Cached universe list (backup)
├── app/
│   ├── page.tsx                    # Main scanner page
│   ├── 52w/page.tsx                # 52w Radar (secondary)
│   ├── about/page.tsx              # Methodology
│   └── layout.tsx
└── components/
    ├── CandidateCard.tsx
    ├── FiftyTwoWeekCard.tsx
    ├── StageBadge.tsx
    ├── ScoreDisplay.tsx
    ├── Header.tsx
    └── ASCIIFlair.tsx
```

## Scoring rubric

100 points total, three categories:

**Pole quality (35)**
- Magnitude (15): 20% → 6 pts, scaling to 50%+ → 15 pts
- Velocity (10): ≤10 days great, >30 days weak
- Volume signature (10): max single-day vol vs 50d avg

**Flag quality (35)**
- Tightness (20): pullback depth — shallower is better
- Volume contraction (10): flag vol / pole vol
- Position vs EMAs (5): above 10-EMA is best

**Context quality (30)**
- Relative strength (15): 60-day return percentile across qualifiers
- Trend stack (10): 20-EMA > 50-EMA AND 50-EMA rising
- Market regime (5): SPY above 50-day MA

## Maturity stage

Informational, not scored. Tells you where in the lifecycle each setup is:

- 🌱 EARLY (3-4 days) — watch develop
- 🔨 FORMING (5-6 days) — could trigger soon
- 🎯 PRIME (7-14 days) — peak quality window
- ⏰ LATE (15-20 days) — momentum fading

## Archive

Every scan writes a date-stamped file to `public/scans/`. The git history of these files IS the audit trail —
no database needed. You can look back at what was flagged any day by checking out the file at that date.

## Limits and honest notes

- RS percentile is calculated across the qualifying set, not the full universe (v1 simplification)
- Yahoo Finance has occasional gaps in data — failed tickers are silently skipped
- Wikipedia scraping is fragile to layout changes — there's a fallback cache from the last successful run
- Scan takes ~5 minutes for ~1500 tickers at 200ms throttle
- The score is a starting heuristic, not validated against backtested outcomes — use the journal data to tune

## License

MIT
