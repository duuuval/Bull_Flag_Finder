'use client';

import { useState, useEffect } from 'react';
import TwoSectionScanner from '../TwoSectionScanner';

type ScanData = {
  schemaVersion?: number;
  scanDate?: string;
  timestamp?: string;
  durationSec?: number;
  market?: {
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
  stats?: {
    universeSize?: number;
    fetched?: number;
    failed?: number;
    qualified?: number;
    htfCount?: number;
    continuationCount?: number;
    firstStageCount?: number;
  };
  htfCandidates?: any[];
  continuationCandidates?: any[];
  firstStageCandidates?: any[];
  flagCandidates?: any[];
  fiftyTwoWeekCandidates?: any[];
};

function formatScanTime(iso?: string): string {
  if (!iso) return '—';
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

export default function ArchiveBrowser({ dates }: { dates: string[] }) {
  const [selected, setSelected] = useState<string>(dates[0] ?? '');
  const [data, setData] = useState<ScanData | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setStatus('loading');
    setData(null);

    fetch(`/scans/${selected}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((json: ScanData) => {
        if (!cancelled) {
          setData(json);
          setStatus('idle');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (dates.length === 0) {
    return (
      <div className="bg-bg-card border border-terminal-gray-dim/40 rounded-sm p-6 text-center">
        <p className="text-text-muted text-sm font-mono">
          no archived scans found in <span className="text-text">public/scans/</span>
        </p>
      </div>
    );
  }

  const idx = dates.indexOf(selected);
  const newer = idx > 0 ? dates[idx - 1] : null; // dates sorted desc → newer is lower index
  const older = idx >= 0 && idx < dates.length - 1 ? dates[idx + 1] : null;

  // Same old/new schema reconciliation the homepage uses.
  const htf =
    data?.htfCandidates ??
    (data?.flagCandidates ?? []).filter((c: any) => c.setupType === 'htf');
  const continuation =
    data?.continuationCandidates ??
    (data?.flagCandidates ?? []).filter(
      (c: any) =>
        c.setupType === 'continuation' ||
        (c.setupType !== 'first-stage' && c.setupType !== 'htf')
    );
  const firstStage =
    data?.firstStageCandidates ??
    (data?.flagCandidates ?? []).filter((c: any) => c.setupType === 'first-stage');
  const total = htf.length + continuation.length + firstStage.length;

  // Guard against scan files written before the current card schema.
  // The card hard-depends on a `pattern` object; bail to a notice instead of crashing.
  const firstCandidate = htf[0] ?? continuation[0] ?? firstStage[0] ?? null;
  const malformed = total > 0 && firstCandidate && !firstCandidate.pattern;

  return (
    <>
      {/* Date selector */}
      <section className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => newer && setSelected(newer)}
            disabled={!newer}
            className="px-2 py-1 rounded-sm border border-terminal-gray-dim/40 bg-bg-card text-text-muted text-xs font-mono disabled:opacity-30 hover:text-terminal-green transition"
            aria-label="newer scan"
          >
            ‹ newer
          </button>

          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="px-2 py-1 rounded-sm border border-terminal-gray-dim/40 bg-bg-card text-text text-xs font-mono tabular-nums focus:outline-none focus:border-terminal-green/50"
          >
            {dates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <button
            onClick={() => older && setSelected(older)}
            disabled={!older}
            className="px-2 py-1 rounded-sm border border-terminal-gray-dim/40 bg-bg-card text-text-muted text-xs font-mono disabled:opacity-30 hover:text-terminal-green transition"
            aria-label="older scan"
          >
            older ›
          </button>

          <span className="text-text-muted text-[10px] font-mono ml-1">
            {idx + 1} of {dates.length}
          </span>
        </div>
      </section>

      {status === 'loading' && (
        <div className="text-text-muted text-sm font-mono py-8 text-center">
          <span className="cursor-blink">loading {selected}</span>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-bg-card border border-terminal-red/40 rounded-sm p-4 text-center">
          <p className="text-terminal-red text-sm font-mono">
            could not load /scans/{selected}.json
          </p>
        </div>
      )}

      {status === 'idle' && data && (
        <>
          {/* Recent trend for that scan */}
          <section className="mb-2">
            <MarketBanner data={data} />
          </section>

          <section className="mb-6">
            <div className="text-text-muted text-[10px] font-mono">
              scan · {formatScanTime(data.timestamp)} · {total} candidates
            </div>
          </section>

          <section className="mb-6">
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

          {malformed ? (
            <div className="bg-bg-card border border-terminal-amber/40 rounded-sm p-4 text-center">
              <p className="text-terminal-amber text-sm font-mono">
                this scan predates the current card format
              </p>
              <p className="text-text-muted text-[10px] font-mono mt-2">
                the raw data is still available below
              </p>
            </div>
          ) : total === 0 ? (
            <div className="bg-bg-card border border-terminal-gray-dim/40 rounded-sm p-6 text-center">
              <p className="text-text-muted text-sm font-mono">no flags on this scan</p>
            </div>
          ) : (
            <TwoSectionScanner htf={htf} continuation={continuation} firstStage={firstStage} />
          )}

          <footer className="mt-12 pt-6 border-t border-terminal-gray-dim/30 text-center">
            <p className="text-text-muted text-[10px] font-mono opacity-60">
              <a
                href={`/scans/${selected}.json`}
                className="hover:text-terminal-green underline"
              >
                raw json
              </a>
            </p>
          </footer>
        </>
      )}
    </>
  );
}

/* ---- copied verbatim from app/page.tsx so the archive matches the homepage banner ---- */

function MarketBanner({ data }: { data: ScanData }) {
  const market = data.market;
  const hasData = market?.spyPrice != null;

  if (!market || !hasData) {
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
          recent trend · unknown
        </div>
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
    strong: { label: 'STRONG', color: 'text-terminal-green', border: 'border-terminal-green/40', symbol: '▲' },
    mixed: { label: 'MIXED', color: 'text-terminal-amber', border: 'border-terminal-amber/40', symbol: '◆' },
    weak: { label: 'WEAK', color: 'text-terminal-red', border: 'border-terminal-red/40', symbol: '▼' },
  }[state];

  const vixElevated = market.vixElevated ?? market.vixHostile;
  const slopeText =
    market.spy50maRising === true
      ? 'rising'
      : market.spy50maRising === false
        ? 'falling'
        : null;

  const subline = {
    strong: 'SPY is above its 50-day average, and that average is rising. volatility is calm.',
    mixed: vixElevated
      ? 'SPY and its 50-day average are sending mixed signals, or VIX is elevated. expect more whipsaws — flags can still form, you decide which to act on.'
      : 'SPY and its 50-day average are sending mixed signals. expect more whipsaws — flags can still form, you decide which to act on.',
    weak: 'SPY is below its 50-day average, and that average is falling. flags can still form but tend to fail more often in this kind of market.',
  }[state];

  return (
    <div className={`bg-bg-card border ${stateDisplay.border} rounded-sm p-3`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-text-muted">SPY </span>
            <span className="text-text tabular-nums">${market.spyPrice?.toFixed(2) ?? '—'}</span>
            <span className={`ml-1 ${market.spyAbove50ma ? 'text-terminal-green' : 'text-terminal-red'}`}>
              {market.spyAbove50ma ? '↗' : '↘'}
            </span>
            {slopeText && <span className="ml-1 text-[10px] text-text-muted">(50-EMA {slopeText})</span>}
          </div>
          <div>
            <span className="text-text-muted">VIX </span>
            <span className={`tabular-nums ${vixElevated ? 'text-terminal-red glow-sm' : 'text-text'}`}>
              {market.vix?.toFixed(2) ?? '—'}
            </span>
            {vixElevated && <span className="ml-1 text-[10px] text-terminal-red">elevated</span>}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-text-muted text-[9px] font-mono uppercase tracking-widest">recent trend</span>
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
  emoji,
  label,
  sublabel,
  count,
  color,
  highlight = false,
}: {
  emoji: string;
  label: string;
  sublabel: string;
  count: number;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-bg-card border ${highlight ? 'border-terminal-green/50' : 'border-terminal-gray-dim/40'} rounded-sm p-3`}
    >
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
