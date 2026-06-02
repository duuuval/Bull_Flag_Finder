// Kraken public API fetcher for OHLCV bars.
// No API key required. Returns clean OHLCV bars in the SAME shape the old
// Binance.US fetcher returned, so nothing downstream changes.
//
// Endpoint: GET https://api.kraken.com/0/public/OHLC?pair=<altname>&interval=<minutes>
//   interval 240 = 4h, 1440 = 1d  (both native — no aggregation needed)
//   Returns up to 720 candles of the requested interval, ending with the
//   current (not-yet-closed) candle as the final element — same as Binance.
//   Response `result` is keyed by Kraken's internal pair name plus a "last" key.
//
// Kraken quirks handled here:
//   - HTTP 200 with a non-empty `error` array means an API-level error
//     (rate limit, unknown pair, etc.). We treat that as a failure.
//   - OHLC rows are [time(s), open, high, low, close, vwap, volume, count].
//     Numeric fields are STRINGS; time is in SECONDS; volume is index 6
//     (Binance had it at index 5 — there is no vwap column on Binance).
//   - Public OHLC is rate-limited by IP; ~1-2 req/sec is safe. We pace.
//
// Why Kraken instead of Binance.US:
//   Binance.com 451-blocks US runners, which is the ONLY reason the project was
//   on Binance.US (~190 coins). Kraken is US-accessible, needs no key, serves
//   native 4h candles, and lists several hundred USD spot pairs — a much wider
//   universe with no new friction. The 720-candle history cap only affects the
//   deep backtest scripts, which are out of scope here.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const USER_AGENT = 'Mozilla/5.0 (compatible; BFF-Crypto/1.0)';
const KRAKEN_API_BASE = 'https://api.kraken.com';

// Pull the OHLC array out of Kraken's result object (keyed by an internal pair
// name, plus a "last" cursor key we ignore).
function extractOhlc(result) {
  if (!result || typeof result !== 'object') return null;
  for (const key of Object.keys(result)) {
    if (key === 'last') continue;
    if (Array.isArray(result[key])) return result[key];
  }
  return null;
}

async function fetchKrakenOhlc(pair, interval) {
  const url = `${KRAKEN_API_BASE}/0/public/OHLC?pair=${encodeURIComponent(pair)}&interval=${interval}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { httpError: { status: res.status, reason: body.slice(0, 120) || 'no body' } };
  }

  const json = await res.json();
  // Kraken returns HTTP 200 even for API-level errors; the signal is `error`.
  if (json.error && json.error.length > 0) {
    return { httpError: { status: 200, reason: json.error.join('; ').slice(0, 120) } };
  }

  return { rows: extractOhlc(json.result) };
}

function rowsToBars(rows, { dateOnly = false } = {}) {
  const bars = [];
  let volSum = 0;

  for (const r of rows) {
    const timeMs = Number(r[0]) * 1000;
    const open = parseFloat(r[1]);
    const high = parseFloat(r[2]);
    const low = parseFloat(r[3]);
    const close = parseFloat(r[4]);
    const volume = parseFloat(r[6]); // index 6 on Kraken (5 is vwap)

    if ([open, high, low, close].some((v) => isNaN(v) || v <= 0)) continue;

    const v = isNaN(volume) ? 0 : volume;
    volSum += v;

    bars.push({
      date: dateOnly
        ? new Date(timeMs).toISOString().split('T')[0]
        : new Date(timeMs).toISOString(),
      timestamp: timeMs,
      open,
      high,
      low,
      close,
      volume: v,
    });
  }

  return { bars, volSum };
}

// Fetch 4h bars for a single Kraken pair (altname, e.g. "SOLUSD", "XBTUSD").
// Returns { bars, meta } or { error }. Matches the old Binance fetcher contract.
// `limit` is accepted for signature compatibility; Kraken caps OHLC at ~720.
export async function fetch4hBars(pair, limit = 720) {
  try {
    const { rows, httpError } = await fetchKrakenOhlc(pair, 240);
    if (httpError) return { error: httpError };
    if (!Array.isArray(rows) || rows.length === 0) {
      return { error: { status: 200, reason: 'empty result' } };
    }

    const { bars, volSum } = rowsToBars(rows);

    if (bars.length < 60) {
      return { error: { status: 200, reason: `only ${bars.length} bars (need >=60)` } };
    }

    // Defensive: a dead pair with zero traded volume breaks the volume-ratio
    // math in detection (divide-by-zero / Infinity). Skip it. This is a
    // robustness guard, NOT a liquidity screen — thin-but-trading pairs pass.
    if (volSum <= 0) {
      return { error: { status: 200, reason: 'zero volume across all bars' } };
    }

    return { bars, meta: { symbol: pair } };
  } catch (e) {
    return { error: { status: 0, reason: e.message } };
  }
}

// Fetch daily bars for a single Kraken pair (used for the BTC market-state check).
export async function fetchDailyBars(pair, limit = 720) {
  try {
    const { rows, httpError } = await fetchKrakenOhlc(pair, 1440);
    if (httpError) return null;
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const { bars } = rowsToBars(rows, { dateOnly: true });
    if (bars.length < 50) return null;

    return { bars, meta: { symbol: pair } };
  } catch (e) {
    return null;
  }
}

// Process universe in throttled batches. Same signature and return shape as the
// old Binance version. Callback receives (asset, barsData, stats).
//
// Default delay is higher than the old Binance 200ms because Kraken's public
// OHLC limit is ~1-2 req/sec. Transient throttles surface as failures and are
// skipped, exactly like missing pairs were before. Lower delayMs if scans feel
// slow and you aren't seeing rate-limit failures pile up.
export async function processCryptoUniverse(assets, callback, options = {}) {
  const { delayMs = 500, progressEvery = 25 } = options;
  const results = [];
  const failures = [];
  const stats = { fetched: 0, failed: 0, qualified: 0 };

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const data = await fetch4hBars(asset.binanceSymbol);

    if (!data || data.error) {
      stats.failed++;
      const errInfo = data?.error || { status: 0, reason: 'no data' };
      failures.push({
        symbol: asset.binanceSymbol,
        name: asset.name,
        status: errInfo.status,
        reason: errInfo.reason,
      });
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

  // Dump the failure list so missing/throttled pairs are visible.
  if (failures.length > 0) {
    console.log('');
    console.log(`⚠️ ${failures.length} pair fetch failures (skipped this run):`);
    for (const f of failures.slice(0, 60)) {
      console.log(`   ${String(f.symbol).padEnd(12)} HTTP ${f.status}  ${String(f.name).padEnd(18)} ${String(f.reason).slice(0, 50)}`);
    }
    if (failures.length > 60) console.log(`   …and ${failures.length - 60} more`);
    console.log('');
  }

  return { results, stats, failures };
}
