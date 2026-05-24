// Crypto bull flag pattern detection (4h bars)
//
// Adapted from the equity detection with crypto-tuned gates:
// - Pole magnitude: 12-60% (vs 20-80% for stocks, because crypto moves faster but parabolas reverse harder)
// - Pole duration: 6-30 bars (1-5 days at 4h)
// - Flag duration: 12-40 bars (2-7 days at 4h)
// - Max pullback: 38.2% OF POLE MAGNITUDE (Fibonacci floor, NOT absolute) — true bull flags retrace shallowly
// - Pole volume: CUMULATIVE >= 2.0x rolling average (vs single-bar spike for stocks — crypto noise floor is higher)
// - Flag volume contraction: <= 0.8x pole avg volume (NEW gate vs stocks — filters distribution from accumulation)
// - Flag slope: highs slope <= 0, lows slope >= -tolerance (NEW gate — rejects rising wedges and descending triangles)
// - Entry zone: +-5% of 20-EMA on 4h
// - Trend filter: price > 50-EMA on 4h
//
// Single classification — no continuation vs first-stage split for crypto.

import { calculateEMA } from './ema.mjs';

const QUALIFICATION = {
  minPoleMagnitude: 0.12,
  maxPoleMagnitude: 0.60,
  // Pullback is a FRACTION OF POLE MAGNITUDE (Fibonacci convention)
  // 0.382 = max valid pullback is 38.2% of the pole's vertical move
  maxPullbackFracOfPole: 0.382,
  minBarsInFlag: 12,
  maxBarsInFlag: 40,
  recentHighLookback: 50,         // bars to look back for the pole top (~8 days at 4h)
  minBars: 90,
  poleSearchDepth: 40,            // max bars to walk back from recent high looking for pole start
  minPoleBars: 6,
  maxPoleBars: 30,
  // Cumulative pole volume must be at least this many x the rolling pole-length average
  minCumulativePoleVolumeRatio: 2.0,
  // Flag avg volume must be at most this fraction of pole avg volume (contraction)
  maxFlagVolumeContraction: 0.8,
  // Entry zone tolerance around 20-EMA
  maxDistAbove20Ema: 0.05,
  maxDistBelow20Ema: 0.05,
  // Flag highs slope must be <= 0 (downward or flat). Slope is in pct-per-bar terms.
  maxFlagHighsSlope: 0.0,
  // Flag lows slope tolerance (allow modest downward drift but reject descending-triangle collapse)
  minFlagLowsSlope: -0.005,        // -0.5% per bar minimum
};

export function detectCryptoFlag(bars) {
  if (!bars || bars.length < QUALIFICATION.minBars) return null;

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

  // Find the highest high in the recent lookback window
  const lookbackStart = Math.max(0, today - QUALIFICATION.recentHighLookback + 1);
  let recentHighIdx = lookbackStart;
  let recentHigh = highs[lookbackStart];
  for (let i = lookbackStart; i <= today; i++) {
    if (highs[i] > recentHigh) {
      recentHigh = highs[i];
      recentHighIdx = i;
    }
  }

  const barsInFlag = today - recentHighIdx;
  if (barsInFlag < QUALIFICATION.minBarsInFlag) return null;
  if (barsInFlag > QUALIFICATION.maxBarsInFlag) return null;

  // ABSOLUTE pullback from pole top (sanity check — can't pull back past 100%)
  const pullbackPctAbsolute = (recentHigh - todayBar.close) / recentHigh;
  if (pullbackPctAbsolute < 0) return null;

  // Walk backward to find pole start
  const searchStart = Math.max(0, recentHighIdx - QUALIFICATION.poleSearchDepth);
  let poleStartIdx = recentHighIdx;
  let poleStartLow = lows[recentHighIdx];

  for (let i = recentHighIdx - 1; i >= searchStart; i--) {
    if (ema50[i] != null && closes[i] < ema50[i]) break;
    if (recentHighIdx - i > QUALIFICATION.maxPoleBars) break;
    if (lows[i] < poleStartLow) {
      poleStartLow = lows[i];
      poleStartIdx = i;
    }
  }

  const poleBars = recentHighIdx - poleStartIdx;
  const poleMagnitude = (recentHigh - poleStartLow) / poleStartLow;

  if (poleMagnitude < QUALIFICATION.minPoleMagnitude) return null;
  if (poleMagnitude > QUALIFICATION.maxPoleMagnitude) return null;
  if (poleBars < QUALIFICATION.minPoleBars) return null;

  // KEY GATE: max pullback as fraction of pole magnitude (Fibonacci convention)
  // The pole rose by poleMagnitude (% of pole start). The flag pulled back by
  // pullbackPctAbsolute (% of recent high). We want: how much of the pole's vertical
  // move (in dollars) has the flag retraced?
  const poleDollarMove = recentHigh - poleStartLow;
  const flagDollarRetrace = recentHigh - todayBar.close;
  const pullbackFracOfPole = poleDollarMove > 0 ? flagDollarRetrace / poleDollarMove : 0;

  if (pullbackFracOfPole > QUALIFICATION.maxPullbackFracOfPole) return null;
  if (pullbackFracOfPole < 0) return null;

  // === POLE VOLUME: cumulative across pole bars vs rolling average ===
  let totalPoleVolume = 0;
  let poleBarCount = 0;
  for (let i = poleStartIdx; i <= recentHighIdx; i++) {
    totalPoleVolume += volumes[i];
    poleBarCount++;
  }
  const avgPoleVolume = poleBarCount > 0 ? totalPoleVolume / poleBarCount : 0;

  // Rolling average over the same window length, ending right before pole start
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

  if (cumulativeVolumeRatio < QUALIFICATION.minCumulativePoleVolumeRatio) return null;

  // Also compute the max single-bar volume ratio for display/scoring purposes
  let maxPoleDayVolume = 0;
  for (let i = poleStartIdx; i <= recentHighIdx; i++) {
    if (volumes[i] > maxPoleDayVolume) maxPoleDayVolume = volumes[i];
  }
  const maxBarVolumeRatio = avgBaseVolume > 0 ? maxPoleDayVolume / avgBaseVolume : 0;

  // === FLAG VOLUME: must be contracting vs pole avg ===
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

  if (volumeContractionRatio > QUALIFICATION.maxFlagVolumeContraction) return null;

  // === SLOPE CHECKS: flag highs should be flat or descending; lows shouldn't collapse ===
  const highsSlope = computeNormalizedSlope(flagHighsForSlope);
  const lowsSlope = computeNormalizedSlope(flagLowsForSlope);

  if (highsSlope > QUALIFICATION.maxFlagHighsSlope) return null;
  if (lowsSlope < QUALIFICATION.minFlagLowsSlope) return null;

  // === ENTRY ZONE: price within +-5% of 20-EMA ===
  const ema10Now = ema10[today];
  const ema20Now = ema20[today];
  const ema50Now = ema50[today];

  if (ema20Now == null) return null;
  const distAbove20Ema = (todayBar.close - ema20Now) / ema20Now;
  if (distAbove20Ema > QUALIFICATION.maxDistAbove20Ema) return null;
  if (distAbove20Ema < -QUALIFICATION.maxDistBelow20Ema) return null;

  // === DIRECTION: last 3 bars (12 hours) ===
  let direction = 'flat';
  if (n >= 4) {
    const threeBarsAgo = closes[n - 4];
    const change = (todayBar.close - threeBarsAgo) / threeBarsAgo;
    if (change < -0.008) direction = 'descending';
    else if (change > 0.015) direction = 'ascending';
  }

  // 50-EMA rising over last 10 bars (40 hours)
  const ema50_10barsAgo = ema50[Math.max(0, today - 10)];
  const ema50Rising = ema50_10barsAgo != null && ema50Now > ema50_10barsAgo;

  // 60-bar return (10 days) for context
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
      cumulativeVolumeRatio,    // cumulative pole volume / cumulative base volume (same N bars)
      maxBarVolumeRatio,        // max single-bar volume / avg base volume
      avgVolume: avgPoleVolume,
    },
    flag: {
      bars: flagBarCount,
      pullbackPctAbsolute,             // -X% from pole top to current
      pullbackFracOfPole,              // fraction of pole's dollar move that has been retraced
      low: flagLow,
      high: flagHigh,
      avgVolume: avgFlagVolume,
      volumeContractionRatio,
      highsSlope,                       // pct per bar
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

// Classify maturity by bar count (crypto 4h timeframe).
// 12-16 bars (~2-2.5 days): early
// 17-22 bars (~3-3.5 days): forming
// 23-32 bars (~4-5 days): prime
// 33-40 bars (~5.5-7 days): late
function classifyStage(barsInFlag) {
  if (barsInFlag <= 16) return 'early';
  if (barsInFlag <= 22) return 'forming';
  if (barsInFlag <= 32) return 'prime';
  return 'late';
}

// Normalized slope: average pct change per bar between consecutive values.
// Returns 0 if not enough data.
function computeNormalizedSlope(values) {
  if (!values || values.length < 3) return 0;
  // Linear regression on (i, value/firstValue) to get slope per bar in normalized terms
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
  // slope is in "ratio per bar" — multiply nothing else, this is already a per-bar fraction
  return slope;
}
