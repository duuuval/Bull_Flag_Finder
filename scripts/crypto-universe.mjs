// Builds the crypto scan universe from Kraken's tradeable USD spot pairs,
// then enriches names / images / market caps from CoinGecko (best-effort).
//
// Kraken is the price source (see kraken.mjs): US-accessible, no API key,
// native 4h candles, several hundred USD spot pairs — a far wider universe than
// Binance.US's ~190 coins. The universe is "every ONLINE USD pair that isn't a
// stablecoin / wrapped / staked / fiat / exchange token." There is no liquidity
// pre-screen by design — the detector's own gates decide what's actually moving.
//
// Enrichment is best-effort: if CoinGecko fails, assets still scan with their
// bare Kraken ticker as the name and no icon. That removes CoinGecko as a hard
// dependency (it used to be the source of the universe itself).
//
// NOTE on `binanceSymbol`: kept as the field name for backward compatibility
// with the rest of the pipeline and the frontend cards, but it now holds the
// Kraken pair altname (e.g. "SOLUSD", "XBTUSD") used for OHLC fetches and chart
// URLs. Renaming it would ripple into the UI components, so it stays.

import fs from 'fs';
import path from 'path';

const KRAKEN_ASSETPAIRS_URL = 'https://api.kraken.com/0/public/AssetPairs';
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false';

const FALLBACK_PATH = path.join(process.cwd(), 'public', 'crypto-universe-fallback.json');
const USER_AGENT = 'Mozilla/5.0 (compatible; BFF-Crypto/1.0)';

// Display-symbol exclusions, applied AFTER mapping Kraken codes to clean
// tickers. Easy to extend — just add an uppercase ticker.
const EXCLUDED_SYMBOLS = new Set([
  // Fiat
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF',
  // USD stablecoins
  'USDT', 'USDC', 'DAI', 'USDE', 'FDUSD', 'PYUSD', 'TUSD', 'USDS', 'FRAX',
  'USDP', 'GUSD', 'LUSD', 'USDD', 'BUSD', 'USD1', 'RLUSD', 'USDG', 'USDR',
  'USDQ', 'USTC', 'PUSD',
  // EUR stablecoins
  'EURT', 'EURQ', 'EURR', 'STEUR',
  // Wrapped / staked
  'WBTC', 'TBTC', 'WETH', 'WSTETH', 'STETH', 'RETH', 'CBETH', 'WEETH', 'METH',
  'LSETH', 'WBETH', 'SFRXETH', 'FRXETH', 'MSOL', 'JITOSOL', 'BSOL',
  // Tokenized commodities
  'PAXG', 'XAUT',
  // Exchange utility tokens (trade narrow, don't form clean flags)
  'LEO', 'CRO', 'HT', 'BNB', 'WBT', 'OKB', 'KCS', 'GT', 'BGB',
]);

// Kraken's legacy / WS base codes -> clean display ticker.
const KRAKEN_SYMBOL_MAP = {
  XBT: 'BTC',
  XDG: 'DOGE',
};

// Derive a clean display ticker from a Kraken AssetPairs entry. Prefer wsname
// ("XBT/USD"); fall back to stripping the quote off altname ("XBTUSD").
function cleanSymbol(pair) {
  let base = null;
  if (pair.wsname && pair.wsname.includes('/')) {
    base = pair.wsname.split('/')[0];
  } else if (pair.altname) {
    base = pair.altname.replace(/(USD|ZUSD)$/i, '');
  }
  if (!base) return null;
  base = base.toUpperCase();
  return KRAKEN_SYMBOL_MAP[base] || base;
}

async function fetchKrakenUsdPairs() {
  const res = await fetch(KRAKEN_ASSETPAIRS_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Kraken AssetPairs HTTP ${res.status}`);

  const json = await res.json();
  if (json.error && json.error.length > 0) {
    throw new Error(`Kraken AssetPairs error: ${json.error.join('; ')}`);
  }

  const result = json.result || {};
  const pairs = [];

  for (const key of Object.keys(result)) {
    const p = result[key];
    if (!p || p.status !== 'online') continue;

    const quote = (p.quote || '').toUpperCase();
    if (quote !== 'ZUSD' && quote !== 'USD') continue;   // USD fiat pairs only
    if (p.altname && p.altname.includes('.')) continue;  // skip dark-pool / variants

    const symbol = cleanSymbol(p);
    if (!symbol) continue;
    if (EXCLUDED_SYMBOLS.has(symbol)) continue;

    pairs.push({
      altname: p.altname, // OHLC fetch id + chart symbol
      symbol,             // clean display ticker
    });
  }

  // De-dup by display symbol (Kraken can list more than one USD pair per asset).
  const seen = new Set();
  const deduped = [];
  for (const p of pairs) {
    if (seen.has(p.symbol)) continue;
    seen.add(p.symbol);
    deduped.push(p);
  }

  return deduped;
}

async function fetchCoinGeckoMap() {
  try {
    const res = await fetch(COINGECKO_URL, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('response was not an array');

    const map = new Map();
    for (const c of data) {
      if (!c.symbol) continue;
      const sym = c.symbol.toUpperCase();
      // First occurrence wins. CoinGecko is market-cap ordered, so the largest
      // asset for a ticker is kept — avoids a meme coin shadowing a major.
      if (!map.has(sym)) {
        map.set(sym, {
          id: c.id,
          name: c.name,
          image: c.image || null,
          marketCap: c.market_cap || 0,
          rank: c.market_cap_rank || null,
        });
      }
    }
    return map;
  } catch (e) {
    console.warn(`⚠️ CoinGecko enrichment failed (${e.message}) — using bare Kraken tickers`);
    return new Map();
  }
}

function loadFallback() {
  try {
    const data = JSON.parse(fs.readFileSync(FALLBACK_PATH, 'utf8'));
    if (Array.isArray(data) && data.length > 10) {
      const mtime = fs.statSync(FALLBACK_PATH).mtime.toISOString().split('T')[0];
      console.log(`📦 Loaded fallback crypto universe: ${data.length} assets (cached ${mtime})`);
      return data;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function saveFallback(assets) {
  try {
    fs.writeFileSync(FALLBACK_PATH, JSON.stringify(assets, null, 2));
  } catch (e) {
    console.warn(`⚠️ Could not save crypto fallback universe: ${e.message}`);
  }
}

// Returns array of { id, symbol, name, binanceSymbol, marketCap, rank, image }.
// (binanceSymbol holds the Kraken pair altname — see header note.)
export async function getCryptoUniverse() {
  try {
    console.log('📡 Fetching Kraken USD spot pairs...');
    const [krakenPairs, cgMap] = await Promise.all([
      fetchKrakenUsdPairs(),
      fetchCoinGeckoMap(),
    ]);

    console.log(`   Kraken: ${krakenPairs.length} eligible USD pairs after exclusions`);
    console.log(`   CoinGecko: ${cgMap.size} assets available for name/image enrichment`);

    const assets = krakenPairs.map((p) => {
      const cg = cgMap.get(p.symbol) || null;
      return {
        id: cg?.id || p.altname.toLowerCase(),
        symbol: p.symbol.toLowerCase(),
        name: cg?.name || p.symbol,
        binanceSymbol: p.altname,
        marketCap: cg?.marketCap || 0,
        rank: cg?.rank || null,
        image: cg?.image || null,
      };
    });

    // Scan biggest first so progress logs surface familiar names early. (Output
    // candidates are still sorted by score downstream — this is just scan order.)
    assets.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));

    console.log(`   Universe: ${assets.length} assets`);

    if (assets.length >= 20) {
      saveFallback(assets);
      return assets;
    }

    console.warn(`⚠️ Only ${assets.length} assets after build — falling back to cache`);
  } catch (e) {
    console.error(`❌ Kraken universe fetch failed: ${e.message}`);
  }

  const fallback = loadFallback();
  if (fallback) return fallback;

  throw new Error('Crypto universe fetch failed and no fallback available.');
}
