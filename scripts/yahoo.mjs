// Yahoo Finance chart fetcher
// No API key required. Polite throttling. Returns clean OHLCV bars.

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Fetch 1 year of daily bars for a single ticker
// Returns: { bars: [{ date, open, high, low, close, volume }], meta: { name, exchange, marketCap } } or null
export async function fetchBars(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.chart?.result?.[0]) return null;

    const result = data.chart.result[0];
    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0];
    if (!quote || timestamps.length === 0) return null;

    const { open, high, low, close, volume } = quote;
    const bars = [];

    for (let i = 0; i < timestamps.length; i++) {
      // Skip null entries (Yahoo sometimes has gaps)
      if (close[i] == null || open[i] == null || high[i] == null || low[i] == null) continue;
      bars.push({
        date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
        open: open[i],
        high: high[i],
        low: low[i],
        close: close[i],
        volume: volume[i] || 0,
      });
    }

    if (bars.length < 60) return null; // Need minimum history

    return {
      bars,
      meta: {
        name: result.meta?.longName || result.meta?.shortName || ticker,
        exchange: result.meta?.exchangeName || result.meta?.fullExchangeName || '',
        currency: result.meta?.currency || 'USD',
        marketPrice: result.meta?.regularMarketPrice,
      },
    };
  } catch (e) {
    return null;
  }
}

// Fetch VIX
export async function fetchVix() {
  try {
    const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/^VIX?interval=1d&range=5d', {
      headers: { 'User-Agent': USER_AGENT },
    });
    const data = await res.json();
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || null;
  } catch (e) {
    return null;
  }
}

// Fetch SPY for market regime check (need 60+ days for 50-day MA)
export async function fetchSPY() {
  return fetchBars('SPY');
}

// Process universe in throttled batches
// callback receives (ticker, barsData) and may return a result to collect
export async function processUniverse(tickers, callback, options = {}) {
  const { delayMs = 200, progressEvery = 100 } = options;
  const results = [];
  const stats = { fetched: 0, failed: 0, qualified: 0 };

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    const data = await fetchBars(ticker);

    if (!data) {
      stats.failed++;
    } else {
      stats.fetched++;
      try {
        const result = await callback(ticker, data, stats);
        if (result) {
          results.push(result);
          stats.qualified++;
        }
      } catch (e) {
        // Don't let callback errors kill the scan
        console.warn(`⚠️ Error processing ${ticker}: ${e.message}`);
      }
    }

    if ((i + 1) % progressEvery === 0) {
      console.log(`   ${i + 1}/${tickers.length} processed | fetched: ${stats.fetched} | failed: ${stats.failed} | qualified: ${stats.qualified}`);
    }

    await sleep(delayMs);
  }

  return { results, stats };
}
