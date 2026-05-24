// Fetches top crypto by market cap from CoinGecko, applies exclusion list,
// and maps to Binance trading pair symbols.
//
// Falls back to cached list if CoinGecko request fails.
//
// CoinGecko free tier: no API key required, ~10-30 calls/min.
// We make 1 call per scan run (6 scans/day = 6 calls/day).

import fs from 'fs';
import path from 'path';

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false';

const FALLBACK_PATH = path.join(process.cwd(), 'public', 'crypto-universe-fallback.json');

// Coins to exclude regardless of market cap rank.
const EXCLUDED_IDS = new Set([
  // Stablecoins
  'tether', 'usd-coin', 'dai', 'ethena-usde', 'first-digital-usd',
  'paypal-usd', 'true-usd', 'usds', 'frax', 'paxos-standard',
  'gemini-dollar', 'liquity-usd', 'fei-usd', 'usdd', 'binance-usd',
  // Yield-bearing / RWA stablecoins
  'usyc', 'circle-usyc', 'global-dollar', 'usdg',
  'ondo-us-dollar-yield', 'usdy', 'falcon-usd', 'usdf',
  'blackrock-usd-institutional-digital-liquidity-fund', 'buidl',
  // Tokenized commodities
  'tether-gold', 'xaut', 'pax-gold', 'paxg',
  // Wrapped BTC
  'wrapped-bitcoin', 'binance-bitcoin', 'wbtc',
  // Wrapped / staked ETH
  'wrapped-eeth', 'wrapped-steth', 'staked-ether', 'lido-staked-ether',
  'rocket-pool-eth', 'coinbase-wrapped-staked-eth', 'mantle-staked-ether',
  'binance-staked-ether', 'wrapped-beacon-eth', 'frax-ether', 'staked-frax-ether',
  // Wrapped / staked SOL
  'jito-staked-sol', 'binance-staked-sol', 'marinade-staked-sol', 'blazestake-staked-sol',
  // Bridged / wrapped variants
  'wrapped-eth', 'weth', 'wrapped-bnb',
  // Exchange utility tokens (trade narrow, don't form flags)
  'leo-token', 'whitebit', 'cronos', 'htx-dao', 'huobi-token',
  // Known-not-on-binance-us large caps (skip cleanly rather than fail-log them)
  'monero', 'the-open-network', 'bittensor', 'mantle',
  // Speculative oddities that snuck into top 50
  'figure-heloc', 'memecore', 'rain', 'canton-network', 'canton',
]);

// Map CoinGecko symbol -> Binance USDT trading pair.
const BINANCE_SYMBOL_OVERRIDES = {
  // Add overrides here if a token's CoinGecko symbol differs from its Binance symbol
};

function toBinanceSymbol(cgSymbol) {
  const override = BINANCE_SYMBOL_OVERRIDES[cgSymbol];
  if (override) return override;
  return `${cgSymbol.toUpperCase()}USDT`;
}

async function fetchFromCoinGecko() {
  const res = await fetch(COINGECKO_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BFF-Crypto/1.0)' },
  });

  if (!res.ok) {
    throw new Error(`CoinGecko returned HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error('CoinGecko response was not an array');
  }

  return data;
}

function loadFallback() {
  try {
    const data = JSON.parse(fs.readFileSync(FALLBACK_PATH, 'utf8'));
    if (Array.isArray(data) && data.length > 10) {
      const mtime = fs.statSync(FALLBACK_PATH).mtime.toISOString().split('T')[0];
      console.log(`📦 Loaded fallback crypto universe: ${data.length} assets (cached from ${mtime})`);
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

// Returns an array of { id, symbol, name, binanceSymbol, marketCap, rank, image }
export async function getCryptoUniverse() {
  try {
    console.log('📡 Fetching top crypto from CoinGecko...');
    const raw = await fetchFromCoinGecko();
    console.log(`   Received ${raw.length} entries from CoinGecko`);

    const filtered = raw
      .filter(c => !EXCLUDED_IDS.has(c.id))
      .filter(c => c.symbol && c.id && c.name)
      .map(c => ({
        id: c.id,
        symbol: c.symbol.toLowerCase(),
        name: c.name,
        binanceSymbol: toBinanceSymbol(c.symbol),
        marketCap: c.market_cap || 0,
        rank: c.market_cap_rank || null,
        image: c.image || null,
      }));

    console.log(`   Filtered to ${filtered.length} tradeable assets (excluded ${raw.length - filtered.length})`);

    if (filtered.length >= 20) {
      saveFallback(filtered);
      return filtered;
    }

    console.warn(`⚠️ Only ${filtered.length} assets after filtering — falling back to cache`);
  } catch (e) {
    console.error(`❌ CoinGecko fetch failed: ${e.message}`);
  }

  const fallback = loadFallback();
  if (fallback) return fallback;

  throw new Error('Crypto universe fetch failed and no fallback available.');
}
