// Crypto bull flag scoring — single 100pt rubric
//
// Pole quality (40):
//   - magnitude       15  (depth of move within valid range)
//   - velocity        10  (faster = stronger)
//   - peak bar vol     15  (breakout-candle volume — the tell)
//
// Flag quality (40):
//   - pullback quality 15 (closer to 20-EMA on a meaningful retrace)
//   - vol contraction  15 (sellers exhausted)
//   - entry quality    10 (direction + position at 20-EMA)
//
// Trend & structure (20):
//   - EMA stack        10 (20 > 50 + 50 rising)
//   - regime           10 (BTC trend + alt liquidity)
//
// NOTE: NO trade levels are computed for crypto. The scanner surfaces patterns
// and shows structural levels (EMAs, flag boundaries) — sizing and entry pricing
// are the trader's job. This is intentional. See BFF.md.

export function scoreCryptoFlag(pattern, context) {
  const pole = scorePole(pattern.pole);
  const flag = scoreFlag(pattern.flag, pattern.current);
  const structure = scoreStructure(pattern.current, context);
  const total = pole.total + flag.total + structure.total;
  return {
    total: Math.round(total),
    pole,
    flag,
    structure,
  };
}

function scorePole(pole) {
  // Magnitude: 0.12-0.60 valid range. Best in 0.25-0.45.
  const mag = pole.magnitude;
  let magnitude;
  if (mag >= 0.25 && mag <= 0.45) magnitude = 15;
  else if (mag >= 0.18 && mag < 0.25) magnitude = 11;
  else if (mag > 0.45 && mag <= 0.55) magnitude = 11;
  else if (mag >= 0.12 && mag < 0.18) magnitude = 7;
  else if (mag > 0.55 && mag <= 0.60) magnitude = 7;
  else magnitude = 0;

  // Velocity: shorter pole = stronger move. 6-30 bar range.
  // <=10 bars (~1.5 days): explosive
  // 11-18 bars (~2-3 days): strong
  // 19-30 bars (~3-5 days): okay
  let velocity;
  if (pole.bars <= 10) velocity = 10;
  else if (pole.bars <= 18) velocity = 7;
  else if (pole.bars <= 30) velocity = 4;
  else velocity = 1;

  // Peak single-bar volume ratio: the breakout candle is the tell. The detector
  // gates on PEAK (maxBarVolumeRatio >= 2.0, see crypto-detection.mjs), so we
  // score the same metric — otherwise the rubric penalizes exactly the vertical
  // breakouts the detector was rebuilt to catch. Cumulative pole volume is NOT
  // scored: averaging across the pole dilutes the breakout candle, which is why
  // the rebuild abandoned it. (cumulativeVolumeRatio is still shown on the card
  // for context.)
  let volume;
  const peak = pole.maxBarVolumeRatio;
  if (peak >= 8.0) volume = 15;
  else if (peak >= 5.0) volume = 13;
  else if (peak >= 4.0) volume = 11;
  else if (peak >= 3.0) volume = 9;
  else if (peak >= 2.5) volume = 7;
  else if (peak >= 2.0) volume = 5;
  else volume = 0;

  return {
    magnitude,
    velocity,
    volume,
    total: magnitude + velocity + volume,
  };
}

function scoreFlag(flag, current) {
  // Pullback quality: combine pullback fraction-of-pole with distance to 20-EMA.
  // We want a meaningful retrace (15-30% of pole) that lands AT the 20-EMA.
  const pbFrac = flag.pullbackFracOfPole;
  const distAbs = Math.abs(current.distAbove20Ema);

  let pullbackQuality;
  if (distAbs <= 0.015) {
    // Right at the 20-EMA
    if (pbFrac >= 0.15 && pbFrac <= 0.38) pullbackQuality = 15;
    else if (pbFrac >= 0.08 && pbFrac < 0.15) pullbackQuality = 12;
    else if (pbFrac < 0.08) pullbackQuality = 8;        // too shallow
    else pullbackQuality = 11;                           // approaching the 38.2 ceiling
  } else if (distAbs <= 0.03) {
    // Within 3% of 20-EMA
    if (pbFrac >= 0.15 && pbFrac <= 0.38) pullbackQuality = 12;
    else if (pbFrac >= 0.08) pullbackQuality = 9;
    else pullbackQuality = 5;
  } else {
    // 3-5% from 20-EMA
    if (pbFrac >= 0.15) pullbackQuality = 7;
    else pullbackQuality = 3;
  }

  // Volume contraction: lower ratio = sellers more exhausted = healthier flag.
  // We've gated to <= 0.8x.
  const vcr = flag.volumeContractionRatio;
  let contraction;
  if (vcr <= 0.4) contraction = 15;
  else if (vcr <= 0.55) contraction = 12;
  else if (vcr <= 0.7) contraction = 8;
  else if (vcr <= 0.8) contraction = 4;
  else contraction = 0;

  // Entry: descending into 20-EMA = best (limit order setup waiting for fill)
  let entry = 0;
  const d = current.distAbove20Ema;
  const dir = current.direction;
  if (d >= 0 && d <= 0.015) {
    if (dir === 'descending' || dir === 'flat') entry = 10;
    else entry = 6;                              // already bouncing
  } else if (d > 0.015 && d <= 0.03) {
    if (dir === 'descending') entry = 8;
    else if (dir === 'flat') entry = 5;
    else entry = 2;
  } else if (d > 0.03 && d <= 0.05) {
    if (dir === 'descending') entry = 5;
    else entry = 2;
  } else if (d < 0) {
    entry = 3;                                    // below EMA — already through support
  }

  return {
    pullbackQuality,
    contraction,
    entry,
    total: pullbackQuality + contraction + entry,
  };
}

function scoreStructure(current, context) {
  // EMA stack: 20 > 50 + 50 rising
  let stack;
  const isStacked = current.ema20 != null && current.ema50 != null && current.ema20 > current.ema50;
  if (isStacked && current.ema50Rising) stack = 10;
  else if (isStacked || current.ema50Rising) stack = 5;
  else stack = 0;

  // Regime: BTC + TOTAL3 status. Both passing = 10, one = 5, neither = 0.
  let regime;
  const btcOk = context.btcAbove50ema === true;
  const total3Ok = context.total3Above20ema === true;
  if (btcOk && total3Ok) regime = 10;
  else if (btcOk || total3Ok) regime = 5;
  else regime = 0;

  return {
    stack,
    regime,
    total: stack + regime,
  };
}
