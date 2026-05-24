// Fetches TOTAL3 (total crypto market cap excluding BTC and ETH) for display.
//
// IMPORTANT: CoinGecko moved the historical /global/market_cap_chart endpoint
// to their paid tier ($35/mo Demo Pro and up) as of late 2025. The free /global
// snapshot endpoint still works and gives us the current TOTAL3 cap, but we can
// no longer compute the 20-day EMA without a paid key.
//
// Decision: TOTAL3 becomes INFORMATIONAL ONLY in the regime banner. The regime
// gate now uses BTC trend exclusively. TOTAL3 cap is displayed for context but
// does not trigger hostile/warning status.
//
// If you ever upgrade to a paid CoinGecko key, restore the historical fetch
// from the previous version and wire `above` back into the regime triggers.

const COINGECKO_GLOBAL_URL = 'https://api.coingecko.com/api/v3/global';

// Fetch current snapshot only — free tier.
// Returns { total3Cap, btcDominancePct, ethDominancePct, totalCap } or null.
export async function fetchTotal3Status() {
  try {
    console.log('🌐 Fetching crypto market snapshot from CoinGecko...');
    const res = await fetch(COINGECKO_GLOBAL_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BFF-Crypto/1.0)' },
    });

    if (!res.ok) {
      throw new Error(`CoinGecko /global returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const d = data?.data;
    if (!d) throw new Error('CoinGecko /global returned invalid data');

    const totalCap = d.total_market_cap?.usd || 0;
    const btcDominancePct = d.market_cap_percentage?.btc || 0;
    const ethDominancePct = d.market_cap_percentage?.eth || 0;
    const total3Cap = totalCap * (1 - (btcDominancePct + ethDominancePct) / 100);

    console.log(`   TOTAL: $${(totalCap / 1e9).toFixed(0)}B · BTC dom: ${btcDominancePct.toFixed(1)}% · ETH dom: ${ethDominancePct.toFixed(1)}%`);
    console.log(`   TOTAL3: $${(total3Cap / 1e9).toFixed(1)}B (informational only — no EMA gate on free tier)`);

    return {
      totalCap,
      total3Cap,
      btcDominancePct,
      ethDominancePct,
    };
  } catch (e) {
    console.error(`❌ TOTAL3 snapshot fetch failed: ${e.message}`);
    return null;
  }
}
