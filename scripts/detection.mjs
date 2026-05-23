// Bull flag pattern detection
//
// Algorithm:
// 1. Find the highest high in the last 30 trading days (the "recent_high")
// 2. Walk backward from recent_high to find pole start within a tight window
// 3. Compute pole metrics; require pole to be both >= 20% AND <= 80%
// 4. Compute flag metrics
// 5. Classify as continuation vs first-stage based on pre-pole 50-EMA slope
// 6. Compute base quality (for first-stage scoring)
// 7. Gate on entry zone: price must be within ±5% of 20-EMA
// 8. Classify direction over last 3 days

import { calculateEMA, sma } from './ema.mjs';

const QUALIFICATION = {
  minPoleMagnitude: 0.20,
  maxPoleMagnitude: 0.80,
  maxPullback: 0.20,
  minDaysInFlag: 3,
  maxDaysInFlag: 20,
  recentHighLookback: 30,
  minBars: 90,
  poleSearchDepth: 30,
  maxPoleDays: 30,
  minPoleVolumeSpike: 1.5,
  maxDistAbove20Ema: 0.05,
  maxDistBelow20Ema: 0.05,
};

// Classification thresholds
const CLASSIFICATION = {
  // 50-EMA slope over the 60 days BEFORE the pole started
  // If 50-EMA rose more than this %, it's a continuation
  continuationSlopeThreshold: 0.10, // 10%+ pre-pole 50-EMA rise = continuation
  // Base measurement window: how far back to look for "the base" before the pole
  baseLookbackDays: 90,
  // Base must be at least this many days to count as a real base
  minBaseDays: 20,
};

export function detectFlag(bars) {
  if (!bars || bars.length < QUALIFICATION.minBars) return null;

  const closes = bars.map(b => b.close);
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);
  const volumes = bars.map(b => b.volume);
  const n = bars.length;
  const today = n - 1;
  const todayBar = bars[today];

  // EMAs
  const ema10 = calculateEMA(closes, 10);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);

  if (ema50[today] == null) return null;
  if (todayBar.close < ema50[today]) return null;

  // Find the highest high in the last 30 days
  const lookbackStart = Math.max(0, today - QUALIFICATION.recentHighLookback + 1);
  let recentHighIdx = lookbackStart;
  let recentHigh = highs[lookbackStart];
  for (let i = lookbackStart; i <= today; i++) {
    if (highs[i] > recentHigh) {
      recentHigh = highs[i];
      recentHighIdx = i;
    }
  }

  const daysInFlag = today - recentHighIdx;
  if (daysInFlag < QUALIFICATION.minDaysInFlag) return null;
  if (daysInFlag > QUALIFICATION.maxDaysInFlag) return null;

  const pullbackPct = (recentHigh - todayBar.close) / recentHigh;
  if (pullbackPct > QUALIFICATION.maxPullback) return null;
  if (pullbackPct < 0) return null;

  // Walk backward to find pole start
  const searchStart = Math.max(0, recentHighIdx - QUALIFICATION.poleSearchDepth);
  let poleStartIdx = recentHighIdx;
  let poleStartLow = lows[recentHighIdx];

  for (let i = recentHighIdx - 1; i >= searchStart; i--) {
    if (ema50[i] != null && closes[i] < ema50[i]) break;
    if (recentHighIdx - i > QUALIFICATION.maxPoleDays) break;
    if (lows[i] < poleStartLow) {
      poleStartLow = lows[i];
      poleStartIdx = i;
    }
  }

  const poleDays = recentHighIdx - poleStartIdx;
  const poleMagnitude = (recentHigh - poleStartLow) / poleStartLow;

  if (poleMagnitude < QUALIFICATION.minPoleMagnitude) return null;
  if (poleMagnitude > QUALIFICATION.maxPoleMagnitude) return null;
  if (poleDays < 3) return null;

  // Pole volume analysis
  let maxPoleDayVolume = 0;
  let totalPoleVolume = 0;
  let poleDayCount = 0;
  for (let i = poleStartIdx; i <= recentHighIdx; i++) {
    if (volumes[i] > maxPoleDayVolume) maxPoleDayVolume = volumes[i];
    totalPoleVolume += volumes[i];
    poleDayCount++;
  }
  const avgPoleVolume = poleDayCount > 0 ? totalPoleVolume / poleDayCount : 0;

  const volBaseEnd = poleStartIdx;
  const volBaseStart = Math.max(0, volBaseEnd - 50);
  let baseVolSum = 0;
  let baseVolCount = 0;
  for (let i = volBaseStart; i < volBaseEnd; i++) {
    baseVolSum += volumes[i];
    baseVolCount++;
  }
  const avg50dVolume = baseVolCount > 0 ? baseVolSum / baseVolCount : avgPoleVolume;
  const poleVolumeRatio = avg50dVolume > 0 ? maxPoleDayVolume / avg50dVolume : 0;

  if (poleVolumeRatio < QUALIFICATION.minPoleVolumeSpike) return null;

  // Flag volume + low
  let flagVolSum = 0;
  let flagVolCount = 0;
  let flagLow = lows[recentHighIdx];
  for (let i = recentHighIdx + 1; i <= today; i++) {
    flagVolSum += volumes[i];
    flagVolCount++;
    if (lows[i] < flagLow) flagLow = lows[i];
  }
  const avgFlagVolume = flagVolCount > 0 ? flagVolSum / flagVolCount : 0;
  const volumeContractionRatio = avgPoleVolume > 0 ? avgFlagVolume / avgPoleVolume : 1;

  // Current EMAs
  const ema10Now = ema10[today];
  const ema20Now = ema20[today];
  const ema50Now = ema50[today];

  if (ema20Now == null) return null;
  const distAbove20Ema = (todayBar.close - ema20Now) / ema20Now;
  if (distAbove20Ema > QUALIFICATION.maxDistAbove20Ema) return null;
  if (distAbove20Ema < -QUALIFICATION.maxDistBelow20Ema) return null;

  // 3-day direction
  let direction = 'flat';
  if (n >= 4) {
    const threeDaysAgo = closes[n - 4];
    const change = (todayBar.close - threeDaysAgo) / threeDaysAgo;
    if (change < -0.005) direction = 'descending';
    else if (change > 0.015) direction = 'ascending';
  }

  // 50-EMA slope (rising = positive) — current
  const ema50_10daysAgo = ema50[Math.max(0, today - 10)];
  const ema50Rising = ema50_10daysAgo != null && ema50Now > ema50_10daysAgo;

  // === CLASSIFICATION: continuation vs first-stage ===
  // Look at the 50-EMA slope in the 60 days BEFORE the pole started.
  // Continuation = pre-pole 50-EMA was already rising significantly
  // First-stage = pre-pole 50-EMA was flat, declining, or just turning up
  const prePoleStartIdx = Math.max(0, poleStartIdx - 60);
  const prePoleEma50Start = ema50[prePoleStartIdx];
  const prePoleEma50End = ema50[poleStartIdx];

  let setupType = 'continuation';
  let prePoleSlope = 0;
  if (prePoleEma50Start != null && prePoleEma50End != null && prePoleEma50Start > 0) {
    prePoleSlope = (prePoleEma50End - prePoleEma50Start) / prePoleEma50Start;
    if (prePoleSlope < CLASSIFICATION.continuationSlopeThreshold) {
      setupType = 'first-stage';
    }
  } else {
    // Not enough history before pole — default to first-stage (less context = more cautious)
    setupType = 'first-stage';
  }

  // === BASE QUALITY (mainly relevant for first-stage) ===
  // Measure the range and duration of the price action before the pole.
  // A clean base: tight range (< 20% high/low), at least 20 days, no big breakdowns.
  const baseLookbackStart = Math.max(0, poleStartIdx - CLASSIFICATION.baseLookbackDays);
  const baseEnd = poleStartIdx;
  let baseHigh = 0;
  let baseLow = Infinity;
  let baseDays = 0;
  for (let i = baseLookbackStart; i < baseEnd; i++) {
    if (highs[i] > baseHigh) baseHigh = highs[i];
    if (lows[i] < baseLow) baseLow = lows[i];
    baseDays++;
  }
  const baseRange = baseHigh > 0 ? (baseHigh - baseLow) / baseLow : 0;
  // Base tightness: smaller is better (means less chop, cleaner accumulation)
  // <20% range over 60+ days = excellent base
  // 20-35% = decent
  // >35% = sloppy / not really a base

  // 60-day return
  const sixtyDaysAgo = Math.max(0, today - 60);
  const return60d = (todayBar.close - closes[sixtyDaysAgo]) / closes[sixtyDaysAgo];

  return {
    pole: {
      startIdx: poleStartIdx,
      startDate: bars[poleStartIdx].date,
      startPrice: poleStartLow,
      endIdx: recentHighIdx,
      endDate: bars[recentHighIdx].date,
      endPrice: recentHigh,
      magnitude: poleMagnitude,
      days: poleDays,
      maxVolumeRatio: poleVolumeRatio,
      avgVolume: avgPoleVolume,
    },
    flag: {
      days: daysInFlag,
      pullbackPct,
      low: flagLow,
      avgVolume: avgFlagVolume,
      volumeContractionRatio,
    },
    current: {
      price: todayBar.close,
      open: todayBar.open,
      high: todayBar.high,
      low: todayBar.low,
      volume: todayBar.volume,
      date: todayBar.date,
      ema10: ema10Now,
      ema20: ema20Now,
      ema50: ema50Now,
      ema50Rising,
      return60d,
      distAbove20Ema,
      direction,
    },
    context: {
      setupType,             // 'continuation' or 'first-stage'
      prePoleSlope,          // 50-EMA % change in 60 days before pole start
      baseDays,
      baseRange,             // (high - low) / low over 60 days before pole
      baseHigh,
      baseLow,
    },
    stage: classifyStage(daysInFlag),
  };
}

function classifyStage(daysInFlag) {
  if (daysInFlag <= 4) return 'early';
  if (daysInFlag <= 6) return 'forming';
  if (daysInFlag <= 14) return 'prime';
  return 'late';
}
