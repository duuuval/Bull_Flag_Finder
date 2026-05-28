'use client';

import { useState, useEffect, useRef } from 'react';
import StageBadge from './StageBadge';
import ScoreDisplay from './ScoreDisplay';

type Candidate = {
  ticker: string;
  name: string;
  exchange: string;
  price: number;
  setupType: 'htf' | 'continuation' | 'first-stage';
  score: number;
  subscores: Record<string, number>;
  breakdown: Record<string, number>;
  stage: 'early' | 'forming' | 'prime' | 'late';
  daysInFlag: number;
  pattern: {
    polePct: number;
    poleDays: number;
    poleStartDate: string;
    poleStartPrice: number;
    recentHigh: number;
    recentHighDate: string;
    pullbackPct: number;
    flagLow: number;
    flagHigh?: number;
    volumeContraction: number;
    poleVolumeRatio: number;
    flagBackHalfRatio?: number | null;
    distAbove20Ema: number;
    direction: 'descending' | 'flat' | 'ascending';
    priorRunUp3?: boolean;
    atr14?: number | null;
  };
  base?: {
    baseDays: number;
    baseRange: number;
    prePoleSlope: number;
  };
  ema: {
    ema10: number | null;
    ema20: number | null;
    ema50: number | null;
    ema50Rising: boolean;
  };
  levels: {
    entry: number;
    stop: number;
    target: number;
    riskPct: number;
    rewardPct: number;
    rr: number | null;
  };
  rsPercentile: number;
  return60dPct: number;
  chartUrl: string;
  // rankChange semantics:
  //   null      → ticker wasn't in the previous scan's same-section list → NEW
  //   positive  → moved up N positions
  //   negative  → moved down N positions
  //   0         → unchanged
  //   undefined → field absent (e.g. legacy JSON) — treated as unchanged
  rankChange?: number | null;
};

const DIRECTION_DISPLAY: Record<string, { icon: string; label: string; color: string }> = {
  descending: { icon: '↘', label: 'descending', color: 'text-terminal-green' },
  flat: { icon: '→', label: 'flat', color: 'text-terminal-blue' },
  ascending: { icon: '↗', label: 'ascending', color: 'text-terminal-amber' },
};

function RankChangeBadge({ rankChange }: { rankChange: number | null | undefined }) {
  // NEW: wasn't in the previous scan
  if (rankChange === null) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-terminal-green/50 bg-terminal-green/10 text-terminal-green text-[10px] font-bold tracking-wider uppercase">
        NEW
      </span>
    );
  }
  // Unchanged (or legacy/missing field)
  if (rankChange == null || rankChange === 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-terminal-gray-dim/30 bg-bg-elevated text-text-muted text-[10px] tracking-wider tabular-nums">
        —
      </span>
    );
  }
  // Moved up
  if (rankChange > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-sm border border-terminal-green/30 bg-terminal-green/5 text-terminal-green text-[10px] tracking-wider tabular-nums">
        ▲{rankChange}
      </span>
    );
  }
  // Moved down — de-emphasized per design
  return (
    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-sm border border-terminal-red/20 bg-bg-elevated text-terminal-red/70 text-[10px] tracking-wider tabular-nums">
      ▼{Math.abs(rankChange)}
    </span>
  );
}

const EXTENDED_THRESHOLD = 0.15;

export default function CandidateCard({ candidate, rank }: { candidate: Candidate; rank?: number }) {
  const [expanded, setExpanded] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const c = candidate;
  const isFirstStage = c.setupType === 'first-stage';
  const isHtf = c.setupType === 'htf';

  const polePct = (c.pattern.polePct * 100).toFixed(1);
  const pullbackPct = (c.pattern.pullbackPct * 100).toFixed(1);
  const dist20Pct = (c.pattern.distAbove20Ema * 100).toFixed(1);
  const rsRank = Math.round(c.rsPercentile * 100);
  const dir = DIRECTION_DISPLAY[c.pattern.direction] ?? DIRECTION_DISPLAY.flat;

  const dist50 = c.ema.ema50 ? (c.price - c.ema.ema50) / c.ema.ema50 : null;
  const dist50Pct = dist50 !== null ? (dist50 * 100).toFixed(1) : null;
  const isExtended = dist50 !== null && dist50 >= EXTENDED_THRESHOLD;

  const rankStr = rank !== undefined ? `#${String(rank).padStart(2, '0')}` : null;

  // HTF cards get a subtle border accent and a leading badge to call them out.
  const cardBorderClass = isHtf
    ? 'border border-terminal-amber/50 ring-1 ring-terminal-amber/20'
    : 'border border-terminal-gray-dim/40';

  return (
    <div className={`card-interactive bg-bg-card ${cardBorderClass} rounded-sm p-4 overflow-hidden`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            {rankStr && (
              <span className="font-display text-terminal-green-dim/70 text-base sm:text-lg tabular-nums shrink-0 select-none">
                {rankStr}
              </span>
            )}
            <span className="font-display text-3xl font-bold text-text tracking-tight">{c.ticker}</span>
            <span className="text-terminal-gray-dim text-xs">·</span>
            <span className="font-mono text-text-dim text-sm tabular-nums">${c.price.toFixed(2)}</span>
          </div>
          <div className="text-text-muted text-[10px] uppercase tracking-wider truncate">
            {c.name} {c.exchange && `· ${c.exchange}`}
          </div>
        </div>
        <ScoreDisplay score={c.score} size="md" />
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {isHtf && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-terminal-amber/60 bg-terminal-amber/10 text-terminal-amber text-[10px] tracking-wider uppercase font-bold">
            ⭐ HTF
          </span>
        )}
        <StageBadge stage={c.stage} daysInFlag={c.daysInFlag} />
        <RankChangeBadge rankChange={c.rankChange} />
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-terminal-gray-dim/40 bg-bg-elevated ${dir.color} text-[10px] tracking-wider uppercase`}>
          <span>{dir.icon}</span>
          <span>{dir.label}</span>
        </span>
        {!isFirstStage && rsRank >= 75 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-terminal-green/30 bg-terminal-green/5 text-terminal-green text-[10px] tracking-wider uppercase">
            RS {rsRank}
          </span>
        )}
        {isFirstStage && c.base && c.base.baseDays >= 40 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-terminal-blue/30 bg-terminal-blue/5 text-terminal-blue text-[10px] tracking-wider uppercase">
            base {c.base.baseDays}d
          </span>
        )}
        {c.pattern.priorRunUp3 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-terminal-green-dim/40 bg-terminal-green/5 text-terminal-green-dim text-[10px] tracking-wider uppercase">
            ✓ run-up
          </span>
        )}
        {c.ema.ema50Rising && c.ema.ema20 && c.ema.ema50 && c.ema.ema20 > c.ema.ema50 && (
          <span className="text-terminal-green-dim text-[10px] tracking-wider uppercase">↗ stacked</span>
        )}
        {isExtended && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-terminal-amber/40 bg-terminal-amber/5 text-terminal-amber text-[10px] tracking-wider uppercase">
            ⚠ extended {dist50Pct}%
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
        <div>
          <div className="text-text-muted text-[9px] tracking-widest uppercase">Pole</div>
          <div className="font-mono text-text tabular-nums">+{polePct}% <span className="text-text-muted">/ {c.pattern.poleDays}d</span></div>
        </div>
        <div>
          <div className="text-text-muted text-[9px] tracking-widest uppercase">Pullback</div>
          <div className="font-mono text-text tabular-nums">-{pullbackPct}%</div>
        </div>
        <div>
          <div className="text-text-muted text-[9px] tracking-widest uppercase">From 20</div>
          <div className="font-mono text-text tabular-nums">{c.pattern.distAbove20Ema >= 0 ? '+' : ''}{dist20Pct}%</div>
        </div>
        <div>
          <div className="text-text-muted text-[9px] tracking-widest uppercase">From 50</div>
          <div className={`font-mono tabular-nums ${isExtended ? 'text-terminal-amber' : 'text-text'}`}>
            {dist50Pct !== null ? `${dist50 !== null && dist50 >= 0 ? '+' : ''}${dist50Pct}%` : '—'}
          </div>
        </div>
      </div>

      <div className="bg-bg-elevated border border-terminal-gray-dim/30 rounded-sm p-2 mb-3">
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <div className="text-text-muted text-[9px] tracking-widest uppercase">Entry</div>
            <div className="font-mono text-terminal-green tabular-nums">${c.levels.entry.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-text-muted text-[9px] tracking-widest uppercase">Stop</div>
            <div className="font-mono text-terminal-red/80 tabular-nums">${c.levels.stop.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-text-muted text-[9px] tracking-widest uppercase">Target</div>
            <div className="font-mono text-terminal-green-glow tabular-nums">${c.levels.target.toFixed(2)}</div>
          </div>
        </div>
        {c.levels.rr && (
          <div className="text-text-muted text-[10px] mt-1 font-mono">
            risk {(c.levels.riskPct * 100).toFixed(1)}% · reward {(c.levels.rewardPct * 100).toFixed(1)}% · R/R {c.levels.rr.toFixed(1)}
            {(isFirstStage || isHtf) && <span className="text-terminal-blue ml-2">· full-pole target</span>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setChartOpen(!chartOpen)}
          className="flex-1 text-center px-3 py-1.5 bg-terminal-green/10 border border-terminal-green/40 text-terminal-green text-xs font-mono uppercase tracking-wider hover:bg-terminal-green/20 transition"
        >
          {chartOpen ? 'hide chart' : 'chart →'}
        </button>
        {/* Future: <button>trade</button> goes here when broker link is set up */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-1.5 bg-bg-elevated border border-terminal-gray-dim text-text-dim text-xs font-mono uppercase tracking-wider hover:border-terminal-gray hover:text-text"
        >{expanded ? 'less' : 'more'}</button>
      </div>

      {chartOpen && (
        <div className="mt-3 pt-3 border-t border-terminal-gray-dim/30">
          <TradingViewChart key={`${c.ticker}-chart`} ticker={c.ticker} exchange={c.exchange} />
          <a
            href={c.chartUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center mt-2 px-3 py-1.5 bg-bg-elevated border border-terminal-gray-dim text-text-dim text-[10px] font-mono uppercase tracking-wider hover:border-terminal-gray hover:text-text transition"
          >
            see in app →
          </a>
        </div>
      )}

      {expanded && (
        <div className="mt-3 pt-3 border-t border-terminal-gray-dim/30">
          <div className="text-[10px] text-terminal-gray font-mono uppercase tracking-widest mb-2">
            score breakdown {isHtf ? '(htf)' : isFirstStage ? '(first-stage)' : '(continuation)'}
          </div>

          {isHtf ? (
            <div className="grid grid-cols-3 gap-3 text-[11px] mb-3">
              <div>
                <div className="text-text-muted text-[9px] uppercase">Pole {c.subscores.pole}/40</div>
                <div className="font-mono space-y-0.5 text-text-dim">
                  <div>mag {c.breakdown.poleMagnitude}</div>
                  <div>vel {c.breakdown.poleVelocity}</div>
                  <div>vol {c.breakdown.poleVolume}</div>
                </div>
              </div>
              <div>
                <div className="text-text-muted text-[9px] uppercase">Flag {c.subscores.flag}/40</div>
                <div className="font-mono space-y-0.5 text-text-dim">
                  <div>tight {c.breakdown.flagTightness}</div>
                  <div>vol {c.breakdown.flagContraction}</div>
                  <div>entry {c.breakdown.flagEntry}</div>
                </div>
              </div>
              <div>
                <div className="text-text-muted text-[9px] uppercase">Ctx {c.subscores.context}/20</div>
                <div className="font-mono space-y-0.5 text-text-dim">
                  <div>RS {c.breakdown.ctxRs}</div>
                  <div>trend {c.breakdown.ctxTrend}</div>
                  <div>mkt {c.breakdown.ctxMarket}</div>
                </div>
              </div>
            </div>
          ) : isFirstStage ? (
            <div className="grid grid-cols-4 gap-3 text-[11px] mb-3">
              <div>
                <div className="text-text-muted text-[9px] uppercase">Pole {c.subscores.pole}/30</div>
                <div className="font-mono space-y-0.5 text-text-dim">
                  <div>mag {c.breakdown.poleMagnitude}</div>
                  <div>vel {c.breakdown.poleVelocity}</div>
                  <div>vol {c.breakdown.poleVolume}</div>
                </div>
              </div>
              <div>
                <div className="text-text-muted text-[9px] uppercase">Flag {c.subscores.flag}/30</div>
                <div className="font-mono space-y-0.5 text-text-dim">
                  <div>vol {c.breakdown.flagContraction}</div>
                  <div>entry {c.breakdown.flagEntry}</div>
                  <div>pb {c.breakdown.flagPullback}</div>
                </div>
              </div>
              <div>
                <div className="text-text-muted text-[9px] uppercase">Base {c.subscores.base}/35</div>
                <div className="font-mono space-y-0.5 text-text-dim">
                  <div>len {c.breakdown.baseLength}</div>
                  <div>tight {c.breakdown.baseTightness}</div>
                  <div>p/b {c.breakdown.basePoleRatio}</div>
                </div>
              </div>
              <div>
                <div className="text-text-muted text-[9px] uppercase">Mkt {c.subscores.context}/5</div>
                <div className="font-mono space-y-0.5 text-text-dim">
                  <div>{c.breakdown.ctxMarket}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 text-[11px] mb-3">
              <div>
                <div className="text-text-muted text-[9px] uppercase">Pole {c.subscores.pole}/35</div>
                <div className="font-mono space-y-0.5 text-text-dim">
                  <div>mag {c.breakdown.poleMagnitude}</div>
                  <div>vel {c.breakdown.poleVelocity}</div>
                  <div>vol {c.breakdown.poleVolume}</div>
                </div>
              </div>
              <div>
                <div className="text-text-muted text-[9px] uppercase">Flag {c.subscores.flag}/35</div>
                <div className="font-mono space-y-0.5 text-text-dim">
                  <div>pb {c.breakdown.flagPullback}</div>
                  <div>vol {c.breakdown.flagContraction}</div>
                  <div>entry {c.breakdown.flagEntry}</div>
                </div>
              </div>
              <div>
                <div className="text-text-muted text-[9px] uppercase">Ctx {c.subscores.context}/30</div>
                <div className="font-mono space-y-0.5 text-text-dim">
                  <div>RS {c.breakdown.ctxRs}</div>
                  <div>trend {c.breakdown.ctxTrend}</div>
                  <div>mkt {c.breakdown.ctxMarket}</div>
                </div>
              </div>
            </div>
          )}

          <div className="text-[10px] text-terminal-gray font-mono uppercase tracking-widest mb-2">Pattern details</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono text-text-dim">
            <div>pole start: <span className="text-text">${c.pattern.poleStartPrice.toFixed(2)} ({c.pattern.poleStartDate})</span></div>
            <div>recent high: <span className="text-text">${c.pattern.recentHigh.toFixed(2)} ({c.pattern.recentHighDate})</span></div>
            <div>flag low: <span className="text-text">${c.pattern.flagLow.toFixed(2)}</span></div>
            <div>vol contraction: <span className="text-text">{c.pattern.volumeContraction.toFixed(2)}x</span></div>
            <div>pole vol: <span className="text-text">{c.pattern.poleVolumeRatio.toFixed(2)}x</span></div>
            {c.pattern.flagBackHalfRatio != null && (
              <div>back-half vol: <span className="text-text">{c.pattern.flagBackHalfRatio.toFixed(2)}x</span></div>
            )}
            {c.pattern.atr14 != null && (
              <div>atr(14): <span className="text-text">${c.pattern.atr14.toFixed(2)}</span></div>
            )}
            <div>20-EMA: <span className="text-text">${c.ema.ema20?.toFixed(2) ?? '—'}</span></div>
            <div>50-EMA: <span className="text-text">${c.ema.ema50?.toFixed(2) ?? '—'} {c.ema.ema50Rising && '↗'}</span></div>
            <div>60d ret: <span className="text-text">{(c.return60dPct * 100).toFixed(1)}%</span></div>
            <div>direction: <span className={dir.color}>{dir.icon} {dir.label}</span></div>
            <div>prior run-up: <span className="text-text">{c.pattern.priorRunUp3 ? 'yes' : 'no'}</span></div>
            {c.base && (
              <>
                <div>base days: <span className="text-text">{c.base.baseDays}</span></div>
                <div>base range: <span className="text-text">{(c.base.baseRange * 100).toFixed(1)}%</span></div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TradingViewChart({ ticker, exchange }: { ticker: string; exchange: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    container.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '600px';
    widgetDiv.style.width = '100%';
    container.appendChild(widgetDiv);

    const exchangePrefix = exchange === 'NYSE' || exchange === 'NASDAQ' ? `${exchange}:` : '';
    const symbol = `${exchangePrefix}${ticker}`;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      width: '100%',
      height: 600,
      symbol: symbol,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      range: '12M',
      hide_side_toolbar: true,
      hide_top_toolbar: false,
      allow_symbol_change: false,
      studies: [
        { id: 'MAExp@tv-basicstudies', inputs: { length: 10 } },
        { id: 'MAExp@tv-basicstudies', inputs: { length: 20 } },
        { id: 'MAExp@tv-basicstudies', inputs: { length: 50 } },
        { id: 'Volume@tv-basicstudies' }
      ],
      backgroundColor: 'rgba(0, 0, 0, 1)',
      gridColor: 'rgba(42, 46, 57, 0.5)',
      support_host: 'https://www.tradingview.com'
    });

    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [ticker, exchange]);

  return (
    <div
      className="tradingview-widget-container"
      ref={containerRef}
      style={{ height: 600, width: '100%', overflow: 'hidden' }}
    />
  );
}
