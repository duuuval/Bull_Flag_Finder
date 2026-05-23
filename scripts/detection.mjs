// Bull flag pattern detection
//
// Algorithm:
// 1. Find the highest high in the last 30 trading days (the "recent_high")
// 2. Walk backward from recent_high to find pole start within a tight window
//    (max 30 days back), bounded by where the 50-EMA was violated
// 3. Compute pole metrics; require pole to be both >= 20% AND <= 80%
//    (anything bigger is a trend, not a pole)
// 4. Compute flag metrics
// 5. Apply qualification gates; return null if any fail

import { calculateEMA, sma } from './ema.mjs';

const QUALIFICATION = {
  minPoleMagnitude: 0.20,      // 20% pole minimum
  maxPoleMagnitude: 0.80,      // 80% pole maximum (anything bigger is a trend)
  maxPullback: 0.20,           // 20% max pullback
  minDaysInFlag: 3,            // 3 days since recent high
  maxDaysInFlag: 20,           // 20 days max
  recentHighLookback: 30,      // recent high must be within 30 days
  minBars: 90,                 // need at least 90 days of history
  poleSearchDepth: 30,         // walk back up to 30 days looking for pole start (was 60)
  maxPoleDays: 30,             // pole itself must complete in 30 days or less
  minPoleVolumeSpike: 1.5,     // at least one pole day with 1.5x avg volume
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

  // Compute EMAs
  const ema10 = calculateEMA(closes, 10);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);

  if (ema50[today] == null) return null;

  // Gate: price must be above 50-EMA (trend intact)
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

  // Days since recent high (the "flag duration")
  const daysInFlag = today - recentHighIdx;

  // Gate: flag duration window
  if (daysInFlag < QUALIFICATION.minDaysInFlag) return null;
  if (daysInFlag > QUALIFICATION.maxDaysInFlag) return null;

  // Gate: pullback depth
  const pullbackPct = (recentHigh - todayBar.close) / recentHigh;
  if (pullbackPct > QUALIFICATION.maxPullback) return null;
  if (pullbackPct < 0) return null;

  // Walk backward from recent_high to find pole start
  // CRITICAL: search depth is tight (30 days max) — a real pole is a recent sharp move,
  // not a year-long uptrend. Stop walking if:
  //   - We hit a day where price closed below 50-EMA (prior trend broken), OR
  //   - We've walked back maxPoleDays, OR
  //   - We hit price within 5% of the recent high going back (means we're already past the pole start)
  const searchStart = Math.max(0, recentHighIdx - QUALIFICATION.poleSearchDepth);
  let poleStartIdx = recentHighIdx;
  let poleStartLow = lows[recentHighIdx];

  for (let i = recentHighIdx - 1; i >= searchStart; i--) {
    // Stop if we hit a day where price closed below 50-EMA (prior trend broken)
    if (ema50[i] != null && closes[i] < ema50[i]) {
      break;
    }
    // Stop if we've gone back more than maxPoleDays
    if (recentHighIdx - i > QUALIFICATION.maxPoleDays) {
      break;
    }
    if (lows[i] < poleStartLow) {
      poleStartLow = lows[i];
      poleStartIdx = i;
    }
  }

  const poleDays = recentHighIdx - poleStartIdx;
  const poleMagnitude = (recentHigh - poleStartLow) / poleStartLow;

  // Gate: pole magnitude must be in valid range
  // Below 20% = not a real pole
  // Above 80% = stock had a parabolic move, not a clean flag setup
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

  // 50-day average volume (computed at pole start to avoid contamination)
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

  // Gate: at least one pole day with 1.5x avg volume
  if (poleVolumeRatio < QUALIFICATION.minPoleVolumeSpike) return null;

  // Flag volume analysis
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

  // Compute current EMA values
  const ema10Now = ema10[today];
  const ema20Now = ema20[today];
  const ema50Now = ema50[today];

  // 50-EMA slope
  const ema50_10daysAgo = ema50[Math.max(0, today - 10)];
  const ema50Rising = ema50_10daysAgo != null && ema50Now > ema50_10daysAgo;

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
