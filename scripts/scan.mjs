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

  console.log('🌍 Fetching market regime...');
  const [vix, spyData] = await Promise.all([fetchVix(), fetchSPY()]);

  let spyAbove50ma = false;
  let spyPrice = null;
  let spy50ma = null;
  if (spyData?.bars && spyData.bars.length >= 50) {
    const spyCloses = spyData.bars.map(b => b.close);
    const ema = calculateEMA(spyCloses, 50);
    spy50ma = ema[ema.length - 1];
    spyPrice = spyCloses[spyCloses.length - 1];
    spyAbove50ma = spyPrice > spy50ma;
  }

  console.log(`   VIX: ${vix?.toFixed(2) ?? 'unknown'}`);
  console.log(`   SPY: ${spyPrice?.toFixed(2) ?? '?'} (50-MA: ${spy50ma?.toFixed(2) ?? '?'}) — ${spyAbove50ma ? 'BULLISH' : 'BEARISH'}`);

  const marketRegime = {
    vix: vix ?? null,
    vixHostile: vix != null && vix > 22,
    spyPrice: spyPrice ? round2(spyPrice) : null,
    spy50ma: spy50ma ? round2(spy50ma) : null,
    spyAbove50ma,
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

  // RS rank computed across all candidates (continuation + first-stage)
  const returns60d = flagRaw.map(c => c.pattern.current.return60d);

  console.log('');
  console.log(`🎯 Scoring ${flagRaw.length} candidates...`);

  const allCandidates = flagRaw.map(c => {
    const rsPercentile = percentileRank(c.pattern.current.return60d, returns60d);
    const score = scoreFlag(c.pattern, { rsPercentile, spyAbove50ma });
    const levels = tradeLevel(c.pattern);

    const card = {
      ticker: c.ticker,
      name: c.name,
      exchange: c.exchange,
      price: round2(c.pattern.current.price),
      setupType: c.pattern.context.setupType,
      score: score.total,
      subscores: buildSubscores(score),
      breakdown: buildBreakdown(score),
      stage: c.pattern.stage,
      daysInFlag: c.pattern.flag.days,
      pattern: {
        polePct: round4(c.pattern.pole.magnitude),
        poleDays: c.pattern.pole.days,
        poleStartDate: c.pattern.pole.startDate,
        poleStartPrice: round2(c.pattern.pole.startPrice),
        recentHigh: round2(c.pattern.pole.endPrice),
        recentHighDate: c.pattern.pole.endDate,
        pullbackPct: round4(c.pattern.flag.pullbackPct),
        flagLow: round2(c.pattern.flag.low),
        volumeContraction: round2(c.pattern.flag.volumeContractionRatio),
        poleVolumeRatio: round2(c.pattern.pole.maxVolumeRatio),
        distAbove20Ema: round4(c.pattern.current.distAbove20Ema),
        direction: c.pattern.current.direction,
      },
      base: {
        baseDays: c.pattern.context.baseDays,
        baseRange: round4(c.pattern.context.baseRange),
        prePoleSlope: round4(c.pattern.context.prePoleSlope),
      },
      ema: {
        ema10: round2(c.pattern.current.ema10),
        ema20: round2(c.pattern.current.ema20),
        ema50: round2(c.pattern.current.ema50),
        ema50Rising: c.pattern.current.ema50Rising,
      },
      levels,
      rsPercentile: round4(rsPercentile),
      return60dPct: round4(c.pattern.current.return60d),
      chartUrl: buildChartUrl(c.exchange, c.ticker),
    };
    return card;
  });

  // Split into two lists, each sorted by score
  const continuationCandidates = allCandidates
    .filter(c => c.setupType === 'continuation')
    .sort((a, b) => b.score - a.score);

  const firstStageCandidates = allCandidates
    .filter(c => c.setupType === 'first-stage')
    .sort((a, b) => b.score - a.score);

  console.log('');
  console.log('📋 Split by setup type:');
  console.log(`   💪 Continuation: ${continuationCandidates.length}`);
  console.log(`   🌱 First-stage:  ${firstStageCandidates.length}`);

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

  await writeOutputs(continuationCandidates, firstStageCandidates, fiftyTwoWeekCandidates, marketRegime, {
    universeSize: universe.length,
    fetched: stats.fetched,
    failed: stats.failed,
    qualified: allCandidates.length,
    continuationCount: continuationCandidates.length,
    firstStageCount: firstStageCandidates.length,
  }, startedAt);
}

function buildSubscores(score) {
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
  if (bars.length < 60) return;
  const todayBar = bars[bars.length - 1];
  if (todayBar.close < 5) return;
  const lookback = Math.min(252, bars.length);
  let high52w = 0;
  for (let i = bars.length - lookback; i < bars.length; i++) {
    if (bars[i].high > high52w) high52w = bars[i].high;
  }
  const recentVols = bars.slice(-21, -1).map(b => b.volume);
  const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
  if (avgVol < 300000) return;
  const distFromHigh = (high52w - todayBar.close) / high52w;
  if (distFromHigh > 0.03) return;
  const todayVol = todayBar.volume;
  const volRatio = avgVol > 0 ? todayVol / avgVol : 0;
  if (volRatio < 1.2) return;
  const dayChange = bars.length >= 2
    ? (todayBar.close - bars[bars.length - 2].close) / bars[bars.length - 2].close
    : 0;
  collector.push({
    ticker,
    name: meta.name,
    exchange: cleanExchange(meta.exchange),
    price: round2(todayBar.close),
    high52w: round2(high52w),
    distFromHighPct: round4(distFromHigh),
    avgVolume: Math.round(avgVol),
    todayVolume: todayVol,
    volRatio: round2(volRatio),
    dayChangePct: round4(dayChange),
    chartUrl: buildChartUrl(cleanExchange(meta.exchange), ticker),
  });
}

function cleanExchange(raw) {
  if (!raw) return '';
  const s = raw.toUpperCase();
  if (s.includes('NASDAQ') || s.includes('NMS')) return 'NASDAQ';
  if (s.includes('NYSE') || s.includes('NYQ')) return 'NYSE';
  if (s.includes('AMEX') || s.includes('ASE')) return 'AMEX';
  return raw;
}

function buildChartUrl(exchange, ticker) {
  const exch = exchange?.toUpperCase();
  if (exch === 'NASDAQ' || exch === 'NYSE' || exch === 'AMEX') {
    return `https://www.tradingview.com/symbols/${exch}-${ticker}/`;
  }
  return `https://www.tradingview.com/symbols/${ticker}/`;
}

async function writeOutputs(continuation, firstStage, fiftyTwoWeek, marketRegime, stats, startedAt) {
  const completedAt = new Date();
  const durationMs = completedAt - startedAt;
  const dateStr = completedAt.toISOString().split('T')[0];

  fiftyTwoWeek.sort((a, b) => b.volRatio - a.volRatio);

  const payload = {
    schemaVersion: 2,
    scanDate: dateStr,
    timestamp: completedAt.toISOString(),
    durationSec: Math.round(durationMs / 1000),
    market: marketRegime,
    stats,
    continuationCandidates: continuation,
    firstStageCandidates: firstStage,
    // legacy alias for compatibility — combined sorted by score
    flagCandidates: [...continuation, ...firstStage].sort((a, b) => b.score - a.score),
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
