// scripts/backtest-crypto-historical.mjs
//
// Historical backtest of BFF's crypto flag detection on BTC/ETH/SOL across 2024.
//
// Uses api.binance.us (not api.binance.com) to match production. GitHub Actions
// runners are US-based and Binance.com geo-blocks them; Binance.US is the host
// production uses and the host the runners can reach.
//
// Binance's klines endpoint caps at 1000 bars per call, so this paginates
// forward through 2024 to cover the full year on 4h bars (~2,200 bars).
//
// Imports BFF's production detection code unchanged.

import { detectCryptoFlag } from './crypto-detection.mjs';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ASSETS = [
  { symbol: 'BTC', binanceSymbol: 'BTCUSDT' },
  { symbol: 'ETH', binanceSymbol: 'ETHUSDT' },
  { symbol: 'SOL', binanceSymbol: 'SOLUSDT' },
];

const INTERVAL = '4h';

// Cover all of 2024 plus a 100-bar lead-in for EMA warmup (100 bars * 4h ≈ 17 days)
const RANGE_START = new Date('2023-12-14T00:00:00Z').getTime();
const RANGE_END = new Date('2025-01-01T00:00:00Z').getTime();

const BARS_PER_REQUEST = 1000;
const REQUEST_DELAY_MS = 300;

const BINANCE_HOST = 'https://api.binance.us'; // matches production

// ---------------------------------------------------------------------------
// Binance fetch with forward pagination
// ---------------------------------------------------------------------------

async function fetchKlines(binanceSymbol, startTime, endTime) {
  const url = new URL(`${BINANCE_HOST}/api/v3/klines`);
  url.searchParams.set('symbol', binanceSymbol);
  url.searchParams.set('interval', INTERVAL);
  url.searchParams.set('startTime', String(startTime));
  url.searchParams.set('endTime', String(endTime));
  url.searchParams.set('limit', String(BARS_PER_REQUEST));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Binance ${binanceSymbol} ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchHistoricalBars(asset) {
  console.log(`📡 ${asset.symbol}: fetching ${INTERVAL} bars...`);

  const allBars = [];
  let cursor = RANGE_START;
  let chunkCount = 0;

  while (cursor < RANGE_END) {
    chunkCount++;
    const raw = await fetchKlines(asset.binanceSymbol, cursor, RANGE_END);

    if (!Array.isArray(raw) || raw.length === 0) break;

    // Binance kline format: [openTime, open, high, low, close, volume, closeTime, ...]
    for (const k of raw) {
      allBars.push({
        date: new Date(k[0]).toISOString(),
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      });
    }

    const lastOpenTime = raw[raw.length - 1][0];
    cursor = lastOpenTime + 1;

    if (raw.length < BARS_PER_REQUEST) break;
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`   ↳ fetched ${allBars.length} bars across ${chunkCount} request(s)`);
  return allBars;
}

// ---------------------------------------------------------------------------
// Time-travel detection
// ---------------------------------------------------------------------------

function runTimeTravel(asset, bars) {
  console.log(`\n🔬 ${asset.symbol}: running detection across ${bars.length} bars...`);

  const hits = [];
  const seenPoles = new Set();

  for (let i = 100; i <= bars.length; i++) {
    const slice = bars.slice(0, i);
    const pattern = detectCryptoFlag(slice);
    if (!pattern) continue;

    const poleId = pattern.pole.startDate;
    if (seenPoles.has(poleId)) continue;
    seenPoles.add(poleId);

    const lastBar = slice[slice.length - 1];
    hits.push({
      triggerDate: lastBar.date.split('T')[0],
      polePct: pattern.pole.magnitude,
      poleStart: pattern.pole.startDate?.split('T')[0],
      flagBars: pattern.flag.bars,
      pullbackPct: pattern.flag.pullbackFrac ?? pattern.flag.pullbackFracOfPole,
      direction: pattern.current?.direction,
    });
  }

  return hits;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  BFF · HISTORICAL BACKTEST · BTC/ETH/SOL · ALL OF 2024   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log(`Host: ${BINANCE_HOST}`);
  console.log(`Window: ${new Date(RANGE_START).toISOString().split('T')[0]} → ${new Date(RANGE_END).toISOString().split('T')[0]}`);
  console.log(`Interval: ${INTERVAL}`);
  console.log(`Assets: ${ASSETS.map(a => a.symbol).join(', ')}\n`);

  const summary = [];

  for (const asset of ASSETS) {
    let bars;
    try {
      bars = await fetchHistoricalBars(asset);
    } catch (err) {
      console.error(`❌ ${asset.symbol}: fetch failed — ${err.message}`);
      summary.push({ symbol: asset.symbol, hits: 'FETCH FAILED' });
      continue;
    }

    if (bars.length < 100) {
      console.log(`⚠️  ${asset.symbol}: only ${bars.length} bars returned, skipping`);
      summary.push({ symbol: asset.symbol, hits: 'INSUFFICIENT DATA' });
      continue;
    }

    const hits = runTimeTravel(asset, bars);

    if (hits.length === 0) {
      console.log(`\n🟡 ${asset.symbol}: ZERO flags triggered across the full window`);
    } else {
      console.log(`\n✅ ${asset.symbol}: ${hits.length} distinct flag(s) triggered:`);
      hits.forEach((h, idx) => {
        const pole = (h.polePct * 100).toFixed(1);
        const pullback = h.pullbackPct != null ? `${(h.pullbackPct * 100).toFixed(0)}%` : 'n/a';
        console.log(
          `   ${idx + 1}. ${h.triggerDate}  |  pole start ${h.poleStart}  |  pole ${pole}%  |  flag ${h.flagBars} bars  |  pullback ${pullback}  |  dir ${h.direction}`
        );
      });
    }

    summary.push({ symbol: asset.symbol, hits: hits.length });
    await sleep(REQUEST_DELAY_MS);
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                      SUMMARY                             ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  for (const s of summary) {
    console.log(`   ${s.symbol.padEnd(5)} ${s.hits} ${typeof s.hits === 'number' ? 'flag(s)' : ''}`);
  }
  console.log('');
}

main().catch(err => {
  console.error('❌ Backtest failed:', err);
  process.exit(1);
});
