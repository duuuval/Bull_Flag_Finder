// scripts/backtest-crypto-historical.mjs
//
// Historical backtest of crypto flag detection on BTC/ETH across 2024,
// testing the proposed "majors tier" gate adjustments without touching
// production code.
//
// Production crypto-detection.mjs is UNCHANGED. This script forks the
// detection function locally and runs it twice per asset:
//   - "ALTS GATES" — current production gates, for baseline comparison
//   - "MAJORS GATES" — proposed loosened gates (7% pole floor, 50% pullback)
//
// Imports calculateEMA from production ema.mjs — no need to fork that.
//
// Uses api.binance.us to match production (Binance.com geo-blocks US runners).
//
// Run via the matching workflow file (workflow_dispatch only).

import { calculateEMA } from './ema.mjs';

// ---------------------------------------------------------------------------
// Tier gate definitions
// ---------------------------------------------------------------------------

const ALTS_GATES = {
  minPoleMagnitude: 0.12,
  maxPoleMagnitude: 0.60,
  maxPullbackFracOfPole: 0.382,
  minBarsInFlag: 12,
  maxBarsInFlag: 40,
  recentHighLookback: 50,
  minBars: 90,
  poleSearchDepth: 40,
  minPoleBars: 6,
  maxPoleBars: 30,
  minCumulativePoleVolumeRatio: 2.0,
  maxFlagVolumeContraction: 0.8,
  maxDistAbove20Ema: 0.05,
  maxDistBelow20Ema: 0.05,
  maxFlagHighsSlope: 0.0,
  minFlagLowsSlope: -0.005,
};

const MAJORS_GATES = {
  ...ALTS_GATES,
  // The three changes that define the majors tier:
  minPoleMagnitude: 0.07,         // institutional names move less violently
  maxPoleMagnitude: 0.40,         // they also don't parabola as hard
  maxPullbackFracOfPole: 0.50,    // perp liquidation wicks go deeper
};

// ---------------------------------------------------------------------------
// Forked detection function (parameterized by gates)
// ---------------------------------------------------------------------------
// Functionally identical to production detectCryptoFlag except it accepts
// gates as an argument. Production behavior at ALTS_GATES is preserved
// exactly so the baseline column matches what production would have produced.

function detectFlag(bars, GATES) {
  if (!bars || bars.length < GATES.minBars) return null;

  const closes = bars.map(b => b.close);
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);
  const volumes = bars.map(b => b.volume);
  const n = bars.length;
  const today = n - 1;
  const todayBar = bars[today];

  const ema10 = calculateEMA(closes, 10);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);

  if (ema50[today] == null) return null;
  if (todayBar.close < ema50[today]) return null;

  const lookbackStart = Math.max(0, today - GATES.recentHighLookback + 1);
  let recentHighIdx = lookbackStart;
  let recentHigh = highs[lookbackStart];
  for (let i = lookbackStart; i <= today; i++) {
    if (highs[i] > recentHigh) {
      recentHigh = highs[i];
      recentHighIdx = i;
    }
  }

  const barsInFlag = today - recentHighIdx;
  if (barsInFlag < GATES.minBarsInFlag) return null;
  if (barsInFlag > GATES.maxBarsInFlag) return null;

  const pullbackPctAbsolute = (recentHigh - todayBar.close) / recentHigh;
  if (pullbackPctAbsolute < 0) return null;

  const searchStart = Math.max(0, recentHighIdx - GATES.poleSearchDepth);
  let poleStartIdx = recentHighIdx;
  let poleStartLow = lows[recentHighIdx];

  for (let i = recentHighIdx - 1; i >= searchStart; i--) {
    if (ema50[i] != null && closes[i] < ema50[i]) break;
    if (recentHighIdx - i > GATES.maxPoleBars) break;
    if (lows[i] < poleStartLow) {
      poleStartLow = lows[i];
      poleStartIdx = i;
    }
  }

  const poleBars = recentHighIdx - poleStartIdx;
  const poleMagnitude = (recentHigh - poleStartLow) / poleStartLow;

  if (poleMagnitude < GATES.minPoleMagnitude) return null;
  if (poleMagnitude > GATES.maxPoleMagnitude) return null;
  if (poleBars < GATES.minPoleBars) return null;

  const poleDollarMove = recentHigh - poleStartLow;
  const flagDollarRetrace = recentHigh - todayBar.close;
  const pullbackFracOfPole = poleDollarMove > 0 ? flagDollarRetrace / poleDollarMove : 0;

  if (pullbackFracOfPole > GATES.maxPullbackFracOfPole) return null;
  if (pullbackFracOfPole < 0) return null;

  // Pole volume: cumulative across pole bars vs rolling average
  let totalPoleVolume = 0;
  let poleBarCount = 0;
  for (let i = poleStartIdx; i <= recentHighIdx; i++) {
    totalPoleVolume += volumes[i];
    poleBarCount++;
  }
  const avgPoleVolume = poleBarCount > 0 ? totalPoleVolume / poleBarCount : 0;

  const volBaseEnd = poleStartIdx;
  const volBaseStart = Math.max(0, volBaseEnd - poleBarCount);
  let baseVolSum = 0;
  let baseVolCount = 0;
  for (let i = volBaseStart; i < volBaseEnd; i++) {
    baseVolSum += volumes[i];
    baseVolCount++;
  }
  const avgBaseVolume = baseVolCount > 0 ? baseVolSum / baseVolCount : avgPoleVolume;

  const totalBaseVolume = avgBaseVolume * poleBarCount;
  const cumulativeVolumeRatio = totalBaseVolume > 0 ? totalPoleVolume / totalBaseVolume : 0;

  if (cumulativeVolumeRatio < GATES.minCumulativePoleVolumeRatio) return null;

  // Flag volume contraction
  let flagVolSum = 0;
  let flagBarCount = 0;
  let flagLow = lows[recentHighIdx];
  let flagHigh = highs[recentHighIdx];
  const flagHighsForSlope = [];
  const flagLowsForSlope = [];

  for (let i = recentHighIdx + 1; i <= today; i++) {
    flagVolSum += volumes[i];
    flagBarCount++;
    if (lows[i] < flagLow) flagLow = lows[i];
    if (highs[i] > flagHigh) flagHigh = highs[i];
    flagHighsForSlope.push(highs[i]);
    flagLowsForSlope.push(lows[i]);
  }
  const avgFlagVolume = flagBarCount > 0 ? flagVolSum / flagBarCount : 0;
  const volumeContractionRatio = avgPoleVolume > 0 ? avgFlagVolume / avgPoleVolume : 1;

  if (volumeContractionRatio > GATES.maxFlagVolumeContraction) return null;

  // Slope checks
  const highsSlope = computeNormalizedSlope(flagHighsForSlope);
  const lowsSlope = computeNormalizedSlope(flagLowsForSlope);

  if (highsSlope > GATES.maxFlagHighsSlope) return null;
  if (lowsSlope < GATES.minFlagLowsSlope) return null;

  // Entry zone
  const ema20Now = ema20[today];
  if (ema20Now == null) return null;
  const distAbove20Ema = (todayBar.close - ema20Now) / ema20Now;
  if (distAbove20Ema > GATES.maxDistAbove20Ema) return null;
  if (distAbove20Ema < -GATES.maxDistBelow20Ema) return null;

  // Direction
  let direction = 'flat';
  if (n >= 4) {
    const threeBarsAgo = closes[n - 4];
    const change = (todayBar.close - threeBarsAgo) / threeBarsAgo;
    if (change < -0.008) direction = 'descending';
    else if (change > 0.015) direction = 'ascending';
  }

  return {
    pole: {
      startDate: bars[poleStartIdx].date,
      magnitude: poleMagnitude,
      bars: poleBars,
      cumulativeVolumeRatio,
    },
    flag: {
      bars: flagBarCount,
      pullbackFracOfPole,
      volumeContractionRatio,
    },
    current: {
      direction,
      distAbove20Ema,
    },
  };
}

function computeNormalizedSlope(values) {
  if (!values || values.length < 3) return 0;
  const first = values[0];
  if (first <= 0) return 0;
  const ys = values.map(v => v / first);
  const n = ys.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += ys[i];
    sumXY += i * ys[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

// ---------------------------------------------------------------------------
// Binance fetch (api.binance.us to match production)
// ---------------------------------------------------------------------------

const BINANCE_HOST = 'https://api.binance.us';
const INTERVAL = '4h';
const BARS_PER_REQUEST = 1000;
const REQUEST_DELAY_MS = 300;

const RANGE_START = new Date('2023-12-14T00:00:00Z').getTime();
const RANGE_END = new Date('2025-01-01T00:00:00Z').getTime();

const ASSETS = [
  { symbol: 'BTC', binanceSymbol: 'BTCUSDT' },
  { symbol: 'ETH', binanceSymbol: 'ETHUSDT' },
];

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
// Time-travel detection (runs once per gate set)
// ---------------------------------------------------------------------------

function runTimeTravel(bars, gates) {
  const hits = [];
  const seenPoles = new Set();

  for (let i = 100; i <= bars.length; i++) {
    const slice = bars.slice(0, i);
    const pattern = detectFlag(slice, gates);
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
      pullbackPct: pattern.flag.pullbackFracOfPole,
      direction: pattern.current?.direction,
    });
  }

  return hits;
}

function printHits(label, hits) {
  if (hits.length === 0) {
    console.log(`   ${label}: ZERO flags`);
    return;
  }
  console.log(`   ${label}: ${hits.length} flag(s):`);
  hits.forEach((h, idx) => {
    const pole = (h.polePct * 100).toFixed(1);
    const pullback = h.pullbackPct != null ? `${(h.pullbackPct * 100).toFixed(0)}%` : 'n/a';
    console.log(
      `     ${idx + 1}. ${h.triggerDate}  |  pole start ${h.poleStart}  |  pole ${pole}%  |  flag ${h.flagBars} bars  |  pullback ${pullback}  |  dir ${h.direction}`
    );
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   BFF · MAJORS TIER BACKTEST · BTC/ETH · ALL OF 2024     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log(`Host: ${BINANCE_HOST}`);
  console.log(`Window: ${new Date(RANGE_START).toISOString().split('T')[0]} → ${new Date(RANGE_END).toISOString().split('T')[0]}`);
  console.log(`Interval: ${INTERVAL}\n`);

  console.log('ALTS_GATES (current production):');
  console.log(`  pole: ${ALTS_GATES.minPoleMagnitude * 100}-${ALTS_GATES.maxPoleMagnitude * 100}%   pullback: ≤${(ALTS_GATES.maxPullbackFracOfPole * 100).toFixed(1)}% of pole`);
  console.log('MAJORS_GATES (proposed):');
  console.log(`  pole: ${MAJORS_GATES.minPoleMagnitude * 100}-${MAJORS_GATES.maxPoleMagnitude * 100}%   pullback: ≤${(MAJORS_GATES.maxPullbackFracOfPole * 100).toFixed(1)}% of pole`);
  console.log('');

  const summary = [];

  for (const asset of ASSETS) {
    let bars;
    try {
      bars = await fetchHistoricalBars(asset);
    } catch (err) {
      console.error(`❌ ${asset.symbol}: fetch failed — ${err.message}`);
      summary.push({ symbol: asset.symbol, alts: 'ERR', majors: 'ERR' });
      continue;
    }

    if (bars.length < 100) {
      console.log(`⚠️  ${asset.symbol}: only ${bars.length} bars, skipping`);
      continue;
    }

    const altsHits = runTimeTravel(bars, ALTS_GATES);
    const majorsHits = runTimeTravel(bars, MAJORS_GATES);

    console.log(`\n🔬 ${asset.symbol} — ${bars.length} bars`);
    printHits('alts gates  ', altsHits);
    printHits('majors gates', majorsHits);

    summary.push({
      symbol: asset.symbol,
      alts: altsHits.length,
      majors: majorsHits.length,
      newOnly: majorsHits.filter(m => !altsHits.find(a => a.poleStart === m.poleStart)).length,
    });

    await sleep(REQUEST_DELAY_MS);
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                       SUMMARY                            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('   asset   alts gates   majors gates   new under majors');
  for (const s of summary) {
    const sym = s.symbol.padEnd(7);
    const alts = String(s.alts).padEnd(12);
    const majors = String(s.majors).padEnd(14);
    const newOnly = String(s.newOnly);
    console.log(`   ${sym} ${alts} ${majors} ${newOnly}`);
  }
  console.log('');
}

main().catch(err => {
  console.error('❌ Backtest failed:', err);
  process.exit(1);
});
