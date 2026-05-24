import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { BFFLogoLarge, Divider, EmptyFlag } from '@/components/ASCIIFlair';
import TwoSectionScanner from './TwoSectionScanner';
import BackToTop from '@/components/BackToTop';
import AssetToggle from '@/components/AssetToggle';

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
    continuationCount?: number;
    firstStageCount?: number;
  };
  continuationCandidates?: any[];
  firstStageCandidates?: any[];
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

function formatScanTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
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

  // Support both new schema (split lists) and old schema (single list)
  const continuation = data.continuationCandidates ?? data.flagCandidates.filter((c: any) => c.setupType !== 'first-stage');
  const firstStage = data.firstStageCandidates ?? data.flagCandidates.filter((c: any) => c.setupType === 'first-stage');
  const total = continuation.length + firstStage.length;

  const isPlaceholder = data.scanDate === '1970-01-01';
  const lastScanLabel = isPlaceholder
    ? 'awaiting first scan'
    : `last scan · ${formatScanTime(data.timestamp)} · ${total} candidates`;

  return (
    <>
      <main className="max-w-5xl mx-auto px-4 py-6 relative z-10">
        {/* Logo header — ASCII is the header. About link sits top-right. */}
        <section className="mb-3 relative">
          <Link
            href="/about"
            aria-label="about"
            className="absolute top-0 right-0 px-2 py-1 text-text-dim hover:text-terminal-green transition text-[11px] font-mono uppercase tracking-wider"
          >
            about
          </Link>
          <BFFLogoLarge />
          <p className="text-text-muted text-xs mt-2 font-mono">
            bull flag finder · daily scan of the S&amp;P 1500
          </p>
          <p className="text-terminal-green text-xs mt-1 font-mono">
            60% of the time, it works every time.
          </p>
        </section>

        {/* Asset toggle */}
        <section className="mb-4">
          <AssetToggle mode="stocks" />
        </section>

        {/* SPY / VIX / regime */}
        <section className="mb-2">
          <MarketBanner data={data} />
        </section>

        {/* Last scan + candidate count — relocated here so freshness is visible without the old header */}
        <section className="mb-6">
          <div className="text-text-muted text-[10px] font-mono">{lastScanLabel}</div>
        </section>

        <Divider label="today" />

        <section className="mb-6">
          <div className="grid grid-cols-2 gap-2">
            <SectionStat
              emoji="💪"
              label="Strength"
              sublabel="continuation"
              count={continuation.length}
              color="text-terminal-green glow-sm"
              highlight={continuation.length > 0}
            />
            <SectionStat
              emoji="🌱"
              label="Base Breakouts"
              sublabel="first-stage"
              count={firstStage.length}
              color="text-terminal-blue glow-sm"
              highlight={firstStage.length > 0}
            />
          </div>
        </section>

        {total === 0 ? (
          <EmptyFlag />
        ) : (
          <TwoSectionScanner
            continuation={continuation}
            firstStage={firstStage}
          />
        )}

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

      <BackToTop />
    </>
  );
}

function NoData() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 text-center">
      <section className="relative">
        <Link
          href="/about"
          aria-label="about"
          className="absolute top-0 right-0 px-2 py-1 text-text-dim hover:text-terminal-green transition text-[11px] font-mono uppercase tracking-wider"
        >
          about
        </Link>
        <BFFLogoLarge />
      </section>
      <div className="mt-6 mb-6">
        <AssetToggle mode="stocks" />
      </div>
      <div className="mt-8 space-y-3">
        <p className="text-text">
          <span className="cursor-blink">waiting for first scan</span>
        </p>
        <p className="text-text-muted text-sm font-mono">
          the daily scan runs at 22:30 UTC on weekdays
        </p>
      </div>
    </main>
  );
}

function MarketBanner({ data }: { data: ScanData }) {
  const { market } = data;
  const bullish = market.spyAbove50ma;
  const vixHostile = market.vixHostile;
  const hasData = market.spyPrice != null;

  if (!hasData) {
    return (
      <div className="bg-bg-card border border-terminal-gray-dim/40 rounded-sm p-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 text-xs font-mono">
          <div><span className="text-text-muted">SPY </span><span className="text-text-muted tabular-nums">—</span></div>
          <div><span className="text-text-muted">VIX </span><span className="text-text-muted tabular-nums">—</span></div>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted">regime: unknown</div>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-terminal-gray-dim/40 rounded-sm p-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-4 text-xs font-mono">
        <div>
          <span className="text-text-muted">SPY </span>
          <span className="text-text tabular-nums">${market.spyPrice?.toFixed(2) ?? '—'}</span>
          <span className={`ml-1 ${bullish ? 'text-terminal-green' : 'text-terminal-red'}`}>{bullish ? '↗' : '↘'}</span>
        </div>
        <div>
          <span className="text-text-muted">VIX </span>
          <span className={`tabular-nums ${vixHostile ? 'text-terminal-red glow-sm' : 'text-text'}`}>{market.vix?.toFixed(2) ?? '—'}</span>
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

function SectionStat({
  emoji, label, sublabel, count, color, highlight = false,
}: {
  emoji: string; label: string; sublabel: string; count: number; color: string; highlight?: boolean;
}) {
  return (
    <div className={`bg-bg-card border ${highlight ? 'border-terminal-green/50' : 'border-terminal-gray-dim/40'} rounded-sm p-3`}>
      <div className="flex items-center gap-2">
        <span className="text-base">{emoji}</span>
        <div>
          <div className="text-text text-[11px] font-mono uppercase tracking-widest">{label}</div>
          <div className="text-text-muted text-[9px] font-mono uppercase tracking-widest">{sublabel}</div>
        </div>
      </div>
      <div className="flex items-baseline gap-2 mt-2">
        <span className={`font-display text-3xl ${color} tabular-nums leading-none`}>{count}</span>
        <span className="text-text-muted text-[10px] font-mono uppercase tracking-widest">bull flags</span>
      </div>
    </div>
  );
}
