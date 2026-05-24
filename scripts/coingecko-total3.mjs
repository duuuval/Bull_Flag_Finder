// Fetches TOTAL3 (total crypto market cap excluding BTC and ETH) for the regime gate.
//
// TOTAL3 is a proxy for "altcoin liquidity" — when it's trending up, money is
// flowing into alts; when down, alts bleed regardless of what BTC does.
//
// CoinGecko provides /global for the aggregate snapshot, but for the 20-day EMA
// we need historical values. We use /global/market_cap_chart for that.

const COINGECKO_GLOBAL_URL = 'https://api.coingecko.com/api/v3/global';
const COINGECKO_HISTORICAL_URL = 'https://api.coingecko.com/api/v3/global/market_cap_chart?days=60';

// Fetch current snapshot: returns { total_market_cap_usd, btc_dominance, eth_dominance }
async function fetchCurrentSnapshot() {
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

  return {
    totalCap,
    btcDominancePct,
    ethDominancePct,
    btcCap: totalCap * (btcDominancePct / 100),
    ethCap: totalCap * (ethDominancePct / 100),
    total3Cap: totalCap * (1 - (btcDominancePct + ethDominancePct) / 100),
  };
}

// Fetch historical total market cap chart (last 60 days, daily).
// Returns array of { date, totalCapUsd }.
// Note: CoinGecko's public /global/market_cap_chart only returns total cap,
// not BTC/ETH separately. For a proper TOTAL3 history, we'd need to subtract
// BTC and ETH historical caps too. For the EMA, we approximate by using
// the current BTC+ETH dominance fraction against historical total cap.
// This is imperfect but directionally correct for a regime gate.
async function fetchHistoricalTotalCap() {
  const res = await fetch(COINGECKO_HISTORICAL_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BFF-Crypto/1.0)' },
  });

  if (!res.ok) {
    throw new Error(`CoinGecko /global/market_cap_chart returned HTTP ${res.status}`);
  }

  const data = await res.json();
  const series = data?.market_cap_chart?.market_cap || data?.market_caps || [];

  if (!Array.isArray(series) || series.length === 0) {
    throw new Error('CoinGecko historical chart returned empty series');
  }

  // Each entry is [timestamp_ms, market_cap_usd]
  return series.map(([ts, cap]) => ({
    timestamp: ts,
    date: new Date(ts).toISOString().split('T')[0],
    totalCapUsd: cap,
  }));
}

// 20-period EMA helper (local — kept self-contained to avoid extra import in this file).
function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let e = sum / period;
  for (let i = period; i < values.length; i++) {
    e = values[i] * k + e * (1 - k);
  }
  return e;
}

// Returns { total3Cap, total3Ema20, above, deltaPct } or null on failure.
// `above` = current TOTAL3 > 20-day EMA (i.e. alt liquidity healthy).
// `deltaPct` = (current - ema) / ema, signed.
export async function fetchTotal3Status() {
  try {
    console.log('🌐 Fetching TOTAL3 from CoinGecko...');
    const [snapshot, history] = await Promise.all([
      fetchCurrentSnapshot(),
      fetchHistoricalTotalCap(),
    ]);

    // Approximate historical TOTAL3 by applying current alt-share fraction to historical total cap.
    // This isn't perfect (BTC/ETH dominance shifts over time) but it's directionally usable
    // for the 20-day EMA comparison.
    const altShare = 1 - (snapshot.btcDominancePct + snapshot.ethDominancePct) / 100;
    const total3History = history.map(h => h.totalCapUsd * altShare);

    const total3Ema20 = ema(total3History, 20);

    if (total3Ema20 == null) {
      throw new Error(`Not enough TOTAL3 history (got ${total3History.length} days)`);
    }

    const total3Cap = snapshot.total3Cap;
    const above = total3Cap > total3Ema20;
    const deltaPct = (total3Cap - total3Ema20) / total3Ema20;

    console.log(`   TOTAL3: $${(total3Cap / 1e9).toFixed(1)}B, EMA20: $${(total3Ema20 / 1e9).toFixed(1)}B, ${above ? 'ABOVE' : 'BELOW'}`);

    return {
      total3Cap,
      total3Ema20,
      above,
      deltaPct,
    };
  } catch (e) {
    console.error(`❌ TOTAL3 fetch failed: ${e.message}`);
    return null;
  }
}
