// BFF Crypto Scan Runner
//
// Runs every 4 hours via GitHub Actions cron.
// Writes public/latest-crypto.json (current) and public/scans-crypto/YYYY-MM-DD-HH.json (archive).
//
// BTC and ETH get persistent treatment: scanned with MAJOR_GATES (looser, see
// crypto-detection.mjs), and always emitted to output with at least a price/EMA
// context block even when no flag fires. The UI uses this for two always-on
// reference cards at the top of the crypto page.
//
// Everything else uses ALT_GATES (current production gates) and only appears in
// output when a flag fires.
//
// Regime gate: BTC daily > 50-EMA. TOTAL3 is displayed for context but does NOT
// trigger hostile/warning status (CoinGecko moved historical TOTAL3 to paid tier).
//
// Output schema v3: adds top-level `majors` array of {asset, context, flag} for
// BTC + ETH always-on cards. Existing `candidates` array continues to contain
// the alt-tier scanner output unchanged.

import fs from 'fs';
import path from 'path';
import { getCryptoUniverse } from './crypto-universe.mjs';
import { fetch4hBars, fetchDailyBars, processCryptoUniverse } from './binance.mjs';
import { fetchTotal3Status } from './coingecko-total3.mjs';
import { detectCryptoFlag, computeAssetContext, ALT_GATES, MAJOR_GATES } from './crypto-detection.mjs';
import { scoreCryptoFlag } from './crypto-scoring.mjs';
import { calculateEMA } from './ema.mjs';

const OUTPUT_DIR = path.join(process.cwd(), 'public');
const ARCHIVE_DIR = path.join(OUTPUT_DIR, 'scans-crypto');

// BTC and ETH are always-on reference assets, scanned with MAJOR_GATES,
// emitted to output regardless of whether a flag fires.
const MAJOR_ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', binanceSymbol: 'BTCUSDT', rank: 1 },
  { symbol: 'ETH', name: 'Ethereum', binanceSymbol: 'ETHUSDT', rank: 2 },
];

async function main() {
  const startedAt = new Date();
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║      BFF · BULL FLAG FINDER · CRYPTO       ║');
  console.log(`║         ${startedAt.toISOString()}      ║`);
  console.log('╚════════════════════════════════════════════╝');
  console.log('');

  // === REGIME ===
  console.log('🌍 Fetching crypto market regime...');
  const [btcDailyData, total3Snapshot] = await Promise.all([
    fetchDailyBars('BTCUSDT'),
    fetchTotal3Status(),
  ]);

  let btcRegime = {
    price: null,
    ema50: null,
    above: false,
    deltaPct: null,
  };

  if (btcDailyData?.bars && btcDailyData.bars.length >= 50) {
    const closes = btcDailyData.bars.map(b => b.close);
    const ema = calculateEMA(closes, 50);
    const ema50 = ema[ema.length - 1];
    const price = closes[closes.length - 1];
    btcRegime = {
      price,
      ema50,
      above: price > ema50,
      deltaPct: (price - ema50) / ema50,
    };
    console.log(`   BTC: $${price.toFixed(0)}, 50-EMA daily: $${ema50.toFixed(0)} (${btcRegime.above ? 'ABOVE' : 'BELOW'})`);
  } else {
    console.warn('⚠️ Could not fetch BTC daily bars for regime check');
  }

  const btcOk = btcRegime.above === true;
  const triggered = [];
  if (!btcOk) triggered.push('btc_below_50ema');

  const regimeStatus = triggered.length === 0 ? 'ok' : 'warning';

  const regime = {
    status: regimeStatus,
    btc: {
      price: btcRegime.price != null ? round2(btcRegime.price) : null,
      ema50: btcRegime.ema50 != null ? round2(btcRegime.ema50) : null,
      above: btcOk,
      deltaPct: btcRegime.deltaPct != null ? round4(btcRegime.deltaPct) : null,
    },
    total3: total3Snapshot ? {
      cap: Math.round(total3Snapshot.total3Cap),
      btcDominancePct: round2(total3Snapshot.btcDominancePct),
      ethDominancePct: round2(total3Snapshot.ethDominancePct),
      totalCap: Math.round(total3Snapshot.totalCap),
      ema20: null,
      above: null,
      deltaPct: null,
    } : {
      cap: null,
      ema20: null,
      above: null,
      deltaPct: null,
      btcDominancePct: null,
      ethDominancePct: null,
      totalCap: null,
    },
    triggered,
  };

  console.log(`   Regime status: ${regimeStatus.toUpperCase()}${triggered.length > 0 ? ` (${triggered.join(', ')})` : ''}`);

  const scanContext = {
    btcAbove50ema: btcOk,
    total3Above20ema: true,
  };

  // === MAJORS: BTC + ETH, always emitted ===
  console.log('');
  console.log('🟠 Scanning majors (BTC, ETH) with major gates...');
  const majors = [];
  for (const asset of MAJOR_ASSETS) {
    const data = await fetch4hBars(asset.binanceSymbol);
    if (!data || data.error) {
      console.warn(`   ⚠️ ${asset.symbol}: fetch failed — ${data?.error?.reason || 'unknown'}`);
      majors.push(buildMajorCard(asset, null, null, scanContext));
      continue;
    }
    const { bars } = data;
    const pattern = detectCryptoFlag(bars, MAJOR_GATES);
    const context = computeAssetContext(bars);
    const card = buildMajorCard(asset, pattern, context, scanContext);
    majors.push(card);
    if (pattern) {
      console.log(`   ✓ ${asset.symbol}: FLAG  pole ${(pattern.pole.magnitude * 100).toFixed(1)}%  ${pattern.stage}  score ${card.score}`);
    } else if (context) {
      console.log(`   · ${asset.symbol}: no flag  $${formatPriceLog(context.price)}  ${context.aboveEma50 ? 'above' : 'below'} 50ema  stack:${context.stack}`);
    } else {
      console.log(`   ! ${asset.symbol}: insufficient data`);
    }
  }

  // === UNIVERSE (alts) ===
  console.log('');
  console.log('📡 Fetching crypto universe...');
  let universe = await getCryptoUniverse();
  // Exclude BTC and ETH from the alt scan — they're already covered as majors.
  const majorSymbols = new Set(MAJOR_ASSETS.map(a => a.binanceSymbol));
  universe = universe.filter(u => !majorSymbols.has(u.binanceSymbol));
  console.log(`   Scanning ${universe.length} alt assets...`);
  console.log('');

  // === ALT SCAN ===
  const { results: flagRaw, stats, failures } = await processCryptoUniverse(universe, async (asset, data) => {
    const { bars } = data;
    const pattern = detectCryptoFlag(bars, ALT_GATES);
    if (!pattern) return null;
    return { asset, pattern };
  }, { delayMs: 200, progressEvery: 10 });

  console.log('');
  console.log('📈 Alt scan stats:');
  console.log(`   Universe: ${universe.length}`);
  console.log(`   Fetched: ${stats.fetched}`);
  console.log(`   Failed: ${stats.failed}`);
  console.log(`   Flag candidates: ${flagRaw.length}`);

  // === SCORE ===
  console.log('');
  console.log(`🎯 Scoring ${flagRaw.length} alt candidates...`);

  const candidates = flagRaw.map(c => {
    const score = scoreCryptoFlag(c.pattern, scanContext);
    return buildCard(c.asset, c.pattern, score);
  });

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0) {
    console.log('');
    console.log('   Top 10 alt candidates:');
    candidates.slice(0, 10).forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.symbol.padEnd(8)} ${c.score.toString().padStart(3)} ${c.stage.padEnd(8)} ${c.pattern.direction.padEnd(10)} pole ${(c.pattern.polePct * 100).toFixed(1)}%`);
    });
  }

  // Build universe output array for UI transparency
  const failedSymbolSet = new Set(failures ? failures.map(f => f.symbol) : []);
  const universeForOutput = universe.map(u => ({
    symbol: u.symbol.toUpperCase(),
    name: u.name,
    binanceSymbol: u.binanceSymbol,
    rank: u.rank,
    marketCap: u.marketCap,
    scanned: !failedSymbolSet.has(u.binanceSymbol),
  }));

  // === WRITE OUTPUTS ===
  await writeOutputs(majors, candidates, regime, universeForOutput, {
    universeSize: universe.length,
    fetched: stats.fetched,
    failed: stats.failed,
    qualified: candidates.length,
    failedSymbols: failures ? failures.map(f => f.symbol) : [],
  }, startedAt);
}

// Build a major-asset card for BTC/ETH.
// Always emits something; `flag` may be null when no pattern fires.
function buildMajorCard(asset, pattern, context, scanContext) {
  const base = {
    symbol: asset.symbol,
    name: asset.name,
    binanceSymbol: asset.binanceSymbol,
    rank: asset.rank,
    chartUrl: buildTradingViewUrl(asset.binanceSymbol),
    tier: 'major',
  };

  if (!context) {
    return {
      ...base,
      context: null,
      flag: null,
      score: null,
      stage: null,
    };
  }

  const contextOut = {
    price: roundForPrice(context.price),
    change24h: round4(context.change24h),
    ema10: roundForPrice(context.ema10),
    ema20: roundForPrice(context.ema20),
    ema50: roundForPrice(context.ema50),
    ema50Rising: context.ema50Rising,
    aboveEma50: context.aboveEma50,
    stack: context.stack,
    direction: context.direction,
    distAbove20Ema: round4(context.distAbove20Ema),
    asOf: context.date,
  };

  if (!pattern) {
    return {
      ...base,
      context: contextOut,
      flag: null,
      score: null,
      stage: null,
    };
  }

  // Flag fired — score it and emit the full card shape, alongside the context block
  const score = scoreCryptoFlag(pattern, scanContext);
  const flagCard = buildCard(asset, pattern, score);

  return {
    ...base,
    context: contextOut,
    flag: flagCard,
    score: flagCard.score,
    stage: flagCard.stage,
  };
}

function buildCard(asset, pattern, score) {
  return {
    id: asset.id,
    symbol: asset.symbol.toUpperCase(),
    name: asset.name,
    binanceSymbol: asset.binanceSymbol,
    marketCap: asset.marketCap,
    rank: asset.rank,
    image: asset.image,
    price: roundForPrice(pattern.current.price),
    score: score.total,
    subscores: {
      pole: score.pole.total,
      flag: score.flag.total,
      structure: score.structure.total,
    },
    breakdown: {
      poleMagnitude: score.pole.magnitude,
      poleVelocity: score.pole.velocity,
      poleVolume: score.pole.volume,
      flagPullback: score.flag.pullbackQuality,
      flagContraction: score.flag.contraction,
      flagEntry: score.flag.entry,
      stack: score.structure.stack,
      regime: score.structure.regime,
    },
    stage: pattern.stage,
    barsInFlag: pattern.flag.bars,
    pattern: {
      polePct: round4(pattern.pole.magnitude),
      poleBars: pattern.pole.bars,
      poleStartDate: pattern.pole.startDate,
      poleStartPrice: roundForPrice(pattern.pole.startPrice),
      recentHigh: roundForPrice(pattern.pole.endPrice),
      recentHighDate: pattern.pole.endDate,
      pullbackPctAbsolute: round4(pattern.flag.pullbackPctAbsolute),
      pullbackFracOfPole: round4(pattern.flag.pullbackFracOfPole),
      flagLow: roundForPrice(pattern.flag.low),
      flagHigh: roundForPrice(pattern.flag.high),
      volumeContraction: round2(pattern.flag.volumeContractionRatio),
      cumulativePoleVolumeRatio: round2(pattern.pole.cumulativeVolumeRatio),
      maxBarVolumeRatio: round2(pattern.pole.maxBarVolumeRatio),
      highsSlope: round4(pattern.flag.highsSlope),
      lowsSlope: round4(pattern.flag.lowsSlope),
      distAbove20Ema: round4(pattern.current.distAbove20Ema),
      direction: pattern.current.direction,
    },
    ema: {
      ema10: roundForPrice(pattern.current.ema10),
      ema20: roundForPrice(pattern.current.ema20),
      ema50: roundForPrice(pattern.current.ema50),
      ema50Rising: pattern.current.ema50Rising,
    },
    return60bars: round4(pattern.current.return60bars),
    chartUrl: buildTradingViewUrl(asset.binanceSymbol),
  };
}

function buildTradingViewUrl(binanceSymbol) {
  return `https://www.tradingview.com/symbols/${binanceSymbol}/?exchange=BINANCE`;
}

async function writeOutputs(majors, candidates, regime, universe, stats, startedAt) {
  const completedAt = new Date();
  const durationMs = completedAt - startedAt;

  const iso = completedAt.toISOString();
  const datePart = iso.split('T')[0];
  const hourPart = iso.split('T')[1].split(':')[0];
  const archiveName = `${datePart}-${hourPart}.json`;

  const payload = {
    schemaVersion: 3,
    scanDate: datePart,
    scanHourUtc: hourPart,
    timestamp: completedAt.toISOString(),
    durationSec: Math.round(durationMs / 1000),
    regime,
    stats,
    universe,
    majors,
    candidates,
  };

  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const latestPath = path.join(OUTPUT_DIR, 'latest-crypto.json');
  const archivePath = path.join(ARCHIVE_DIR, archiveName);

  fs.writeFileSync(latestPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(archivePath, JSON.stringify(payload, null, 2));

  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log(`║  ✅ CRYPTO SCAN COMPLETE in ${Math.round(durationMs / 1000).toString().padStart(4)}s        ║`);
  console.log('╚════════════════════════════════════════════╝');
  console.log(`   Wrote: public/latest-crypto.json`);
  console.log(`   Wrote: public/scans-crypto/${archiveName}`);
  console.log('');
}

function roundForPrice(n) {
  if (n == null) return null;
  if (n >= 100) return Math.round(n * 100) / 100;
  if (n >= 1) return Math.round(n * 10000) / 10000;
  if (n >= 0.01) return Math.round(n * 1000000) / 1000000;
  return Math.round(n * 100000000) / 100000000;
}

function formatPriceLog(n) {
  if (n == null) return '—';
  if (n >= 100) return n.toFixed(0);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
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
  console.error('❌ Crypto scan failed:', err);
  console.error(err.stack);
  process.exit(1);
});
