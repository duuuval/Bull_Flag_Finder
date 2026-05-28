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
    state?: 'strong' | 'mixed' | 'weak';
    vix: number | null;
    vixHostile: boolean;
    vixElevated?: boolean;
    spyPrice: number | null;
    spy50ma: number | null;
    spyAbove50ma: boolean;
    spy50maRising?: boolean | null;
    spy50maSlopePct?: number | null;
  };
  stats: {
    universeSize: number;
    fetched: number;
    failed: number;
    qualified: number;
    htfCount?: number;
    continuationCount?: number;
    firstStageCount?: number;
  };
  htfCandidates?: any[];
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

  // Support new schema (split lists incl. htf) and old schema (single list)
  const htf =
    data.htfCandidates ??
    data.flagCandidates.filter((c: any) => c.setupType === 'htf');
  const continuation =
    data.continuationCandidates ??
    data.flagCandidates.filter((c: any) => c.setupType === 'continuation' || (c.setupType !== 'first-stage' && c.setupType !== 'htf'));
  const firstStage =
    data.firstStageCandidates ??
    data.flagCandidates.filter((c: any) => c.setupType === 'first-stage');
  const total = htf.length + continuation.length + firstStage.length;

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

        {/* Recent trend · SPY / VIX */}
        <section className="mb-2">
          <MarketBanner data={data} />
        </section>

        {/* Last scan + candidate count */}
        <section className="mb-6">
          <div className="text-text-muted text-[10px] font-mono">{lastScanLabel}</div>
        </section>

        <Divider label="today" />

        <section className="mb-6">
          {/* HTF count only renders when there's at least one — these are rare by design */}
          <div className={`grid ${htf.length > 0 ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
            {htf.length > 0 && (
              <SectionStat
                emoji="⭐"
                label="HTF"
                sublabel="high-tight flags"
                count={htf.length}
                color="text-terminal-amber glow-sm"
                highlight={true}
              />
            )}
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
            htf={htf}
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
  const hasData = market.spyPrice != null;

  if (!hasData) {
    return (
      <div className="bg-bg-card border border-terminal-gray-dim/40 rounded-sm p-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 text-xs font-mono">
          <div><span className="text-text-muted">SPY </span><span className="text-text-muted tabular-nums">—</span></div>
          <div><span className="text-text-muted">VIX </span><span className="text-text-muted tabular-nums">—</span></div>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted">recent trend · unknown</div>
      </div>
    );
  }

  const state: 'strong' | 'mixed' | 'weak' =
    market.state ??
    (market.spyAbove50ma && !market.vixHostile
      ? 'strong'
      : !market.spyAbove50ma
        ? 'weak'
        : 'mixed');

  const stateDisplay = {
    strong: {
      label: 'STRONG',
      color: 'text-terminal-green',
      border: 'border-terminal-green/40',
      symbol: '▲',
    },
    mixed: {
      label: 'MIXED',
      color: 'text-terminal-amber',
      border: 'border-terminal-amber/40',
      symbol: '◆',
    },
    weak: {
      label: 'WEAK',
      color: 'text-terminal-red',
      border: 'border-terminal-red/40',
      symbol: '▼',
    },
  }[state];

  const vixElevated = market.vixElevated ?? market.vixHostile;
  const slopeText =
    market.spy50maRising === true
      ? 'rising'
      : market.spy50maRising === false
        ? 'falling'
        : null;

  const subline = {
    strong:
      'SPY is above its 50-day average, and that average is rising. volatility is calm.',
    mixed: vixElevated
      ? 'SPY and its 50-day average are sending mixed signals, or VIX is elevated. expect more whipsaws — flags can still form, you decide which to act on.'
      : 'SPY and its 50-day average are sending mixed signals. expect more whipsaws — flags can still form, you decide which to act on.',
    weak:
      'SPY is below its 50-day average, and that average is falling. flags can still form but tend to fail more often in this kind of market.',
  }[state];

  return (
    <div className={`bg-bg-card border ${stateDisplay.border} rounded-sm p-3`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-text-muted">SPY </span>
            <span className="text-text tabular-nums">${market.spyPrice?.toFixed(2) ?? '—'}</span>
            <span className={`ml-1 ${market.spyAbove50ma ? 'text-terminal-green' : 'text-terminal-red'}`}>{market.spyAbove50ma ? '↗' : '↘'}</span>
            {slopeText && (
              <span className="ml-1 text-[10px] text-text-muted">
                (50-EMA {slopeText})
              </span>
            )}
          </div>
          <div>
            <span className="text-text-muted">VIX </span>
            <span className={`tabular-nums ${vixElevated ? 'text-terminal-red glow-sm' : 'text-text'}`}>{market.vix?.toFixed(2) ?? '—'}</span>
            {vixElevated && <span className="ml-1 text-[10px] text-terminal-red">elevated</span>}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-text-muted text-[9px] font-mono uppercase tracking-widest">
            recent trend
          </span>
          <span className={`text-[11px] font-mono uppercase tracking-widest ${stateDisplay.color}`}>
            {stateDisplay.symbol} {stateDisplay.label}
          </span>
        </div>
      </div>

      <div className="text-[10px] font-mono text-text-muted pt-2 mt-2 border-t border-terminal-gray-dim/30">
        {subline}
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
