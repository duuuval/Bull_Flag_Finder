// Binance.US public API fetcher for 4h OHLCV bars.
// No API key required. Polite throttling. Returns clean OHLCV bars.
//
// Endpoint: GET /api/v3/klines
// Rate limit: 1200 weight/minute for public endpoints (1 weight per call).
// We pace ourselves anyway at 200ms between calls.
//
// Why Binance.US instead of Binance global:
// Binance global (api.binance.com) returns HTTP 451 "Unavailable For Legal Reasons"
// to US-based IPs including GitHub Actions runners (Azure US data centers).
// Binance.US (api.binance.us) is US-accessible and has the same API shape.
// Pair coverage is smaller (~150 vs 1700+) but all top-30 coins by market cap are listed.

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const USER_AGENT = 'Mozilla/5.0 (compatible; BFF-Crypto/1.0)';

const BINANCE_API_BASE = 'https://api.binance.us';

// Fetch 4h klines for a single Binance trading pair.
// Returns: { bars: [{ date, open, high, low, close, volume }], meta: { symbol } } or null
// `limit` defaults to 500 (Binance allows up to 1000 per request).
// 500 4h bars = ~83 days of history, which is enough for our 50-bar EMA + ~30-bar pole/flag detection window.
// Using 1000 gives us ~166 days = comfortably enough margin.
export async function fetch4hBars(binanceSymbol, limit = 1000) {
  const url = `${BINANCE_API_BASE}/api/v3/klines?symbol=${encodeURIComponent(binanceSymbol)}&interval=4h&limit=${limit}`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    // Binance kline format (array of arrays):
    // [ openTime, open, high, low, close, volume, closeTime, ... ]
    const bars = [];
    for (const k of data) {
      const openTime = k[0];
      const open = parseFloat(k[1]);
      const high = parseFloat(k[2]);
      const low = parseFloat(k[3]);
      const close = parseFloat(k[4]);
      const volume = parseFloat(k[5]);

      if ([open, high, low, close].some(v => isNaN(v) || v <= 0)) continue;

      bars.push({
        date: new Date(openTime).toISOString(),
        timestamp: openTime,
        open,
        high,
        low,
        close,
        volume: isNaN(volume) ? 0 : volume,
      });
    }

    if (bars.length < 60) return null;

    return {
      bars,
      meta: {
        symbol: binanceSymbol,
      },
    };
  } catch (e) {
    return null;
  }
}

// Fetch daily klines for a single Binance trading pair (used for regime check on BTC).
export async function fetchDailyBars(binanceSymbol, limit = 200) {
  const url = `${BINANCE_API_BASE}/api/v3/klines?symbol=${encodeURIComponent(binanceSymbol)}&interval=1d&limit=${limit}`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const bars = [];
    for (const k of data) {
      const openTime = k[0];
      const open = parseFloat(k[1]);
      const high = parseFloat(k[2]);
      const low = parseFloat(k[3]);
      const close = parseFloat(k[4]);
      const volume = parseFloat(k[5]);

      if ([open, high, low, close].some(v => isNaN(v) || v <= 0)) continue;

      bars.push({
        date: new Date(openTime).toISOString().split('T')[0],
        timestamp: openTime,
        open,
        high,
        low,
        close,
        volume: isNaN(volume) ? 0 : volume,
      });
    }

    if (bars.length < 50) return null;

    return { bars, meta: { symbol: binanceSymbol } };
  } catch (e) {
    return null;
  }
}

// Process universe in throttled batches.
// `assets` is array of { id, symbol, name, binanceSymbol, ... } objects.
// callback receives (asset, barsData, stats) and may return a result to collect.
export async function processCryptoUniverse(assets, callback, options = {}) {
  const { delayMs = 200, progressEvery = 10 } = options;
  const results = [];
  const stats = { fetched: 0, failed: 0, qualified: 0 };

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const data = await fetch4hBars(asset.binanceSymbol);

    if (!data) {
      stats.failed++;
    } else {
      stats.fetched++;
      try {
        const result = await callback(asset, data, stats);
        if (result) {
          results.push(result);
          stats.qualified++;
        }
      } catch (e) {
        console.warn(`⚠️ Error processing ${asset.symbol}: ${e.message}`);
      }
    }

    if ((i + 1) % progressEvery === 0) {
      console.log(`   ${i + 1}/${assets.length} processed | fetched: ${stats.fetched} | failed: ${stats.failed} | qualified: ${stats.qualified}`);
    }

    await sleep(delayMs);
  }

  return { results, stats };
}
