// scripts/backtest-crypto.mjs
import { getCryptoUniverse } from './crypto-universe.mjs';
import { processCryptoUniverse } from './binance.mjs';
import { detectCryptoFlag, ALT_GATES } from './crypto-detection.mjs';

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║      BFF · CRYPTO BACKTEST (166 DAYS)      ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const universe = await getCryptoUniverse();
  console.log(`📡 Fetching 1,000 bars for ${universe.length} assets...\n`);

  let totalHits = 0;

  await processCryptoUniverse(universe, async (asset, data) => {
    const { bars } = data;
    if (!bars || bars.length < 100) return null;

    const hits = [];
    const seenPoles = new Set();

    // Time-travel loop: feed the detector growing slices of history
    for (let i = 100; i <= bars.length; i++) {
      const slice = bars.slice(0, i);
      // Pass asset.symbol so the detector can emit diagnostic logs for NEAR
      const pattern = detectCryptoFlag(slice, ALT_GATES, asset.symbol);

      if (pattern) {
        // Deduplicate by pole start date so we don't spam the log for the same flag
        const poleId = pattern.pole.startDate;
        if (!seenPoles.has(poleId)) {
          seenPoles.add(poleId);
          hits.push({
            triggerDate: slice[slice.length - 1].date.split('T')[0],
            polePct: pattern.pole.magnitude,
            flagBars: pattern.flag.bars,
            direction: pattern.current.direction,
          });
        }
      }
    }

    if (hits.length > 0) {
      console.log(`\n✅ ${asset.symbol} triggered ${hits.length} distinct flags historically:`);
      hits.forEach((h, idx) => {
        console.log(`   ${idx + 1}. Triggered: ${h.triggerDate} | Pole: ${(h.polePct * 100).toFixed(1)}% | Flag duration: ${h.flagBars} bars`);
      });
      totalHits += hits.length;
    }

    return null;
  }, { delayMs: 200, progressEvery: 10 });

  console.log('\n╔════════════════════════════════════════════╗');
  console.log(`║  BACKTEST COMPLETE: ${totalHits} total setups found   ║`);
  console.log('╚════════════════════════════════════════════╝\n');
}

main().catch(err => {
  console.error('❌ Backtest failed:', err);
  process.exit(1);
});
