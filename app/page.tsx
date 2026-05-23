import fs from 'fs';
import path from 'path';
import Header from '@/components/Header';
import CandidateCard from '@/components/CandidateCard';
import { BFFLogoLarge, Divider, EmptyFlag } from '@/components/ASCIIFlair';
import ScannerControls from './ScannerControls';

export const dynamic = 'force-static';

type ScanData = {
  schemaVersion: number;
  scanDate: string;
  timestamp: string;
  durationSec: number;
  market: {
    vix: number | null;
    vixHostile: boolean;
    spyPrice: number | null;
    spy50ma: number | null;
    spyAbove50ma: boolean;
  };
  stats: {
    universeSize: number;
    fetched: number;
    failed: number;
    qualified: number;
  };
  flagCandidates: any[];
  fiftyTwoWeekCandidates: any[];
};

function loadLatestScan(): ScanData | null {
  try {
    const p = path.join(process.cwd(), 'public', 'latest.json');
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

// Format an ISO timestamp as "YYYY-MM-DD HH:MM ET"
// Uses America/New_York since US markets are the universe.
function formatScanTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD
    const time = d.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${date} ${time} ET`;
  } catch {
    return iso;
  }
}

export default function Home() {
  const data = loadLatestScan();

  if (!data) {
    return <NoData />;
  }

  const stageCounts = data.flagCandidates.reduce<Record<string, number>>((acc, c) => {
    acc[c.stage] = (acc[c.stage] || 0) + 1;
    return acc;
  }, {});

  const prime = stageCounts.prime || 0;
  const forming = stageCounts.forming || 0;
  const early = stageCounts.early || 0;
  const late = stageCounts.late || 0;
  const total = data.flagCandidates.length;

  // Detect placeholder data (epoch timestamp means no real scan has run yet)
  const isPlaceholder = data.scanDate === '1970-01-01';
  const lastScanLabel = isPlaceholder
    ? 'awaiting first scan'
    : `last scan · ${formatScanTime(data.timestamp)} · ${total} candidates`;

  return (
    <>
      <Header subtitle={lastScanLabel} />

      <main className="max-w-5xl mx-auto px-4 py-6 relative z-10">
        {/* Hero */}
        <section className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div>
              <BFFLogoLarge />
              <p className="text-text-muted text-xs mt-2 font-mono">
                bull flag finder · daily scan of the S&P 1500
              </p>
            </div>
          </div>
        </section>

        {/* Market regime banner */}
        <section className="mb-6">
          <MarketBanner data={data} />
        </section>

        {/* Stage summary */}
        <Divider label="today" />

        <section className="mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StageStat emoji="🎯" label="Prime" count={prime} color="text-terminal-green glow-sm" highlight />
            <StageStat emoji="🔨" label="Forming" count={forming} color="text-terminal-blue" />
            <StageStat emoji="🌱" label="Early" count={early} color="text-terminal-gray" />
            <StageStat emoji="⏰" label="Late" count={late} color="text-terminal-amber" />
          </div>
        </section>

        {/* Candidates */}
        <Divider label="candidates" />

        {total === 0 ? (
          <EmptyFlag />
        ) : (
          <ScannerControls candidates={data.flagCandidates} />
        )}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-terminal-gray-dim/30 text-center">
          <p className="text-text-muted text-[10px] font-mono">
            ▲ set the limit. walk away. ▲
          </p>
          <p className="text-text-muted text-[10px] font-mono mt-2 opacity-60">
            scanned {data.stats.fetched.toLocaleString()} tickers in {data.durationSec}s ·{' '}
            <a href={`/scans/${data.scanDate}.json`} className="hover:text-terminal-green underline">
              raw json
            </a>
          </p>
        </footer>
      </main>
    </>
  );
}

function NoData() {
  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-12 text-center">
        <BFFLogoLarge />
        <div className="mt-8 space-y-3">
          <p className="text-text">
            <span className="cursor-blink">waiting for first scan</span>
          </p>
          <p className="text-text-muted text-sm font-mono">
            the daily scan runs at 22:30 UTC on weekdays
          </p>
          <p className="text-text-muted text-xs font-mono opacity-60">
            you can trigger it manually from the actions tab in the repo
          </p>
        </div>
      </main>
    </>
  );
}

function MarketBanner({ data }: { data: ScanData }) {
  const { market } = data;
  const bullish = market.spyAbove50ma;
  const vixHostile = market.vixHostile;
  const hasData = market.spyPrice != null;

  // Placeholder state — no scan has run yet
  if (!hasData) {
    return (
      <div className="bg-bg-card border border-terminal-gray-dim/40 rounded-sm p-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-text-muted">SPY </span>
            <span className="text-text-muted tabular-nums">—</span>
          </div>
          <div>
            <span className="text-text-muted">VIX </span>
            <span className="text-text-muted tabular-nums">—</span>
          </div>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
          regime: unknown
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-terminal-gray-dim/40 rounded-sm p-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-4 text-xs font-mono">
        <div>
          <span className="text-text-muted">SPY </span>
          <span className="text-text tabular-nums">${market.spyPrice?.toFixed(2) ?? '—'}</span>
          <span className={`ml-1 ${bullish ? 'text-terminal-green' : 'text-terminal-red'}`}>
            {bullish ? '↗' : '↘'}
          </span>
        </div>
        <div>
          <span className="text-text-muted">VIX </span>
          <span className={`tabular-nums ${vixHostile ? 'text-terminal-red glow-sm' : 'text-text'}`}>
            {market.vix?.toFixed(2) ?? '—'}
          </span>
        </div>
      </div>
      <div className={`text-[10px] font-mono uppercase tracking-widest ${
        bullish && !vixHostile ? 'text-terminal-green' : vixHostile ? 'text-terminal-red' : 'text-terminal-amber'
      }`}>
        {vixHostile && '⚠ vix hostile · '}
        {bullish ? 'regime: bull' : 'regime: bear'}
      </div>
    </div>
  );
}

function StageStat({
  emoji,
  label,
  count,
  color,
  highlight = false,
}: {
  emoji: string;
  label: string;
  count: number;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-bg-card border ${highlight && count > 0 ? 'border-terminal-green' : 'border-terminal-gray-dim/40'} rounded-sm p-3`}>
      <div className="flex items-center gap-2">
        <span className="text-base">{emoji}</span>
        <span className="text-text-muted text-[10px] font-mono uppercase tracking-widest">{label}</span>
      </div>
      <div className={`font-display text-3xl ${color} tabular-nums leading-none mt-1`}>{count}</div>
    </div>
  );
}
