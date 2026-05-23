// Fetches S&P 1500 constituents (500 + 400 + 600) from Wikipedia
// Falls back to cached list if Wikipedia structure changes or scrape fails

import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const SOURCES = [
  { url: 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies', name: 'S&P 500', minExpected: 450 },
  { url: 'https://en.wikipedia.org/wiki/List_of_S%26P_400_companies', name: 'S&P 400', minExpected: 350 },
  { url: 'https://en.wikipedia.org/wiki/List_of_S%26P_600_companies', name: 'S&P 600', minExpected: 500 },
];

const FALLBACK_PATH = path.join(process.cwd(), 'public', 'universe-fallback.json');

// Yahoo uses '-' instead of '.' in ticker symbols (e.g. BRK-B not BRK.B)
function normalizeTicker(ticker) {
  return ticker.replace(/\./g, '-').trim().toUpperCase();
}

async function fetchSource(source) {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BFF/1.0)' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${source.name}: HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const tickers = [];

  $('#constituents tbody tr').each((i, el) => {
    if (i === 0) return; // skip header
    const ticker = $(el).find('td').eq(0).text();
    if (ticker) {
      const normalized = normalizeTicker(ticker);
      if (normalized && /^[A-Z0-9\-]{1,8}$/.test(normalized)) {
        tickers.push(normalized);
      }
    }
  });

  if (tickers.length < source.minExpected) {
    throw new Error(
      `${source.name} returned only ${tickers.length} tickers (expected at least ${source.minExpected}). ` +
      `Wikipedia layout may have changed.`
    );
  }

  return tickers;
}

function loadFallback() {
  try {
    const data = JSON.parse(fs.readFileSync(FALLBACK_PATH, 'utf8'));
    if (Array.isArray(data) && data.length > 1000) {
      console.log(`📦 Loaded fallback universe: ${data.length} tickers (cached from ${fs.statSync(FALLBACK_PATH).mtime.toISOString().split('T')[0]})`);
      return data;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function saveFallback(tickers) {
  try {
    fs.writeFileSync(FALLBACK_PATH, JSON.stringify(tickers, null, 2));
  } catch (e) {
    console.warn(`⚠️ Could not save fallback universe: ${e.message}`);
  }
}

export async function getUniverse() {
  const allTickers = new Set();
  const errors = [];

  for (const source of SOURCES) {
    try {
      console.log(`📡 Fetching ${source.name}...`);
      const tickers = await fetchSource(source);
      console.log(`   ${tickers.length} tickers from ${source.name}`);
      tickers.forEach(t => allTickers.add(t));
    } catch (e) {
      console.error(`❌ ${source.name}: ${e.message}`);
      errors.push(`${source.name}: ${e.message}`);
    }
  }

  const result = [...allTickers].sort();

  // If we got at least 80% of expected ~1500, save as new fallback
  if (result.length >= 1200) {
    console.log(`✅ Universe: ${result.length} unique tickers`);
    saveFallback(result);
    return result;
  }

  // Otherwise, try fallback
  console.warn(`⚠️ Only got ${result.length} tickers from live sources (errors: ${errors.length})`);
  const fallback = loadFallback();
  if (fallback) {
    return fallback;
  }

  throw new Error(`Universe fetch failed and no fallback available. Errors: ${errors.join('; ')}`);
}
