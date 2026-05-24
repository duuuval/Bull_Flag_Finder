// BFF Crypto Scan Runner
//
// Runs every 4 hours via GitHub Actions cron.
// Writes public/latest-crypto.json (current) and public/scans-crypto/YYYY-MM-DD-HH.json (archive).

import fs from 'fs';
import path from 'path';
import { getCryptoUniverse } from './crypto-universe.mjs';
import { fetchDailyBars, processCryptoUniverse } from './binance.mjs';
import { fetchTotal3Status } from './coingecko-total3.mjs';
import { detectCryptoFlag } from './crypto-detection.mjs';
import { scoreCryptoFlag } from './crypto-scoring.mjs';
import { calculateEMA } from './ema.mjs';

const OUTPUT_DIR = path.join(process.cwd(), 'public');
const ARCHIVE_DIR = path.join(OUTPUT_DIR, 'scans-crypto');

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
  const [btcDailyData, total3Status] = await Promise.all([
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
  const total3Ok = total3Status?.above === true;
  const triggered = [];
  if (!btcOk) triggered.push('btc_below_50ema');
  if (!total3Ok) triggered.push('total3_below_20ema');

  let regimeStatus;
  if (triggered.length === 0) regimeStatus = 'ok';
  else if (triggered.length === 1) regimeStatus = 'warning';
  else regimeStatus = 'hostile';

  const regime = {
    status: regimeStatus,
    btc: {
      price: btcRegime.price != null ? round2(btcRegime.price) : null,
      ema50: btcRegime.ema50 != null ? round2(btcRegime.ema50) : null,
      above: btcOk,
      deltaPct: btcRegime.deltaPct != null ? round4(btcRegime.deltaPct) : null,
    },
    total3: total3Status ? {
      cap: Math.round(total3Status.total3Cap),
      ema20: Math.round(total3Status.total3Ema20),
      above: total3Status.above,
      deltaPct: round4(total3Status.deltaPct),
    } : {
      cap: null,
      ema20: null,
      above: null,
      deltaPct: null,
    },
    triggered,
  };

  console.log(`   Regime status: ${regimeStatus.toUpperCase()}${triggered.length > 0 ? ` (${triggered.join(', ')})` : ''}`);

  // === UNIVERSE ===
  console.log('');
  console.log('📡 Fetching crypto universe...');
  const universe = await getCryptoUniverse();
  console.log(`   Scanning ${universe.length} assets...`);
  console.log('');

  // === SCAN ===
  const scanContext = {
    btcAbove50ema: btcOk,
    total3Above20ema: total3Ok,
  };

  const { results: flagRaw, stats } = await processCryptoUniverse(universe, async (asset, data) => {
    const { bars } = data;
    const pattern = detectCryptoFlag(bars);
    if (!pattern) return null;

    return {
      asset,
      pattern,
    };
  }, { delayMs: 200, progressEvery: 10 });

  console.log('');
  console.log('📈 Scan stats:');
  console.log(`   Universe: ${universe.length}`);
  console.log(`   Fetched: ${stats.fetched}`);
  console.log(`   Failed: ${stats.failed}`);
  console.log(`   Flag candidates: ${flagRaw.length}`);

  // === SCORE ===
  console.log('');
  console.log(`🎯 Scoring ${flagRaw.length} candidates...`);

  const candidates = flagRaw.map(c => {
    const score = scoreCryptoFlag(c.pattern, scanContext);
    return buildCard(c.asset, c.pattern, score);
  });

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0) {
    console.log('');
    console.log('   Top 10 candidates:');
    candidates.slice(0, 10).forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.symbol.padEnd(8)} ${c.score.toString().padStart(3)} ${c.stage.padEnd(8)} ${c.pattern.direction.padEnd(10)} pole ${(c.pattern.polePct * 100).toFixed(1)}%`);
    });
  }

  // === WRITE OUTPUTS ===
  await writeOutputs(candidates, regime, {
    universeSize: universe.length,
    fetched: stats.fetched,
    failed: stats.failed,
    qualified: candidates.length,
  }, startedAt);
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

// Chart display: use BINANCE: (global) prefix even though we scan Binance.US data.
// Reason: Binance global has 5-10x the volume of Binance.US, so the TradingView chart
// will render with deeper liquidity and tighter spreads. Arbitrage keeps prices nearly
// identical (sub-dollar differences on BTC), so the patterns we detect on Binance.US
// data render the same on the Binance global chart the user views.
function buildTradingViewUrl(binanceSymbol) {
  return `https://www.tradingview.com/symbols/${binanceSymbol}/?exchange=BINANCE`;
}

async function writeOutputs(candidates, regime, stats, startedAt) {
  const completedAt = new Date();
  const durationMs = completedAt - startedAt;

  // Archive filename: YYYY-MM-DD-HH (UTC) so 6 runs per day each get distinct files
  const iso = completedAt.toISOString(); // 2026-05-24T14:30:00.000Z
  const datePart = iso.split('T')[0];
  const hourPart = iso.split('T')[1].split(':')[0];
  const archiveName = `${datePart}-${hourPart}.json`;

  const payload = {
    schemaVersion: 1,
    scanDate: datePart,
    scanHourUtc: hourPart,
    timestamp: completedAt.toISOString(),
    durationSec: Math.round(durationMs / 1000),
    regime,
    stats,
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

// Crypto prices range from $0.00001 (some shitcoins) to $100,000+ (BTC).
// Use adaptive rounding: keep enough precision for sub-dollar tokens.
function roundForPrice(n) {
  if (n == null) return null;
  if (n >= 100) return Math.round(n * 100) / 100;          // BTC, ETH range: 2 decimals
  if (n >= 1) return Math.round(n * 10000) / 10000;        // SOL, BNB range: 4 decimals
  if (n >= 0.01) return Math.round(n * 1000000) / 1000000; // ADA, XRP range: 6 decimals
  return Math.round(n * 100000000) / 100000000;             // Micro caps: 8 decimals
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
