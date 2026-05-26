// Crypto bull flag pattern detection (4h bars)
//
// Default gates (ALT tier):
// - Pole magnitude: 12-60% (crypto moves faster, but parabolas reverse harder)
// - Pole duration: 6-30 bars (1-5 days at 4h)
// - Flag duration: 4-40 bars (1-7 days at 4h)
// - Max pullback: 38.2% OF POLE MAGNITUDE (Fibonacci floor, NOT absolute)
// - Pole volume: CUMULATIVE >= 2.0x rolling average
// - Flag volume contraction: <= 0.8x pole avg volume
// - Flag slope: highs slope <= 0, lows slope >= -tolerance
// - Entry zone: +-5% of 20-EMA on 4h
// - Trend filter: price > 50-EMA on 4h
//
// MAJORS tier (BTC, ETH only):
// Same gates EXCEPT looser pole magnitude (7-40%) and looser pullback cap (50%).
//
// DIAGNOSTIC MODE: pass debugSymbol='near' as third arg to get gate-failure logs
// for NEAR bars dated 2026-05-05 through 2026-05-10. Logs nothing for any other
// asset or date. Remove after diagnosis is complete.

import { calculateEMA } from './ema.mjs';

export const ALT_GATES = {
  minPoleMagnitude: 0.12,
  maxPoleMagnitude: 0.60,
  maxPullbackFracOfPole: 0.382,
  minBarsInFlag: 4,
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

export const MAJOR_GATES = {
  ...ALT_GATES,
  minPoleMagnitude: 0.07,
  maxPoleMagnitude: 0.40,
  maxPullbackFracOfPole: 0.50,
};

export const QUALIFICATION = ALT_GATES;

export function detectCryptoFlag(bars, gates = ALT_GATES, debugSymbol = null) {
  if (!bars || bars.length < gates.minBars) return null;

  const closes = bars.map(b => b.close);
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);
  const volumes = bars.map(b => b.volume);
  const n = bars.length;
  const today = n - 1;
  const todayBar = bars[today];

  // === DIAGNOSTIC LOGGING ===
  const debugDate = todayBar.date ? todayBar.date.split('T')[0] : null;
  const isDebugTarget = debugSymbol === 'near' && debugDate >= '2026-05-05' && debugDate <= '2026-05-10';
  const debugLog = (msg) => { if (isDebugTarget) console.log(`  [NEAR ${debugDate}] ${msg}`); };

  // EMAs (4h)
  const ema10 = calculateEMA(closes, 10);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);

  if (ema50[today] == null) {
    debugLog('FAIL: ema50 not yet computed');
    return null;
  }
  if (todayBar.close < ema50[today]) {
    debugLog(`FAIL: price ${todayBar.close.toFixed(4)} < ema50 ${ema50[today].toFixed(4)} (trend filter)`);
    return null;
  }

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
  debugLog(`pole top idx ${recentHighIdx} (date ${bars[recentHighIdx].date.split('T')[0]}), recentHigh ${recentHigh.toFixed(4)}, barsInFlag ${barsInFlag}`);

  if (barsInFlag < gates.minBarsInFlag) {
    debugLog(`FAIL: barsInFlag ${barsInFlag} < min ${gates.minBarsInFlag}`);
    return null;
  }
  if (barsInFlag > gates.maxBarsInFlag) {
    debugLog(`FAIL: barsInFlag ${barsInFlag} > max ${gates.maxBarsInFlag}`);
    return null;
  }

  // ABSOLUTE pullback from pole top (sanity check — can't pull back past 100%)
  const pullbackPctAbsolute = (recentHigh - todayBar.close) / recentHigh;
  if (pullbackPctAbsolute < 0) {
    debugLog(`FAIL: pullbackAbs ${pullbackPctAbsolute.toFixed(4)} < 0 (price above pole top)`);
    return null;
  }

  // Walk backward to find pole start
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
  debugLog(`pole start idx ${poleStartIdx} (date ${bars[poleStartIdx].date.split('T')[0]}), poleStartLow ${poleStartLow.toFixed(4)}, poleBars ${poleBars}, poleMag ${(poleMagnitude*100).toFixed(1)}%`);

  if (poleMagnitude < gates.minPoleMagnitude) {
    debugLog(`FAIL: poleMag ${(poleMagnitude*100).toFixed(1)}% < min ${(gates.minPoleMagnitude*100).toFixed(1)}%`);
    return null;
  }
  if (poleMagnitude > gates.maxPoleMagnitude) {
    debugLog(`FAIL: poleMag ${(poleMagnitude*100).toFixed(1)}% > max ${(gates.maxPoleMagnitude*100).toFixed(1)}%`);
    return null;
  }
  if (poleBars < gates.minPoleBars) {
    debugLog(`FAIL: poleBars ${poleBars} < min ${gates.minPoleBars}`);
    return null;
  }

  // KEY GATE: max pullback as fraction of pole magnitude (Fibonacci convention)
  const poleDollarMove = recentHigh - poleStartLow;
  const flagDollarRetrace = recentHigh - todayBar.close;
  const pullbackFracOfPole = poleDollarMove > 0 ? flagDollarRetrace / poleDollarMove : 0;

  if (pullbackFracOfPole > gates.maxPullbackFracOfPole) {
    debugLog(`FAIL: pullback ${(pullbackFracOfPole*100).toFixed(1)}% of pole > max ${(gates.maxPullbackFracOfPole*100).toFixed(1)}%`);
    return null;
  }
  if (pullbackFracOfPole < 0) {
    debugLog(`FAIL: pullbackFrac ${pullbackFracOfPole.toFixed(4)} < 0`);
    return null;
  }

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

  if (cumulativeVolumeRatio < gates.minCumulativePoleVolumeRatio) {
    debugLog(`FAIL: cumulVolRatio ${cumulativeVolumeRatio.toFixed(2)}x < min ${gates.minCumulativePoleVolumeRatio}x`);
    return null;
  }

  // Max single-bar volume ratio for display/scoring purposes
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

  if (volumeContractionRatio > gates.maxFlagVolumeContraction) {
    debugLog(`FAIL: flagVolContraction ${volumeContractionRatio.toFixed(2)}x > max ${gates.maxFlagVolumeContraction}x`);
    return null;
  }

  // === SLOPE CHECKS ===
  const highsSlope = computeNormalizedSlope(flagHighsForSlope);
  const lowsSlope = computeNormalizedSlope(flagLowsForSlope);

  if (highsSlope > gates.maxFlagHighsSlope) {
    debugLog(`FAIL: highsSlope ${highsSlope.toFixed(5)} > max ${gates.maxFlagHighsSlope}`);
    return null;
  }
  if (lowsSlope < gates.minFlagLowsSlope) {
    debugLog(`FAIL: lowsSlope ${lowsSlope.toFixed(5)} < min ${gates.minFlagLowsSlope}`);
    return null;
  }

  // === ENTRY ZONE ===
  const ema10Now = ema10[today];
  const ema20Now = ema20[today];
  const ema50Now = ema50[today];

  if (ema20Now == null) {
    debugLog('FAIL: ema20 not yet computed');
    return null;
  }
  const distAbove20Ema = (todayBar.close - ema20Now) / ema20Now;
  if (distAbove20Ema > gates.maxDistAbove20Ema) {
    debugLog(`FAIL: distAbove20Ema ${(distAbove20Ema*100).toFixed(2)}% > max ${(gates.maxDistAbove20Ema*100).toFixed(2)}%`);
    return null;
  }
  if (distAbove20Ema < -gates.maxDistBelow20Ema) {
    debugLog(`FAIL: distAbove20Ema ${(distAbove20Ema*100).toFixed(2)}% < -max ${(gates.maxDistBelow20Ema*100).toFixed(2)}%`);
    return null;
  }

  debugLog(`PASS: all gates passed, flag would fire`);

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
      maxBarVolumeRatio,
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
// Returns null if there aren't enough bars to compute EMAs.
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

  // Stack classification
  let stack = 'mixed';
  if (ema10Now > ema20Now && ema20Now > ema50Now) stack = 'bullish';
  else if (ema10Now < ema20Now && ema20Now < ema50Now) stack = 'bearish';

  // 3-bar direction (same logic as flag detection)
  let direction = 'flat';
  if (n >= 4) {
    const threeBarsAgo = closes[n - 4];
    const change = (todayBar.close - threeBarsAgo) / threeBarsAgo;
    if (change < -0.008) direction = 'descending';
    else if (change > 0.015) direction = 'ascending';
  }

  // 24h change = 6 bars of 4h
  const sixBarsAgo = Math.max(0, today - 6);
  const change24h = (todayBar.close - closes[sixBarsAgo]) / closes[sixBarsAgo];

  // Distance from 20-EMA
  const distAbove20Ema = (todayBar.close - ema20Now) / ema20Now;

  // 50-EMA rising over last 10 bars
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
  if (barsInFlag <= 16) return 'early';
  if (barsInFlag <= 22) return 'forming';
  if (barsInFlag <= 32) return 'prime';
  return 'late';
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
  const slope = (n * sumXY - sumX * sumY) / denom;
  return slope;
}
