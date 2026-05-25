import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { Divider, EmptyFlag } from '@/components/ASCIIFlair';
import BackToTop from '@/components/BackToTop';
import CryptoRegimeBanner from '@/components/CryptoRegimeBanner';
import AssetToggle from '@/components/AssetToggle';
import CryptoScanner from './CryptoScanner';
import MajorCard from '@/components/MajorCard';
import { BFFLogoLargeOrange } from '@/components/ASCIIFlairOrange';

export const dynamic = 'force-static';

type UniverseEntry = {
  symbol: string;
  name: string;
  binanceSymbol: string;
  rank: number | null;
  marketCap: number;
  scanned: boolean;
};

type CryptoScan = {
  schemaVersion: number;
  scanDate: string;
  scanHourUtc: string;
  timestamp: string;
  durationSec: number;
  regime: any;
  stats: {
    universeSize: number;
    fetched: number;
    failed: number;
    qualified: number;
  };
  universe?: UniverseEntry[];
  majors?: any[];
  candidates: any[];
};

function loadLatestCryptoScan(): CryptoScan | null {
  try {
    const p = path.join(process.cwd(), 'public', 'latest-crypto.json');
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function formatScanTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-CA', { timeZone: 'UTC' });
    const time = d.toLocaleTimeString('en-US', {
      timeZone: 'UTC',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${date} ${time} UTC`;
  } catch {
    return iso;
  }
}

export default function CryptoHome() {
  const data = loadLatestCryptoScan();

  if (!data) {
    return <NoCryptoData />;
  }

  const total = data.candidates.length;
  const lastScanLabel = `last scan · ${formatScanTime(data.timestamp)} · ${total} flag${total === 1 ? '' : 's'}`;

  const btcBelow = data.regime?.btc?.above === false;
  const emptyMessage = btcBelow
    ? 'no flags in this run. BTC is below its 50-EMA — alt flags are unlikely until the macro trend turns. check back in a day or two.'
    : "no flags this run. the gates are tight by design — flat or noisy market conditions produce zero. wait for a real move.";

  const scannedUniverse = data.universe?.filter((u) => u.scanned) ?? [];
  const majors = data.majors ?? [];

  return (
    <>
      <main className="max-w-5xl mx-auto px-4 py-6 relative z-10">
        {/* Logo header + about link */}
        <section className="mb-3 relative">
          <Link
            href="/about"
            aria-label="about"
            className="absolute top-0 right-0 px-2 py-1 text-text-dim hover:text-crypto-orange transition text-[11px] font-mono uppercase tracking-wider"
          >
            about
          </Link>
          <BFFLogoLargeOrange />
          <p className="text-text-muted text-xs mt-2 font-mono">
            bull flag finder · crypto · scanned every 4 hours on 4h bars
          </p>
          <p className="text-crypto-orange text-xs mt-1 font-mono">
            60% of the time, it works every time.
          </p>
        </section>

        {/* Asset toggle */}
        <section className="mb-4">
          <AssetToggle mode="crypto" />
        </section>

        {/* Regime banner */}
        <section className="mb-2">
          <CryptoRegimeBanner regime={data.regime} />
        </section>

        {/* Last scan */}
        <section className="mb-6">
          <div className="text-text-muted text-[10px] font-mono">{lastScanLabel}</div>
        </section>

        {/* Persistent BTC/ETH cards */}
        {majors.length > 0 && (
          <section className="mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {majors.map((m: any) => (
                <MajorCard key={m.binanceSymbol} major={m} />
              ))}
            </div>
            <p className="text-text-muted text-[10px] font-mono mt-2 italic">
              persistent reference · scanned with looser gates (pole 7-40% · pullback ≤50% of pole)
            </p>
          </section>
        )}

        {/* Today's flags divider — primary scan output */}
        <Divider label="today's flags" accent="orange" />

        <section className="mb-6">
          <SectionStat count={total} />
        </section>

        {total === 0 ? (
          <EmptyFlag message={emptyMessage} />
        ) : (
          <CryptoScanner candidates={data.candidates} />
        )}

        {/* Watchlist — reference material, lives below the actual scan output */}
        {scannedUniverse.length > 0 && (
          <section className="mt-8 mb-6">
            <ScanningUniverse universe={scannedUniverse} />
          </section>
        )}

        <footer className="mt-12 pt-6 border-t border-terminal-gray-dim/30 text-center">
          <p className="text-text-muted text-[10px] font-mono">
            ▲ pattern + structure · sizing is your job ▲
          </p>
          <p className="text-text-muted text-[10px] font-mono mt-2 opacity-60">
            scanned {data.stats.fetched} assets in {data.durationSec}s ·{' '}
            <a
              href={`/scans-crypto/${data.scanDate}-${data.scanHourUtc}.json`}
              className="hover:text-crypto-orange underline"
            >
              raw json
            </a>
          </p>
        </footer>
      </main>

      <BackToTop />
    </>
  );
}

function NoCryptoData() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 text-center">
      <section className="relative">
        <Link
          href="/about"
          aria-label="about"
          className="absolute top-0 right-0 px-2 py-1 text-text-dim hover:text-crypto-orange transition text-[11px] font-mono uppercase tracking-wider"
        >
          about
        </Link>
        <BFFLogoLargeOrange />
      </section>
      <div className="mt-6 mb-6">
        <AssetToggle mode="crypto" />
      </div>
      <div className="mt-8 space-y-3">
        <p className="text-text">
          <span className="cursor-blink">waiting for first crypto scan</span>
        </p>
        <p className="text-text-muted text-sm font-mono">
          the crypto scan runs every 4 hours, 7 days a week
        </p>
      </div>
    </main>
  );
}

function SectionStat({ count }: { count: number }) {
  return (
    <div
      className={`bg-bg-card border ${
        count > 0 ? 'border-crypto-orange/50' : 'border-terminal-gray-dim/40'
      } rounded-sm p-3`}
    >
      <div className="flex items-center gap-2">
        <span className="text-base">₿</span>
        <div>
          <div className="text-text text-[11px] font-mono uppercase tracking-widest">
            Today's Flags
          </div>
          <div className="text-text-muted text-[9px] font-mono uppercase tracking-widest">
            scanner output · 4h
          </div>
        </div>
      </div>
      <div className="flex items-baseline gap-2 mt-2">
        <span
          className={`font-display text-3xl tabular-nums leading-none ${
            count > 0 ? 'text-crypto-orange glow-sm' : 'text-text-muted'
          }`}
        >
          {count}
        </span>
        <span className="text-text-muted text-[10px] font-mono uppercase tracking-widest">
          flag{count === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
}

function ScanningUniverse({ universe }: { universe: UniverseEntry[] }) {
  return (
    <details className="bg-bg-card border border-terminal-gray-dim/40 rounded-sm">
      <summary className="px-3 py-2 cursor-pointer hover:bg-bg-elevated transition list-none">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-text-muted text-[10px] font-mono uppercase tracking-widest">
            watchlist · {universe.length} assets
          </div>
          <div className="text-crypto-orange-dim text-[10px] font-mono">tap for full list →</div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {universe.map((u) => (
            <span
              key={u.binanceSymbol}
              className="px-1.5 py-0.5 text-[10px] font-mono bg-bg-elevated text-text-dim border border-terminal-gray-dim/40 rounded-sm"
            >
              {u.symbol}
            </span>
          ))}
        </div>
      </summary>
      <div className="px-3 pb-3 pt-1 border-t border-terminal-gray-dim/30">
        <div className="text-text-muted text-[10px] font-mono mb-2 mt-2">
          full watchlist (by market cap rank)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
          {[...universe]
            .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
            .map((u) => (
              <div
                key={u.binanceSymbol}
                className="flex items-center gap-2 text-text-dim"
              >
                <span className="tabular-nums text-text-muted shrink-0">#{u.rank ?? '—'}</span>
                <span className="text-text">{u.symbol}</span>
                <span className="text-text-muted truncate">{u.name}</span>
              </div>
            ))}
        </div>
        <div className="mt-3 pt-3 border-t border-terminal-gray-dim/30 text-text-muted text-[9px] font-mono leading-relaxed">
          large-cap crypto by market cap, scanned on binance.us with 4h bars.
          BTC and ETH are tracked separately at top of page with looser gates.
          excludes stablecoins, wrapped/staked tokens, exchange utility tokens,
          and assets not listed on a us-accessible exchange.
        </div>
      </div>
    </details>
  );
}
