// Crypto bull flag pattern detection (4h bars) — crypto-native timescales.
//
// Detector shape: catch sharp 1-8 bar spikes that pause briefly before continuation.
// Built around how crypto actually moves on a 4h chart, not adapted from a stock detector.
//
// Gates:
// - Pole magnitude: 10-60% (alts) / 7-60% (BTC/ETH majors)
// - Pole duration: 1-8 bars (one-bar vertical breakouts are valid)
// - Flag duration: 2-20 bars (8 hour to ~3 day pause)
// - Pullback: <= 50% of pole magnitude (liquidation wicks tolerated)
// - Volume confirmation: PEAK pole-bar volume >= 2.0x of 20-bar base (ending pre-pole)
// - Flag volume contraction: <= 1.0x pole avg
// - Flag slope: highs <= 0.005, lows >= -0.020 (loose, for short windows)
// - Trend filters: price > 50-EMA AND 50-EMA rising over last 10 bars
// - Entry zone: +-5% of 20-EMA

import { calculateEMA } from './ema.mjs';

export const ALT_GATES = {
  // Pole shape
  minPoleMagnitude: 0.10,
  maxPoleMagnitude: 0.60,
  minPoleBars: 1,
  maxPoleBars: 8,
  poleSearchDepth: 20,

  // Flag shape
  minBarsInFlag: 2,
  maxBarsInFlag: 20,
  maxPullbackFracOfPole: 0.50,

  // Volume confirmation
  volumeBaseLookback: 20,
  minPeakPoleVolumeRatio: 2.0,
  maxFlagVolumeContraction: 1.0,

  // Flag structure
  maxFlagHighsSlope: 0.005,
  minFlagLowsSlope: -0.020,

  // Entry zone
  maxDistAbove20Ema: 0.05,
  maxDistBelow20Ema: 0.05,

  // Bookkeeping
  recentHighLookback: 50,
  minBars: 90,
};

export const MAJOR_GATES = {
  ...ALT_GATES,
  minPoleMagnitude: 0.07,
};

export const QUALIFICATION = ALT_GATES;

export function detectCryptoFlag(bars, gates = ALT_GATES) {
  if (!bars || bars.length < gates.minBars) return null;

  const closes = bars.map(b => b.close);
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);
  const volumes = bars.map(b => b.volume);
  const n = bars.length;
  const today = n - 1;
  const todayBar = bars[today];

  // EMAs (4h)
  const ema10 = calculateEMA(closes, 10);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);

  if (ema50[today] == null) return null;
  if (todayBar.close < ema50[today]) return null;

  // Per-asset trend filter: 50-EMA must be rising over the last 10 bars (~1.5 days).
  // Rejects downtrend bounces and flat-mid-bear setups that pass the static "above ema50"
  // check but lack actual upward momentum.
  const ema50TrendCheck = ema50[Math.max(0, today - 10)];
  if (ema50TrendCheck == null || ema50[today] <= ema50TrendCheck) return null;

  // Find the highest high in the recent lookback window
  const lookbackStart = Math.max(0, today - gates.recentHighLookback + 1);
  let recentHighIdx = lookbackStart;
  let recentHigh = highs[lookbackStart];
  for (let i = lookbackStart; i <= today; i++) {
    if (highs[i] > recentHigh) {
      recentHigh = highs[i];
      recentHighIdx = i;
    }
  }

  const barsInFlag = today - recentHighIdx;
  if (barsInFlag < gates.minBarsInFlag) return null;
  if (barsInFlag > gates.maxBarsInFlag) return null;

  // ABSOLUTE pullback from pole top (sanity check)
  const pullbackPctAbsolute = (recentHigh - todayBar.close) / recentHigh;
  if (pullbackPctAbsolute < 0) return null;

  // Walk backward to find pole start. For fast spikes this is often just 1-3 bars back.
  const searchStart = Math.max(0, recentHighIdx - gates.poleSearchDepth);
  let poleStartIdx = recentHighIdx;
  let poleStartLow = lows[recentHighIdx];

  for (let i = recentHighIdx - 1; i >= searchStart; i--) {
    if (ema50[i] != null && closes[i] < ema50[i]) break;
    if (recentHighIdx - i > gates.maxPoleBars) break;
    if (lows[i] < poleStartLow) {
      poleStartLow = lows[i];
      poleStartIdx = i;
    }
  }

  const poleBars = recentHighIdx - poleStartIdx;
  const poleMagnitude = (recentHigh - poleStartLow) / poleStartLow;

  if (poleMagnitude < gates.minPoleMagnitude) return null;
  if (poleMagnitude > gates.maxPoleMagnitude) return null;
  if (poleBars < gates.minPoleBars) return null;

  // Pullback as fraction of pole magnitude
  const poleDollarMove = recentHigh - poleStartLow;
  const flagDollarRetrace = recentHigh - todayBar.close;
  const pullbackFracOfPole = poleDollarMove > 0 ? flagDollarRetrace / poleDollarMove : 0;

  if (pullbackFracOfPole > gates.maxPullbackFracOfPole) return null;
  if (pullbackFracOfPole < 0) return null;

  // === POLE VOLUME: peak pole-bar volume vs 20-bar base ending pre-pole ===
  const volBaseEnd = poleStartIdx;
  const volBaseStart = Math.max(0, volBaseEnd - gates.volumeBaseLookback);
  let baseVolSum = 0;
  let baseVolCount = 0;
  for (let i = volBaseStart; i < volBaseEnd; i++) {
    baseVolSum += volumes[i];
    baseVolCount++;
  }
  const avgBaseVolume = baseVolCount > 0 ? baseVolSum / baseVolCount : 0;

  let maxPoleBarVolume = 0;
  let totalPoleVolume = 0;
  let poleBarCount = 0;
  for (let i = poleStartIdx; i <= recentHighIdx; i++) {
    if (volumes[i] > maxPoleBarVolume) maxPoleBarVolume = volumes[i];
    totalPoleVolume += volumes[i];
    poleBarCount++;
  }
  const avgPoleVolume = poleBarCount > 0 ? totalPoleVolume / poleBarCount : 0;
  const peakVolumeRatio = avgBaseVolume > 0 ? maxPoleBarVolume / avgBaseVolume : 0;

  if (peakVolumeRatio < gates.minPeakPoleVolumeRatio) return null;

  // Cumulative ratio kept for display/scoring purposes (not gated)
  const cumulativeVolumeRatio = avgBaseVolume > 0 ? avgPoleVolume / avgBaseVolume : 0;

  // === FLAG VOLUME: contraction vs pole avg ===
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

  if (volumeContractionRatio > gates.maxFlagVolumeContraction) return null;

  // === SLOPE CHECKS ===
  const highsSlope = computeNormalizedSlope(flagHighsForSlope);
  const lowsSlope = computeNormalizedSlope(flagLowsForSlope);

  if (highsSlope > gates.maxFlagHighsSlope) return null;
  if (lowsSlope < gates.minFlagLowsSlope) return null;

  // === ENTRY ZONE ===
  const ema10Now = ema10[today];
  const ema20Now = ema20[today];
  const ema50Now = ema50[today];

  if (ema20Now == null) return null;
  const distAbove20Ema = (todayBar.close - ema20Now) / ema20Now;
  if (distAbove20Ema > gates.maxDistAbove20Ema) return null;
  if (distAbove20Ema < -gates.maxDistBelow20Ema) return null;

  // === DIRECTION ===
  let direction = 'flat';
  if (n >= 4) {
    const threeBarsAgo = closes[n - 4];
    const change = (todayBar.close - threeBarsAgo) / threeBarsAgo;
    if (change < -0.008) direction = 'descending';
    else if (change > 0.015) direction = 'ascending';
  }

  const ema50_10barsAgo = ema50[Math.max(0, today - 10)];
  const ema50Rising = ema50_10barsAgo != null && ema50Now > ema50_10barsAgo;

  const sixtyBarsAgo = Math.max(0, today - 60);
  const return60bars = (todayBar.close - closes[sixtyBarsAgo]) / closes[sixtyBarsAgo];

  return {
    pole: {
      startIdx: poleStartIdx,
      startDate: bars[poleStartIdx].date,
      startPrice: poleStartLow,
      endIdx: recentHighIdx,
      endDate: bars[recentHighIdx].date,
      endPrice: recentHigh,
      magnitude: poleMagnitude,
      bars: poleBars,
      cumulativeVolumeRatio,
      maxBarVolumeRatio: peakVolumeRatio,
      avgVolume: avgPoleVolume,
    },
    flag: {
      bars: flagBarCount,
      pullbackPctAbsolute,
      pullbackFracOfPole,
      low: flagLow,
      high: flagHigh,
      avgVolume: avgFlagVolume,
      volumeContractionRatio,
      highsSlope,
      lowsSlope,
    },
    current: {
      price: todayBar.close,
      open: todayBar.open,
      high: todayBar.high,
      low: todayBar.low,
      volume: todayBar.volume,
      date: todayBar.date,
      timestamp: todayBar.timestamp,
      ema10: ema10Now,
      ema20: ema20Now,
      ema50: ema50Now,
      ema50Rising,
      return60bars,
      distAbove20Ema,
      direction,
    },
    stage: classifyStage(flagBarCount),
  };
}

// Compute structural context for an asset when no flag fires.
// Used by the persistent BTC/ETH cards so they always show meaningful info.
export function computeAssetContext(bars) {
  if (!bars || bars.length < 60) return null;

  const closes = bars.map(b => b.close);
  const n = bars.length;
  const today = n - 1;
  const todayBar = bars[today];

  const ema10 = calculateEMA(closes, 10);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);

  const ema10Now = ema10[today];
  const ema20Now = ema20[today];
  const ema50Now = ema50[today];

  if (ema10Now == null || ema20Now == null || ema50Now == null) return null;

  const aboveEma50 = todayBar.close > ema50Now;

  let stack = 'mixed';
  if (ema10Now > ema20Now && ema20Now > ema50Now) stack = 'bullish';
  else if (ema10Now < ema20Now && ema20Now < ema50Now) stack = 'bearish';

  let direction = 'flat';
  if (n >= 4) {
    const threeBarsAgo = closes[n - 4];
    const change = (todayBar.close - threeBarsAgo) / threeBarsAgo;
    if (change < -0.008) direction = 'descending';
    else if (change > 0.015) direction = 'ascending';
  }

  const sixBarsAgo = Math.max(0, today - 6);
  const change24h = (todayBar.close - closes[sixBarsAgo]) / closes[sixBarsAgo];

  const distAbove20Ema = (todayBar.close - ema20Now) / ema20Now;

  const ema50_10barsAgo = ema50[Math.max(0, today - 10)];
  const ema50Rising = ema50_10barsAgo != null && ema50Now > ema50_10barsAgo;

  return {
    price: todayBar.close,
    change24h,
    ema10: ema10Now,
    ema20: ema20Now,
    ema50: ema50Now,
    ema50Rising,
    aboveEma50,
    stack,
    direction,
    distAbove20Ema,
    date: todayBar.date,
    timestamp: todayBar.timestamp,
  };
}

// Classify maturity by bar count (crypto 4h timeframe).
function classifyStage(barsInFlag) {
  if (barsInFlag <= 4) return 'early';
  if (barsInFlag <= 8) return 'forming';
  if (barsInFlag <= 14) return 'prime';
  return 'late';
}

function computeNormalizedSlope(values) {
  if (!values || values.length < 2) return 0;
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
  const slope = (n * sumXY - sumX * sumY) / denom;
  return slope;
}
