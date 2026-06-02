'use client';

import { useState, useEffect, useRef } from 'react';
import StageBadge from './StageBadge';
import ScoreDisplay from './ScoreDisplay';

type MajorContext = {
  price: number;
  change24h: number;
  ema10: number;
  ema20: number;
  ema50: number;
  ema50Rising: boolean;
  aboveEma50: boolean;
  stack: 'bullish' | 'bearish' | 'mixed';
  direction: 'descending' | 'flat' | 'ascending';
  distAbove20Ema: number;
  asOf: string;
};

type MajorAsset = {
  symbol: string;
  name: string;
  binanceSymbol: string;
  rank: number;
  chartUrl: string;
  tier: 'major';
  context: MajorContext | null;
  flag: any | null;
  score: number | null;
  stage: string | null;
};

const DIRECTION_DISPLAY: Record<string, { icon: string; label: string; color: string }> = {
  descending: { icon: '↘', label: 'descending', color: 'text-crypto-orange' },
  flat: { icon: '→', label: 'flat', color: 'text-terminal-blue' },
  ascending: { icon: '↗', label: 'ascending', color: 'text-terminal-amber' },
};

// Build the TradingView symbol / URL from the clean display ticker.
// TradingView normalizes Kraken's odd codes to the standard ticker
// (XBT -> BTC, XDG -> DOGE), so we use the display symbol, NOT the Kraken
// altname. All Kraken USD pairs resolve as KRAKEN:<TICKER>USD.
function krakenTvSymbol(displayTicker: string): string {
  return `KRAKEN:${displayTicker.toUpperCase()}USD`;
}
function krakenChartUrl(displayTicker: string): string {
  return `https://www.tradingview.com/symbols/${displayTicker.toUpperCase()}USD/?exchange=KRAKEN`;
}

function formatPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (n >= 100) return `$${n.toFixed(2)}`;
  if (n >= 1) return `$${n.toFixed(4)}`;
  if (n >= 0.01) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(8)}`;
}

export default function MajorCard({ major }: { major: MajorAsset }) {
  const [chartOpen, setChartOpen] = useState(false);
  const [flagExpanded, setFlagExpanded] = useState(false);

  // No data at all — fetch failed for this asset
  if (!major.context) {
    return (
      <div className="bg-bg-card border border-terminal-gray-dim/40 rounded-sm p-4">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-display text-2xl font-bold text-text tracking-tight">
            {major.symbol}
          </span>
          <span className="text-text-muted text-[10px] uppercase tracking-wider">
            {major.name}
          </span>
        </div>
        <div className="text-text-muted text-xs font-mono mt-2">
          — data unavailable this scan —
        </div>
      </div>
    );
  }

  const ctx = major.context;
  const dir = DIRECTION_DISPLAY[ctx.direction] ?? DIRECTION_DISPLAY.flat;
  const change24Pct = (ctx.change24h * 100).toFixed(2);
  const change24Color =
    ctx.change24h > 0 ? 'text-terminal-green' : ctx.change24h < 0 ? 'text-crypto-orange' : 'text-text-dim';
  const dist20Pct = (ctx.distAbove20Ema * 100).toFixed(1);
  const dist50 = (ctx.price - ctx.ema50) / ctx.ema50;
  const dist50Pct = (dist50 * 100).toFixed(1);

  const hasFlag = major.flag != null;

  const tvSymbol = krakenTvSymbol(major.symbol);
  const chartHref = krakenChartUrl(major.symbol);

  return (
    <div className="card-interactive-crypto bg-bg-card border border-crypto-orange/30 rounded-sm p-4 overflow-hidden">
      {/* Header: symbol + price + 24h change + flag score (if any) */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            <span className="font-display text-3xl font-bold text-text tracking-tight">
              {major.symbol}
            </span>
            <span className="text-terminal-gray-dim text-xs">·</span>
            <span className="font-mono text-text-dim text-sm tabular-nums">
              {formatPrice(ctx.price)}
            </span>
            <span className={`font-mono text-xs tabular-nums ${change24Color}`}>
              {ctx.change24h >= 0 ? '+' : ''}
              {change24Pct}%
            </span>
          </div>
          <div className="text-text-muted text-[10px] uppercase tracking-wider truncate">
            {major.name} · 24h
          </div>
        </div>
        {hasFlag ? (
          <ScoreDisplay score={major.score!} size="md" />
        ) : (
          <div className="flex flex-col items-end">
            <div className="font-mono text-[10px] text-text-muted uppercase tracking-widest">
              score
            </div>
            <div className="font-display text-2xl text-terminal-gray-dim tabular-nums">
              n/a
            </div>
          </div>
        )}
      </div>

      {/* Status row */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {hasFlag && major.stage && (
          <StageBadge stage={major.stage as any} daysInFlag={major.flag.barsInFlag} />
        )}
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-terminal-gray-dim/40 bg-bg-elevated ${dir.color} text-[10px] tracking-wider uppercase`}
        >
          <span>{dir.icon}</span>
          <span>{dir.label}</span>
        </span>
        <span
          className={`px-2 py-0.5 text-[10px] tracking-wider uppercase border rounded-sm ${
            ctx.aboveEma50
              ? 'border-terminal-green/40 text-terminal-green bg-terminal-green/10'
              : 'border-crypto-orange/40 text-crypto-orange bg-crypto-orange/10'
          }`}
        >
          {ctx.aboveEma50 ? 'above 50ema' : 'below 50ema'}
        </span>
        <span
          className={`px-2 py-0.5 text-[10px] tracking-wider uppercase border rounded-sm ${
            ctx.stack === 'bullish'
              ? 'border-terminal-green/40 text-terminal-green'
              : ctx.stack === 'bearish'
                ? 'border-crypto-orange/40 text-crypto-orange'
                : 'border-terminal-gray-dim text-text-muted'
          }`}
        >
          stack {ctx.stack}
        </span>
      </div>

      {/* Key stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div>
          <div className="text-text-muted text-[9px] tracking-widest uppercase">From 20</div>
          <div className="font-mono text-text tabular-nums">
            {ctx.distAbove20Ema >= 0 ? '+' : ''}
            {dist20Pct}%
          </div>
        </div>
        <div>
          <div className="text-text-muted text-[9px] tracking-widest uppercase">From 50</div>
          <div className="font-mono text-text tabular-nums">
            {dist50 >= 0 ? '+' : ''}
            {dist50Pct}%
          </div>
        </div>
        <div>
          <div className="text-text-muted text-[9px] tracking-widest uppercase">50 EMA</div>
          <div className="font-mono text-text tabular-nums">
            {ctx.ema50Rising ? '↗ rising' : '↘ falling'}
          </div>
        </div>
      </div>

      {/* Flag info block — only when a flag is firing */}
      {hasFlag ? (
        <FlagBlock flag={major.flag} expanded={flagExpanded} onToggle={() => setFlagExpanded(!flagExpanded)} />
      ) : (
        <div className="bg-bg-elevated border border-terminal-gray-dim/30 rounded-sm p-2 mb-3">
          <div className="text-text-muted text-[11px] font-mono uppercase tracking-wider text-center">
            no qualifying flag
          </div>
          <div className="text-text-muted text-[9px] mt-1 font-mono italic text-center">
            major gates: pole 7-40% · pullback ≤50% of pole
          </div>
        </div>
      )}

      {/* Chart toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setChartOpen(!chartOpen)}
          className="flex-1 text-center px-3 py-1.5 bg-crypto-orange/10 border border-crypto-orange/40 text-crypto-orange text-xs font-mono uppercase tracking-wider hover:bg-crypto-orange/20 transition"
        >
          {chartOpen ? 'hide chart' : 'chart →'}
        </button>
      </div>

      {chartOpen && (
        <div className="mt-3 pt-3 border-t border-terminal-gray-dim/30">
          <TradingViewChart key={`${tvSymbol}-chart`} tvSymbol={tvSymbol} />
          <a
            href={chartHref}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center mt-2 px-3 py-1.5 bg-bg-elevated border border-terminal-gray-dim text-text-dim text-[10px] font-mono uppercase tracking-wider hover:border-terminal-gray hover:text-text transition"
          >
            open in tradingview →
          </a>
        </div>
      )}
    </div>
  );
}

function FlagBlock({
  flag,
  expanded,
  onToggle,
}: {
  flag: any;
  expanded: boolean;
  onToggle: () => void;
}) {
  const polePct = (flag.pattern.polePct * 100).toFixed(1);
  const pullbackPct = (flag.pattern.pullbackPctAbsolute * 100).toFixed(1);
  const pullbackOfPole = (flag.pattern.pullbackFracOfPole * 100).toFixed(1);

  return (
    <div className="bg-bg-elevated border border-crypto-orange/30 rounded-sm p-2 mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-crypto-orange text-[10px] tracking-widest uppercase font-mono">
          ▶ flag firing
        </div>
        <button
          onClick={onToggle}
          className="text-text-muted text-[10px] font-mono hover:text-text-dim"
        >
          {expanded ? 'less' : 'more'}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[11px] font-mono">
        <div className="flex justify-between">
          <span className="text-text-muted">pole</span>
          <span className="text-text tabular-nums">+{polePct}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">pullback</span>
          <span className="text-text tabular-nums">-{pullbackPct}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">flag</span>
          <span className="text-text tabular-nums">{flag.barsInFlag}b</span>
        </div>
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-terminal-gray-dim/30 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono text-text-dim">
          <div>
            pullback of pole: <span className="text-text">{pullbackOfPole}%</span>
          </div>
          <div>
            pole bars: <span className="text-text">{flag.pattern.poleBars}</span>
          </div>
          <div>
            flag low: <span className="text-text">{formatPrice(flag.pattern.flagLow)}</span>
          </div>
          <div>
            pole top: <span className="text-text">{formatPrice(flag.pattern.recentHigh)}</span>
          </div>
          <div>
            vol contraction:{' '}
            <span className="text-text">{flag.pattern.volumeContraction.toFixed(2)}x</span>
          </div>
          <div>
            cum pole vol:{' '}
            <span className="text-text">
              {flag.pattern.cumulativePoleVolumeRatio.toFixed(2)}x
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function TradingViewChart({ tvSymbol }: { tvSymbol: string }) {
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

    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      width: '100%',
      height: 600,
      symbol: tvSymbol,
      interval: '60', // 1h default
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      range: '1M', // 1M of 1h bars frames the pole+flag without zooming out too far
      hide_side_toolbar: true,
      hide_top_toolbar: false, // leave the toolbar so the interval can be changed live
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
  }, [tvSymbol]);

  return (
    <div
      className="tradingview-widget-container"
      ref={containerRef}
      style={{ height: 600, width: '100%', overflow: 'hidden' }}
    />
  );
}
