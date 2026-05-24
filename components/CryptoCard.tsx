'use client';

import { useState, useEffect, useRef } from 'react';
import StageBadge from './StageBadge';
import ScoreDisplay from './ScoreDisplay';

type CryptoCandidate = {
  id: string;
  symbol: string;
  name: string;
  binanceSymbol: string;
  marketCap: number;
  rank: number | null;
  image: string | null;
  price: number;
  score: number;
  subscores: { pole: number; flag: number; structure: number };
  breakdown: Record<string, number>;
  stage: 'early' | 'forming' | 'prime' | 'late';
  barsInFlag: number;
  pattern: {
    polePct: number;
    poleBars: number;
    poleStartDate: string;
    poleStartPrice: number;
    recentHigh: number;
    recentHighDate: string;
    pullbackPctAbsolute: number;
    pullbackFracOfPole: number;
    flagLow: number;
    flagHigh: number;
    volumeContraction: number;
    cumulativePoleVolumeRatio: number;
    maxBarVolumeRatio: number;
    highsSlope: number;
    lowsSlope: number;
    distAbove20Ema: number;
    direction: 'descending' | 'flat' | 'ascending';
  };
  ema: {
    ema10: number | null;
    ema20: number | null;
    ema50: number | null;
    ema50Rising: boolean;
  };
  return60bars: number;
  chartUrl: string;
};

const DIRECTION_DISPLAY: Record<string, { icon: string; label: string; color: string }> = {
  descending: { icon: '↘', label: 'descending', color: 'text-crypto-orange' },
  flat: { icon: '→', label: 'flat', color: 'text-terminal-blue' },
  ascending: { icon: '↗', label: 'ascending', color: 'text-terminal-amber' },
};

// Format price with adaptive precision for crypto's huge range
function formatPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (n >= 100) return `$${n.toFixed(2)}`;
  if (n >= 1) return `$${n.toFixed(4)}`;
  if (n >= 0.01) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(8)}`;
}

// Format market cap as $X.XB or $XXXM
function formatMarketCap(n: number): string {
  if (!n) return '';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  return `$${Math.round(n / 1e3)}K`;
}

export default function CryptoCard({
  candidate,
  rank,
}: {
  candidate: CryptoCandidate;
  rank?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const c = candidate;

  const polePct = (c.pattern.polePct * 100).toFixed(1);
  const pullbackPct = (c.pattern.pullbackPctAbsolute * 100).toFixed(1);
  const pullbackOfPole = (c.pattern.pullbackFracOfPole * 100).toFixed(1);
  const dist20Pct = (c.pattern.distAbove20Ema * 100).toFixed(1);
  const dir = DIRECTION_DISPLAY[c.pattern.direction] ?? DIRECTION_DISPLAY.flat;

  const dist50 =
    c.ema.ema50 != null ? (c.price - c.ema.ema50) / c.ema.ema50 : null;
  const dist50Pct = dist50 !== null ? (dist50 * 100).toFixed(1) : null;

  const rankStr = rank !== undefined ? `#${String(rank).padStart(2, '0')}` : null;

  return (
    <div className="card-interactive-crypto bg-bg-card border border-terminal-gray-dim/40 rounded-sm p-4 overflow-hidden">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            {rankStr && (
              <span className="font-display text-crypto-orange-dim/70 text-base sm:text-lg tabular-nums shrink-0 select-none">
                {rankStr}
              </span>
            )}
            <span className="font-display text-3xl font-bold text-text tracking-tight">
              {c.symbol}
            </span>
            <span className="text-terminal-gray-dim text-xs">·</span>
            <span className="font-mono text-text-dim text-sm tabular-nums">
              {formatPrice(c.price)}
            </span>
          </div>
          <div className="text-text-muted text-[10px] uppercase tracking-wider truncate">
            {c.name}
            {c.rank && ` · #${c.rank} by mcap`}
            {c.marketCap > 0 && ` · ${formatMarketCap(c.marketCap)}`}
          </div>
        </div>
        <ScoreDisplay score={c.score} size="md" />
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <StageBadge stage={c.stage} daysInFlag={c.barsInFlag} />
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-terminal-gray-dim/40 bg-bg-elevated ${dir.color} text-[10px] tracking-wider uppercase`}
        >
          <span>{dir.icon}</span>
          <span>{dir.label}</span>
        </span>
        {c.ema.ema50Rising &&
          c.ema.ema20 &&
          c.ema.ema50 &&
          c.ema.ema20 > c.ema.ema50 && (
            <span className="text-crypto-orange-dim text-[10px] tracking-wider uppercase">
              ↗ stacked
            </span>
          )}
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
        <div>
          <div className="text-text-muted text-[9px] tracking-widest uppercase">Pole</div>
          <div className="font-mono text-text tabular-nums">
            +{polePct}%{' '}
            <span className="text-text-muted">/ {c.pattern.poleBars}b</span>
          </div>
        </div>
        <div>
          <div className="text-text-muted text-[9px] tracking-widest uppercase">Pullback</div>
          <div className="font-mono text-text tabular-nums">-{pullbackPct}%</div>
        </div>
        <div>
          <div className="text-text-muted text-[9px] tracking-widest uppercase">From 20</div>
          <div className="font-mono text-text tabular-nums">
            {c.pattern.distAbove20Ema >= 0 ? '+' : ''}
            {dist20Pct}%
          </div>
        </div>
        <div>
          <div className="text-text-muted text-[9px] tracking-widest uppercase">From 50</div>
          <div className="font-mono text-text tabular-nums">
            {dist50Pct !== null
              ? `${dist50 !== null && dist50 >= 0 ? '+' : ''}${dist50Pct}%`
              : '—'}
          </div>
        </div>
      </div>

      {/* Structural levels box — NO suggested trade levels for crypto */}
      <div className="bg-bg-elevated border border-terminal-gray-dim/30 rounded-sm p-2 mb-3">
        <div className="text-text-muted text-[9px] tracking-widest uppercase mb-1.5">
          structural levels
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono">
          <div className="flex justify-between">
            <span className="text-text-muted">20-EMA</span>
            <span className="text-crypto-orange tabular-nums">
              {c.ema.ema20 != null ? formatPrice(c.ema.ema20) : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">50-EMA</span>
            <span className="text-text tabular-nums">
              {c.ema.ema50 != null ? formatPrice(c.ema.ema50) : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">flag low</span>
            <span className="text-text tabular-nums">{formatPrice(c.pattern.flagLow)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">pole top</span>
            <span className="text-crypto-orange-glow tabular-nums">
              {formatPrice(c.pattern.recentHigh)}
            </span>
          </div>
        </div>
        <div className="text-text-muted text-[9px] mt-1.5 font-mono italic">
          pullback at {pullbackOfPole}% of pole · no suggested entry/stop — set your own
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setChartOpen(!chartOpen)}
          className="flex-1 text-center px-3 py-1.5 bg-crypto-orange/10 border border-crypto-orange/40 text-crypto-orange text-xs font-mono uppercase tracking-wider hover:bg-crypto-orange/20 transition"
        >
          {chartOpen ? 'hide chart' : 'chart →'}
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-1.5 bg-bg-elevated border border-terminal-gray-dim text-text-dim text-xs font-mono uppercase tracking-wider hover:border-terminal-gray hover:text-text"
        >
          {expanded ? 'less' : 'more'}
        </button>
      </div>

      {chartOpen && (
        <div className="mt-3 pt-3 border-t border-terminal-gray-dim/30">
          <TradingViewChart
            key={`${c.binanceSymbol}-chart`}
            binanceSymbol={c.binanceSymbol}
          />
          <a
            href={c.chartUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center mt-2 px-3 py-1.5 bg-bg-elevated border border-terminal-gray-dim text-text-dim text-[10px] font-mono uppercase tracking-wider hover:border-terminal-gray hover:text-text transition"
          >
            open in tradingview →
          </a>
        </div>
      )}

      {expanded && (
        <div className="mt-3 pt-3 border-t border-terminal-gray-dim/30">
          <div className="text-[10px] text-terminal-gray font-mono uppercase tracking-widest mb-2">
            score breakdown
          </div>
          <div className="grid grid-cols-3 gap-3 text-[11px] mb-3">
            <div>
              <div className="text-text-muted text-[9px] uppercase">
                Pole {c.subscores.pole}/40
              </div>
              <div className="font-mono space-y-0.5 text-text-dim">
                <div>mag {c.breakdown.poleMagnitude}</div>
                <div>vel {c.breakdown.poleVelocity}</div>
                <div>vol {c.breakdown.poleVolume}</div>
              </div>
            </div>
            <div>
              <div className="text-text-muted text-[9px] uppercase">
                Flag {c.subscores.flag}/40
              </div>
              <div className="font-mono space-y-0.5 text-text-dim">
                <div>pb {c.breakdown.flagPullback}</div>
                <div>vol {c.breakdown.flagContraction}</div>
                <div>entry {c.breakdown.flagEntry}</div>
              </div>
            </div>
            <div>
              <div className="text-text-muted text-[9px] uppercase">
                Struct {c.subscores.structure}/20
              </div>
              <div className="font-mono space-y-0.5 text-text-dim">
                <div>stack {c.breakdown.stack}</div>
                <div>regime {c.breakdown.regime}</div>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-terminal-gray font-mono uppercase tracking-widest mb-2">
            Pattern details
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono text-text-dim">
            <div>
              pole start:{' '}
              <span className="text-text">
                {formatPrice(c.pattern.poleStartPrice)}
              </span>
            </div>
            <div>
              pole top:{' '}
              <span className="text-text">{formatPrice(c.pattern.recentHigh)}</span>
            </div>
            <div>
              pullback of pole:{' '}
              <span className="text-text">{pullbackOfPole}% (max 38.2%)</span>
            </div>
            <div>
              flag low: <span className="text-text">{formatPrice(c.pattern.flagLow)}</span>
            </div>
            <div>
              vol contraction:{' '}
              <span className="text-text">{c.pattern.volumeContraction.toFixed(2)}x</span>
            </div>
            <div>
              cum. pole vol:{' '}
              <span className="text-text">
                {c.pattern.cumulativePoleVolumeRatio.toFixed(2)}x
              </span>
            </div>
            <div>
              max bar vol:{' '}
              <span className="text-text">
                {c.pattern.maxBarVolumeRatio.toFixed(2)}x
              </span>
            </div>
            <div>
              highs slope:{' '}
              <span className="text-text">
                {(c.pattern.highsSlope * 100).toFixed(3)}%/bar
              </span>
            </div>
            <div>
              lows slope:{' '}
              <span className="text-text">
                {(c.pattern.lowsSlope * 100).toFixed(3)}%/bar
              </span>
            </div>
            <div>
              60b return:{' '}
              <span className="text-text">{(c.return60bars * 100).toFixed(1)}%</span>
            </div>
            <div>
              direction:{' '}
              <span className={dir.color}>
                {dir.icon} {dir.label}
              </span>
            </div>
            <div>
              50-EMA rising:{' '}
              <span className="text-text">{c.ema.ema50Rising ? 'yes' : 'no'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TradingViewChart({ binanceSymbol }: { binanceSymbol: string }) {
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

    const symbol = `BINANCE:${binanceSymbol}`;

    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      width: '100%',
      height: 600,
      symbol: symbol,
      interval: '240', // 4h
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      range: '3M',
      hide_side_toolbar: true,
      hide_top_toolbar: false,
      allow_symbol_change: false,
      studies: [
        { id: 'MAExp@tv-basicstudies', inputs: { length: 10 } },
        { id: 'MAExp@tv-basicstudies', inputs: { length: 20 } },
        { id: 'MAExp@tv-basicstudies', inputs: { length: 50 } },
        { id: 'Volume@tv-basicstudies' },
      ],
      backgroundColor: 'rgba(0, 0, 0, 1)',
      gridColor: 'rgba(42, 46, 57, 0.5)',
      support_host: 'https://www.tradingview.com',
    });

    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [binanceSymbol]);

  return (
    <div
      className="tradingview-widget-container"
      ref={containerRef}
      style={{ height: 600, width: '100%', overflow: 'hidden' }}
    />
  );
}
