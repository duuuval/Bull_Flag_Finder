// BFF Scoring — two rubrics
//
// CONTINUATION (strength trade):
//   Pole quality (35): magnitude 15, velocity 10, volume 10
//   Flag quality (35): pullback-to-EMA quality 20, contraction 10, entry 5
//   Context (30):      RS rank 15, trend stack 10, market 5
//
// FIRST-STAGE (base breakout):
//   Pole quality (30): magnitude 15, velocity 10, volume 5
//   Flag quality (30): contraction 15, entry 10, pullback-quality 5
//   Base quality (35): base length 15, base tightness 15, pole/base ratio 5
//   Market (5)
//
// Both score on a 0-100 scale.

export function scoreFlag(pattern, context) {
  if (pattern.context.setupType === 'first-stage') {
    return scoreFirstStage(pattern, context);
  }
  return scoreContinuation(pattern, context);
}

// ─── CONTINUATION RUBRIC ────────────────────────────────────────────────

function scoreContinuation(pattern, context) {
  const pole = scorePoleContinuation(pattern.pole);
  const flag = scoreFlagContinuation(pattern.flag, pattern.current);
  const ctx = scoreContextContinuation(pattern.current, context);
  const total = pole.total + flag.total + ctx.total;
  return {
    total: Math.round(total),
    setupType: 'continuation',
    pole,
    flag,
    context: ctx,
  };
}

function scorePoleContinuation(pole) {
  const magPct = pole.magnitude;
  let magnitude;
  if (magPct >= 0.50) magnitude = 15;
  else if (magPct >= 0.20) magnitude = 6 + ((magPct - 0.20) / 0.30) * 9;
  else magnitude = 0;
  magnitude = Math.round(magnitude * 10) / 10;

  let velocity;
  if (pole.days <= 10) velocity = 10;
  else if (pole.days <= 20) velocity = 7;
  else if (pole.days <= 30) velocity = 4;
  else velocity = 1;

  let volume;
  const ratio = pole.maxVolumeRatio;
  if (ratio >= 2.5) volume = 10;
  else if (ratio >= 2.0) volume = 7;
  else if (ratio >= 1.5) volume = 4;
  else volume = 0;

  return { magnitude, velocity, volume, total: magnitude + velocity + volume };
}

function scoreFlagContinuation(flag, current) {
  // For continuation, the "pullback quality" isn't about being shallow —
  // it's about landing cleanly at structural support (the 20-EMA).
  // A 7% pullback that brings price to the 20-EMA is BETTER than a 2% pullback
  // that leaves price 8% above the EMA.
  // Score combines pullback depth with distance to 20-EMA.
  const pb = flag.pullbackPct;
  const dist = Math.abs(current.distAbove20Ema); // distance from EMA in either direction

  // We've already gated to within ±5% of 20-EMA, so dist is in [0, 0.05].
  // Best case: pulled back 4-12% AND landed within 2% of the 20-EMA.
  // That's a "real" pullback to structural support.
  let pullbackQuality;
  if (dist <= 0.02) {
    // At the EMA — score by pullback depth (deeper = more meaningful test of support)
    if (pb >= 0.04 && pb <= 0.15) pullbackQuality = 20;
    else if (pb >= 0.02 && pb < 0.04) pullbackQuality = 15;
    else if (pb < 0.02) pullbackQuality = 10; // too shallow, hasn't really pulled back
    else pullbackQuality = 14; // > 15% pullback, getting deep
  } else if (dist <= 0.05) {
    // 2-5% from EMA — approaching but not there yet
    if (pb >= 0.04 && pb <= 0.15) pullbackQuality = 14;
    else if (pb >= 0.02 && pb < 0.04) pullbackQuality = 10;
    else pullbackQuality = 6;
  } else {
    pullbackQuality = 4;
  }

  const vcr = flag.volumeContractionRatio;
  let contraction;
  if (vcr <= 0.5) contraction = 10;
  else if (vcr <= 0.7) contraction = 7;
  else if (vcr <= 1.0) contraction = 4;
  else contraction = 0;

  // Entry: descending into 20-EMA is best
  let entry = 0;
  const d = current.distAbove20Ema;
  const dir = current.direction;
  if (d >= 0 && d <= 0.02) {
    if (dir === 'descending' || dir === 'flat') entry = 5;
    else entry = 3;
  } else if (d > 0.02 && d <= 0.05) {
    if (dir === 'descending') entry = 4;
    else if (dir === 'flat') entry = 3;
    else entry = 1;
  } else if (d < 0) {
    entry = 1;
  }

  return {
    pullbackQuality,
    contraction,
    entry,
    total: pullbackQuality + contraction + entry,
  };
}

function scoreContextContinuation(current, context) {
  const rsRank = context.rsPercentile;
  let rs;
  if (rsRank >= 0.90) rs = 15;
  else if (rsRank >= 0.75) rs = 10;
  else if (rsRank >= 0.50) rs = 5;
  else rs = 0;

  let trend;
  const stack = current.ema20 != null && current.ema50 != null && current.ema20 > current.ema50;
  if (stack && current.ema50Rising) trend = 10;
  else if (stack || current.ema50Rising) trend = 5;
  else trend = 0;

  const market = context.spyAbove50ma ? 5 : 0;
  return { rs, trend, market, total: rs + trend + market, rsPercentile: rsRank };
}

// ─── FIRST-STAGE RUBRIC ─────────────────────────────────────────────────

function scoreFirstStage(pattern, context) {
  const pole = scorePoleFirstStage(pattern.pole);
  const flag = scoreFlagFirstStage(pattern.flag, pattern.current);
  const base = scoreBase(pattern.context, pattern.pole);
  const ctx = scoreMarketOnly(context);
  const total = pole.total + flag.total + base.total + ctx.total;
  return {
    total: Math.round(total),
    setupType: 'first-stage',
    pole,
    flag,
    base,
    context: ctx,
  };
}

function scorePoleFirstStage(pole) {
  // Same as continuation but lower volume weight (first-stage pole volume
  // can vary more — sometimes it's the institutional accumulation, sometimes retail)
  const magPct = pole.magnitude;
  let magnitude;
  if (magPct >= 0.50) magnitude = 15;
  else if (magPct >= 0.20) magnitude = 6 + ((magPct - 0.20) / 0.30) * 9;
  else magnitude = 0;
  magnitude = Math.round(magnitude * 10) / 10;

  let velocity;
  if (pole.days <= 10) velocity = 10;
  else if (pole.days <= 20) velocity = 7;
  else if (pole.days <= 30) velocity = 4;
  else velocity = 1;

  let volume;
  const ratio = pole.maxVolumeRatio;
  if (ratio >= 2.5) volume = 5;
  else if (ratio >= 2.0) volume = 4;
  else if (ratio >= 1.5) volume = 2;
  else volume = 0;

  return { magnitude, velocity, volume, total: magnitude + velocity + volume };
}

function scoreFlagFirstStage(flag, current) {
  // For first-stage, volume contraction is even more important — it's the
  // signal that sellers have actually exhausted after a fresh breakout.
  const vcr = flag.volumeContractionRatio;
  let contraction;
  if (vcr <= 0.5) contraction = 15;
  else if (vcr <= 0.7) contraction = 10;
  else if (vcr <= 1.0) contraction = 5;
  else contraction = 0;

  // Entry: at/near the 20-EMA, descending or flat
  let entry = 0;
  const d = current.distAbove20Ema;
  const dir = current.direction;
  if (d >= 0 && d <= 0.02) {
    if (dir === 'descending' || dir === 'flat') entry = 10;
    else entry = 6;
  } else if (d > 0.02 && d <= 0.05) {
    if (dir === 'descending') entry = 8;
    else if (dir === 'flat') entry = 5;
    else entry = 2;
  } else if (d < 0) {
    entry = 2;
  }

  // Pullback-quality lite (5 pts max for first-stage — deeper pullbacks more acceptable here)
  const pb = flag.pullbackPct;
  let pullbackQuality;
  if (pb >= 0.04 && pb <= 0.15) pullbackQuality = 5;
  else if (pb >= 0.02 && pb < 0.04) pullbackQuality = 3;
  else pullbackQuality = 1;

  return {
    contraction,
    entry,
    pullbackQuality,
    total: contraction + entry + pullbackQuality,
  };
}

function scoreBase(ctx, pole) {
  // Base length: longer is better (more accumulation time)
  let length;
  if (ctx.baseDays >= 60) length = 15;
  else if (ctx.baseDays >= 40) length = 11;
  else if (ctx.baseDays >= 25) length = 7;
  else length = 3;

  // Base tightness: smaller range = cleaner base
  let tightness;
  if (ctx.baseRange <= 0.15) tightness = 15;        // very tight base
  else if (ctx.baseRange <= 0.25) tightness = 11;
  else if (ctx.baseRange <= 0.40) tightness = 6;
  else tightness = 2;                                // sloppy, choppy

  // Pole-to-base ratio: big pole emerging from small base = explosive
  let poleBaseRatio = 0;
  if (ctx.baseRange > 0) {
    const ratio = pole.magnitude / ctx.baseRange;
    if (ratio >= 2.0) poleBaseRatio = 5;
    else if (ratio >= 1.5) poleBaseRatio = 4;
    else if (ratio >= 1.0) poleBaseRatio = 2;
    else poleBaseRatio = 1;
  }

  return {
    length,
    tightness,
    poleBaseRatio,
    total: length + tightness + poleBaseRatio,
  };
}

function scoreMarketOnly(context) {
  const market = context.spyAbove50ma ? 5 : 0;
  return { market, total: market };
}

// ─── TRADE LEVELS ───────────────────────────────────────────────────────

export function tradeLevel(pattern) {
  const cur = pattern.current;
  const flag = pattern.flag;
  const isFirstStage = pattern.context.setupType === 'first-stage';

  // Entry: at the 20-EMA
  const entry = cur.ema20 ?? cur.price;

  // Stop: structural floor
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

  // Target depends on setup type:
  //   Continuation: conservative half-pole projection
  //   First-stage:  full-pole projection (asymmetric upside is the point)
  const targetMultiplier = isFirstStage ? 1.0 : 0.5;
  const target = entry * (1 + pattern.pole.magnitude * targetMultiplier);

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

function round2(n) { return Math.round(n * 100) / 100; }
function round4(n) { return Math.round(n * 10000) / 10000; }
