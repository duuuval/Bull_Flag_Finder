// BFF Scoring Rubric — 100 points total
//
// Pole quality (35 pts):
//   - Magnitude (15): 20% → 6 pts, scales linearly to 50%+ → 15 pts
//   - Velocity (10): faster pole = more momentum
//   - Volume signature (10): bigger volume on pole days = institutional buying
//
// Flag quality (35 pts):
//   - Tightness (20): shallower pullback = stronger setup
//   - Volume contraction (10): lower flag volume = seller exhaustion
//   - Entry quality (5): proximity to 20-EMA + direction (descending = best)
//
// Context quality (30 pts):
//   - Relative strength (15): top performers tend to continue
//   - Trend stack (10): 20-EMA > 50-EMA AND 50-EMA rising
//   - Market regime (5): SPY > 50-day MA

export function scoreFlag(pattern, context) {
  const poleScore = scorePole(pattern.pole);
  const flagScore = scoreFlagQuality(pattern.flag, pattern.current);
  const contextScore = scoreContext(pattern.current, context);

  const total = poleScore.total + flagScore.total + contextScore.total;

  return {
    total: Math.round(total),
    pole: poleScore,
    flag: flagScore,
    context: contextScore,
  };
}

function scorePole(pole) {
  // Magnitude: 6 pts at 20%, 15 pts at 50%+, linear between
  const magPct = pole.magnitude;
  let magnitude;
  if (magPct >= 0.50) magnitude = 15;
  else if (magPct >= 0.20) magnitude = 6 + ((magPct - 0.20) / 0.30) * 9;
  else magnitude = 0;
  magnitude = Math.round(magnitude * 10) / 10;

  // Velocity: ≤10 days great, >30 days weak
  let velocity;
  if (pole.days <= 10) velocity = 10;
  else if (pole.days <= 20) velocity = 7;
  else if (pole.days <= 30) velocity = 4;
  else velocity = 1;

  // Volume signature: max single-day pole volume / 50d avg
  let volume;
  const ratio = pole.maxVolumeRatio;
  if (ratio >= 2.5) volume = 10;
  else if (ratio >= 2.0) volume = 7;
  else if (ratio >= 1.5) volume = 4;
  else volume = 0;

  return {
    magnitude,
    velocity,
    volume,
    total: magnitude + velocity + volume,
  };
}

function scoreFlagQuality(flag, current) {
  // Tightness: tighter pullback = better
  const pb = flag.pullbackPct;
  let tightness;
  if (pb <= 0.05) tightness = 20;
  else if (pb <= 0.08) tightness = 16;
  else if (pb <= 0.12) tightness = 12;
  else if (pb <= 0.15) tightness = 8;
  else tightness = 4;

  // Volume contraction: flag volume / pole volume
  const vcr = flag.volumeContractionRatio;
  let contraction;
  if (vcr <= 0.5) contraction = 10;
  else if (vcr <= 0.7) contraction = 7;
  else if (vcr <= 1.0) contraction = 4;
  else contraction = 0;

  // Entry quality: proximity to 20-EMA × direction
  // Gates already ensure price is within ±5% of 20-EMA, so we score within that window.
  // Best: 0-2% above + descending or flat (limit order zone, price coming to you)
  // Good: 2-5% above + descending or flat (approaching, still actionable)
  // OK:   0-2% above + ascending (bounce just started)
  // Weak: 2-5% above + ascending (already bouncing, getting away)
  // Bad:  below 20-EMA (broke support, riskier setup)
  let entry = 0;
  const dist = current.distAbove20Ema;
  const dir = current.direction;

  if (dist >= 0 && dist <= 0.02) {
    if (dir === 'descending' || dir === 'flat') entry = 5;
    else entry = 3;
  } else if (dist > 0.02 && dist <= 0.05) {
    if (dir === 'descending') entry = 4;
    else if (dir === 'flat') entry = 3;
    else entry = 1;
  } else if (dist < 0) {
    entry = 1;
  }

  return {
    tightness,
    contraction,
    entry,
    total: tightness + contraction + entry,
  };
}

function scoreContext(current, context) {
  // Relative strength: percentile of 60-day return across universe
  const rsRank = context.rsPercentile;
  let rs;
  if (rsRank >= 0.90) rs = 15;
  else if (rsRank >= 0.75) rs = 10;
  else if (rsRank >= 0.50) rs = 5;
  else rs = 0;

  // Trend stack
  let trend;
  const stack = current.ema20 != null && current.ema50 != null && current.ema20 > current.ema50;
  if (stack && current.ema50Rising) trend = 10;
  else if (stack || current.ema50Rising) trend = 5;
  else trend = 0;

  // Market regime
  const market = context.spyAbove50ma ? 5 : 0;

  return {
    rs,
    trend,
    market,
    total: rs + trend + market,
    rsPercentile: rsRank,
  };
}

// Suggested trade levels
export function tradeLevel(pattern) {
  const cur = pattern.current;
  const flag = pattern.flag;

  // Entry: at the 20-EMA (limit order zone)
  const entry = cur.ema20 ?? cur.price;

  // Stop: max of (50-EMA, flag low * 0.99) — structural floor
  const ema50 = cur.ema50;
  const flagLow = flag.low;
  let stop;
  if (ema50 != null && ema50 > flagLow * 0.99) {
    stop = ema50;
  } else {
    stop = flagLow * 0.99;
  }
  if (stop > entry * 0.98) {
    stop = entry * 0.93;
  }

  // Target: project conservative half-pole gain from entry
  const target = entry * (1 + pattern.pole.magnitude * 0.5);

  const riskPct = (entry - stop) / entry;
  const rewardPct = (target - entry) / entry;
  const rr = riskPct > 0 ? rewardPct / riskPct : null;

  return {
    entry: round2(entry),
    stop: round2(stop),
    target: round2(target),
    riskPct: round4(riskPct),
    rewardPct: round4(rewardPct),
    rr: rr ? Math.round(rr * 10) / 10 : null,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}
