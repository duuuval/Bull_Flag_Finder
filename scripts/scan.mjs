// BFF Daily Scan Runner

import fs from 'fs';
import path from 'path';
import { getUniverse } from './universe.mjs';
import { fetchVix, fetchSPY, processUniverse } from './yahoo.mjs';
import { detectFlag } from './detection.mjs';
import { scoreFlag, tradeLevel } from './scoring.mjs';
import { percentileRank, calculateEMA } from './ema.mjs';

const OUTPUT_DIR = path.join(process.cwd(), 'public');
const ARCHIVE_DIR = path.join(OUTPUT_DIR, 'scans');

async function main() {
  const startedAt = new Date();
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║         BFF · BULL FLAG FINDER             ║');
  console.log(`║         ${startedAt.toISOString()}      ║`);
  console.log('╚════════════════════════════════════════════╝');
  console.log('');

  console.log('🌍 Computing market state...');
  const [vix, spyData] = await Promise.all([fetchVix(), fetchSPY()]);

  const EMA_SLOPE_LOOKBACK_DAYS = 10;
  const VIX_ELEVATED_THRESHOLD = 22;

  let spyAbove50ma = false;
  let spyPrice = null;
  let spy50ma = null;
  let spy50maRising = null;
  let spy50maSlopePct = null;

  if (spyData?.bars && spyData.bars.length >= 50 + EMA_SLOPE_LOOKBACK_DAYS) {
    const spyCloses = spyData.bars.map(b => b.close);
    const ema = calculateEMA(spyCloses, 50);
    spy50ma = ema[ema.length - 1];
    const spy50maPast = ema[ema.length - 1 - EMA_SLOPE_LOOKBACK_DAYS];
    spyPrice = spyCloses[spyCloses.length - 1];
    spyAbove50ma = spyPrice > spy50ma;
    spy50maRising = spy50maPast != null ? spy50ma > spy50maPast : null;
    spy50maSlopePct = spy50maPast != null ? (spy50ma - spy50maPast) / spy50maPast : null;
  } else if (spyData?.bars && spyData.bars.length >= 50) {
    const spyCloses = spyData.bars.map(b => b.close);
    const ema = calculateEMA(spyCloses, 50);
    spy50ma = ema[ema.length - 1];
    spyPrice = spyCloses[spyCloses.length - 1];
    spyAbove50ma = spyPrice > spy50ma;
  }

  const vixElevated = vix != null && vix > VIX_ELEVATED_THRESHOLD;

  let state = 'mixed';
  if (spyAbove50ma === true && spy50maRising === true && !vixElevated) {
    state = 'strong';
  } else if (spyAbove50ma === false && spy50maRising === false) {
    state = 'weak';
  }

  console.log(`   VIX: ${vix?.toFixed(2) ?? 'unknown'}${vixElevated ? ' (ELEVATED)' : ''}`);
  console.log(`   SPY: ${spyPrice?.toFixed(2) ?? '?'} (50-MA: ${spy50ma?.toFixed(2) ?? '?'})`);
  console.log(`   ${spyAbove50ma ? 'ABOVE' : 'BELOW'} 50-EMA · 50-EMA ${spy50maRising === true ? 'rising' : spy50maRising === false ? 'falling' : 'unknown'} over last ${EMA_SLOPE_LOOKBACK_DAYS} days`);
  console.log(`   Market state: ${state.toUpperCase()}`);

  const marketRegime = {
    state,
    vix: vix ?? null,
    vixHostile: vixElevated,
    vixElevated,
    spyPrice: spyPrice ? round2(spyPrice) : null,
    spy50ma: spy50ma ? round2(spy50ma) : null,
    spyAbove50ma,
    spy50maRising,
    spy50maSlopePct: spy50maSlopePct != null ? round4(spy50maSlopePct) : null,
  };

  console.log('');
  console.log('📡 Fetching universe (S&P 1500)...');
  const universe = await getUniverse();

  console.log('');
  console.log(`🔍 Scanning ${universe.length} tickers...`);
  console.log('');

  const fiftyTwoWeekCandidates = [];

  const { results: flagRaw, stats } = await processUniverse(universe, async (ticker, data) => {
    const { bars, meta } = data;
    runFiftyTwoWeekCheck(ticker, bars, meta, fiftyTwoWeekCandidates);

    const pattern = detectFlag(bars);
    if (!pattern) return null;
    if (pattern.current.price < 5) return null;

    return {
      ticker,
      name: meta.name,
      exchange: cleanExchange(meta.exchange),
      pattern,
    };
  }, { delayMs: 200, progressEvery: 100 });

  console.log('');
  console.log('📈 Scan stats:');
  console.log(`   Universe: ${universe.length}`);
  console.log(`   Fetched: ${stats.fetched}`);
  console.log(`   Failed: ${stats.failed}`);
  console.log(`   Flag candidates: ${flagRaw.length}`);
  console.log(`   52W breakouts: ${fiftyTwoWeekCandidates.length}`);

  // RS rank computed across all candidates regardless of setup type
  const returns60d = flagRaw.map(c => c.pattern.current.return60d);

  console.log('');
  console.log(`🎯 Scoring ${flagRaw.length} candidates...`);

  const allCandidates = flagRaw.map(c => {
    const p = c.pattern;
    const rsPercentile = percentileRank(p.current.return60d, returns60d);
    const score = scoreFlag(p, { rsPercentile, spyAbove50ma });
    const levels = tradeLevel(p);

    const card = {
      ticker: c.ticker,
      name: c.name,
      exchange: c.exchange,
      price: round2(p.current.price),
      setupType: p.context.setupType,    // 'htf' | 'continuation' | 'first-stage'
      score: score.total,
      subscores: buildSubscores(score),
      breakdown: buildBreakdown(score),
      stage: p.stage,
      daysInFlag: p.flag.days,
      pattern: {
        polePct: round4(p.pole.magnitude),
        poleDays: p.pole.days,
        poleStartDate: p.pole.startDate,
        poleStartPrice: round2(p.pole.startPrice),
        recentHigh: round2(p.pole.endPrice),
        recentHighDate: p.pole.endDate,
        pullbackPct: round4(p.flag.pullbackPct),
        flagLow: round2(p.flag.low),
        flagHigh: round2(p.flag.high),
        volumeContraction: round2(p.flag.volumeContractionRatio),
        poleVolumeRatio: round2(p.pole.maxVolumeRatio),
        flagBackHalfRatio: p.flag.backHalfRatio != null ? round2(p.flag.backHalfRatio) : null,
        distAbove20Ema: round4(p.current.distAbove20Ema),
        direction: p.current.direction,
        priorRunUp3: p.pole.priorRunUp3,
        atr14: p.current.atr14 != null ? round2(p.current.atr14) : null,
      },
      ema: {
        ema10: p.current.ema10 != null ? round2(p.current.ema10) : null,
        ema20: p.current.ema20 != null ? round2(p.current.ema20) : null,
        ema50: p.current.ema50 != null ? round2(p.current.ema50) : null,
        ema50Rising: p.current.ema50Rising,
      },
      levels: levels && {
        entry: levels.entry,
        stop: levels.stop,
        target: levels.target,
        riskPct: levels.riskPct,
        rewardPct: levels.rewardPct,
        rr: levels.rr,
      },
      rsPercentile: round4(rsPercentile),
      return60dPct: round4(p.current.return60d),
      chartUrl: `https://www.tradingview.com/symbols/${c.exchange}-${c.ticker}/`,
    };

    // Attach base context to every candidate. CandidateCard reads c.base for
    // expanded-detail rendering on all setup types; the first-stage-only
    // visual treatment (badges, base subscore block) keys off c.setupType.
    card.base = {
      baseDays: p.context.baseDays,
      baseRange: round4(p.context.baseRange),
      prePoleSlope: round4(p.context.prePoleSlope),
    };

    return card;
  });

  const htfCandidates = allCandidates
    .filter(c => c.setupType === 'htf')
    .sort((a, b) => b.score - a.score);
  const continuationCandidates = allCandidates
    .filter(c => c.setupType === 'continuation')
    .sort((a, b) => b.score - a.score);
  const firstStageCandidates = allCandidates
    .filter(c => c.setupType === 'first-stage')
    .sort((a, b) => b.score - a.score);

  // Compute rank-change vs. previous scan. Read previous latest.json before we
  // overwrite it. If anything goes wrong (missing file, parse error, schema
  // mismatch), treat every candidate as NEW — the badge degrades gracefully and
  // we don't want a missing prior to break the scan.
  attachRankChanges(htfCandidates, continuationCandidates, firstStageCandidates);

  if (htfCandidates.length > 0) {
    console.log('');
    console.log('   ⭐ HTF candidates:');
    htfCandidates.slice(0, 5).forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.ticker.padEnd(6)} ${c.score.toString().padStart(3)} ${c.stage.padEnd(8)} ${c.pattern.direction.padEnd(10)} pole ${(c.pattern.polePct * 100).toFixed(1)}% pb ${(c.pattern.pullbackPct * 100).toFixed(1)}%`);
    });
  }
  if (continuationCandidates.length > 0) {
    console.log('');
    console.log('   Top 5 continuation:');
    continuationCandidates.slice(0, 5).forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.ticker.padEnd(6)} ${c.score.toString().padStart(3)} ${c.stage.padEnd(8)} ${c.pattern.direction.padEnd(10)} pole ${(c.pattern.polePct * 100).toFixed(1)}%`);
    });
  }
  if (firstStageCandidates.length > 0) {
    console.log('');
    console.log('   Top 5 first-stage:');
    firstStageCandidates.slice(0, 5).forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.ticker.padEnd(6)} ${c.score.toString().padStart(3)} ${c.stage.padEnd(8)} ${c.pattern.direction.padEnd(10)} pole ${(c.pattern.polePct * 100).toFixed(1)}%`);
    });
  }

  await writeOutputs(htfCandidates, continuationCandidates, firstStageCandidates, fiftyTwoWeekCandidates, marketRegime, {
    universeSize: universe.length,
    fetched: stats.fetched,
    failed: stats.failed,
    qualified: allCandidates.length,
    htfCount: htfCandidates.length,
    continuationCount: continuationCandidates.length,
    firstStageCount: firstStageCandidates.length,
  }, startedAt);
}

// Mutates each candidate to attach `rankChange`:
//   null     → ticker was not present in the same section's previous list (NEW)
//   integer  → previousRank - currentRank (positive = moved up, negative = moved down, 0 = unchanged)
// Section switch counts as NEW: if a ticker was in continuation yesterday and
// htf today, it'll be NEW within htf. Different rubric, effectively a different
// setup classification.
function attachRankChanges(htf, continuation, firstStage) {
  const prev = readPreviousScan();

  const prevHtf = buildRankMap(prev?.htfCandidates);
  const prevContinuation = buildRankMap(prev?.continuationCandidates);
  const prevFirstStage = buildRankMap(prev?.firstStageCandidates);

  applyRankChange(htf, prevHtf);
  applyRankChange(continuation, prevContinuation);
  applyRankChange(firstStage, prevFirstStage);
}

function readPreviousScan() {
  const latestPath = path.join(OUTPUT_DIR, 'latest.json');
  try {
    if (!fs.existsSync(latestPath)) {
      console.log('   No previous scan found — all candidates flagged NEW');
      return null;
    }
    const raw = fs.readFileSync(latestPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (err) {
    console.warn(`   Could not read previous scan (${err.message}) — all candidates will be flagged NEW`);
    return null;
  }
}

function buildRankMap(candidates) {
  const map = new Map();
  if (!Array.isArray(candidates)) return map;
  candidates.forEach((c, idx) => {
    if (c && typeof c.ticker === 'string') {
      map.set(c.ticker, idx + 1); // 1-indexed to match display rank
    }
  });
  return map;
}

function applyRankChange(currentList, prevMap) {
  currentList.forEach((c, idx) => {
    const currentRank = idx + 1;
    const prevRank = prevMap.get(c.ticker);
    if (prevRank == null) {
      c.rankChange = null; // NEW
    } else {
      c.rankChange = prevRank - currentRank; // positive = moved up, negative = down
    }
  });
}

function buildSubscores(score) {
  if (score.setupType === 'htf') {
    return {
      pole: score.pole.total,
      flag: score.flag.total,
      context: score.context.total,
    };
  }
  if (score.setupType === 'first-stage') {
    return {
      pole: score.pole.total,
      flag: score.flag.total,
      base: score.base.total,
      context: score.context.total,
    };
  }
  return {
    pole: score.pole.total,
    flag: score.flag.total,
    context: score.context.total,
  };
}

function buildBreakdown(score) {
  if (score.setupType === 'htf') {
    return {
      poleMagnitude: score.pole.magnitude,
      poleVelocity: score.pole.velocity,
      poleVolume: score.pole.volume,
      flagTightness: score.flag.tightness,
      flagContraction: score.flag.contraction,
      flagEntry: score.flag.entry,
      ctxRs: score.context.rs,
      ctxTrend: score.context.trend,
      ctxMarket: score.context.market,
    };
  }
  if (score.setupType === 'first-stage') {
    return {
      poleMagnitude: score.pole.magnitude,
      poleVelocity: score.pole.velocity,
      poleVolume: score.pole.volume,
      flagContraction: score.flag.contraction,
      flagEntry: score.flag.entry,
      flagPullback: score.flag.pullbackQuality,
      baseLength: score.base.length,
      baseTightness: score.base.tightness,
      basePoleRatio: score.base.poleBaseRatio,
      ctxMarket: score.context.market,
    };
  }
  return {
    poleMagnitude: score.pole.magnitude,
    poleVelocity: score.pole.velocity,
    poleVolume: score.pole.volume,
    flagPullback: score.flag.pullbackQuality,
    flagContraction: score.flag.contraction,
    flagEntry: score.flag.entry,
    ctxRs: score.context.rs,
    ctxTrend: score.context.trend,
    ctxMarket: score.context.market,
  };
}

function runFiftyTwoWeekCheck(ticker, bars, meta, collector) {
  if (!bars || bars.length < 252) return;

  const closes = bars.map(b => b.close);
  const highs = bars.map(b => b.high);
  const volumes = bars.map(b => b.volume);
  const today = bars.length - 1;
  const todayBar = bars[today];

  if (todayBar.close < 5) return;

  let highestPrior = -Infinity;
  for (let i = today - 251; i < today; i++) {
    if (highs[i] > highestPrior) highestPrior = highs[i];
  }

  if (todayBar.close <= highestPrior) return;

  const volStart = Math.max(0, today - 49);
  let volSum = 0;
  let volCount = 0;
  for (let i = volStart; i < today; i++) {
    volSum += volumes[i];
    volCount++;
  }
  const avgVolume = volCount > 0 ? volSum / volCount : 0;
  const volRatio = avgVolume > 0 ? todayBar.volume / avgVolume : 0;

  if (volRatio < 1.5) return;

  collector.push({
    ticker,
    name: meta.name,
    exchange: cleanExchange(meta.exchange),
    price: round2(todayBar.close),
    priorHigh: round2(highestPrior),
    breakoutPct: round4((todayBar.close - highestPrior) / highestPrior),
    volume: todayBar.volume,
    avgVolume: Math.round(avgVolume),
    volRatio: round2(volRatio),
    chartUrl: `https://www.tradingview.com/symbols/${cleanExchange(meta.exchange)}-${ticker}/`,
  });
}

function cleanExchange(exchange) {
  if (!exchange) return 'NASDAQ';
  const upper = exchange.toUpperCase();
  if (upper.includes('NASDAQ') || upper === 'NMS' || upper === 'NGM') return 'NASDAQ';
  if (upper.includes('NYSE') || upper === 'NYQ' || upper === 'PCX') return 'NYSE';
  if (upper === 'ASE' || upper.includes('AMEX')) return 'AMEX';
  return upper;
}

async function writeOutputs(htf, continuation, firstStage, fiftyTwoWeek, marketRegime, stats, startedAt) {
  const completedAt = new Date();
  const durationMs = completedAt - startedAt;
  const dateStr = completedAt.toISOString().split('T')[0];

  fiftyTwoWeek.sort((a, b) => b.volRatio - a.volRatio);

  const payload = {
    schemaVersion: 3,                  // bumped — added htfCandidates
    scanDate: dateStr,
    timestamp: completedAt.toISOString(),
    durationSec: Math.round(durationMs / 1000),
    market: marketRegime,
    stats,
    htfCandidates: htf,
    continuationCandidates: continuation,
    firstStageCandidates: firstStage,
    // legacy alias for compatibility — combined sorted by score
    flagCandidates: [...htf, ...continuation, ...firstStage].sort((a, b) => b.score - a.score),
    fiftyTwoWeekCandidates: fiftyTwoWeek,
  };

  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const latestPath = path.join(OUTPUT_DIR, 'latest.json');
  const archivePath = path.join(ARCHIVE_DIR, `${dateStr}.json`);

  fs.writeFileSync(latestPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(archivePath, JSON.stringify(payload, null, 2));

  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log(`║  ✅ SCAN COMPLETE in ${Math.round(durationMs / 1000).toString().padStart(4)}s              ║`);
  console.log('╚════════════════════════════════════════════╝');
  console.log(`   Wrote: public/latest.json`);
  console.log(`   Wrote: public/scans/${dateStr}.json`);
  console.log('');
}

function round2(n) {
  if (n == null) return null;
  return Math.round(n * 100) / 100;
}

function round4(n) {
  if (n == null) return null;
  return Math.round(n * 10000) / 10000;
}

main().catch(err => {
  console.error('');
  console.error('❌ Scan failed:', err);
  console.error(err.stack);
  process.exit(1);
});
