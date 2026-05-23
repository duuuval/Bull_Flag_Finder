type FiftyTwoWeekCandidate = {
  ticker: string;
  name: string;
  exchange: string;
  price: number;
  high52w: number;
  distFromHighPct: number;
  volRatio: number;
  dayChangePct: number;
  chartUrl: string;
};

export default function FiftyTwoWeekCard({ candidate }: { candidate: FiftyTwoWeekCandidate }) {
  const c = candidate;
  const dist = (c.distFromHighPct * 100).toFixed(2);
  const dayChg = (c.dayChangePct * 100).toFixed(2);
  const isPositive = c.dayChangePct >= 0;

  return (
    <div className="card-interactive bg-bg-card border border-terminal-gray-dim/40 rounded-sm p-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-text tracking-tight">{c.ticker}</span>
            <span className="text-terminal-gray-dim text-xs">·</span>
            <span className="font-mono text-text-dim text-sm tabular-nums">${c.price.toFixed(2)}</span>
            <span className={`font-mono text-xs tabular-nums ${isPositive ? 'text-terminal-green' : 'text-terminal-red'}`}>
              {isPositive ? '+' : ''}{dayChg}%
            </span>
          </div>
          <div className="text-text-muted text-[10px] uppercase tracking-wider truncate mt-0.5">
            {c.name} {c.exchange && `· ${c.exchange}`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px] mb-3">
        <div>
          <div className="text-text-muted text-[9px] tracking-widest uppercase">52W High</div>
          <div className="font-mono text-text tabular-nums">${c.high52w.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-text-muted text-[9px] tracking-widest uppercase">From High</div>
          <div className="font-mono text-text tabular-nums">-{dist}%</div>
        </div>
        <div>
          <div className="text-text-muted text-[9px] tracking-widest uppercase">Vol</div>
          <div className="font-mono text-text tabular-nums">{c.volRatio.toFixed(1)}x</div>
        </div>
      </div>

      <a
        href={c.chartUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center px-3 py-1.5 bg-bg-elevated border border-terminal-gray-dim text-text-dim text-xs font-mono uppercase tracking-wider hover:border-terminal-green hover:text-terminal-green transition"
      >
        chart →
      </a>
    </div>
  );
}
