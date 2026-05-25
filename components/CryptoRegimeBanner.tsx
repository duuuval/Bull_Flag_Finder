type Regime = {
  status: 'ok' | 'warning' | 'hostile';
  btc: {
    price: number | null;
    ema50: number | null;
    above: boolean;
    deltaPct: number | null;
  };
  total3?: any;
  triggered: string[];
};

function formatBtcPrice(n: number | null): string {
  if (n == null) return '—';
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function CryptoRegimeBanner({ regime }: { regime: Regime }) {
  const { status, btc, triggered } = regime;

  const statusColor =
    status === 'ok'
      ? 'text-crypto-orange'
      : status === 'warning'
      ? 'text-terminal-amber'
      : 'text-terminal-red';

  const statusText =
    status === 'ok'
      ? '✓ regime ok'
      : status === 'warning'
      ? '⚠ regime warning'
      : '⚠⚠ hostile regime';

  const btcDeltaPct = btc.deltaPct != null ? (btc.deltaPct * 100).toFixed(1) : null;

  return (
    <div className="bg-bg-card border border-terminal-gray-dim/40 rounded-sm p-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="text-xs font-mono">
          <span className="text-text-muted">BTC </span>
          <span className="text-text tabular-nums">{formatBtcPrice(btc.price)}</span>
          <span
            className={`ml-1 ${
              btc.above ? 'text-crypto-orange' : 'text-terminal-red'
            }`}
          >
            {btc.above ? '↗' : '↘'}
          </span>
          {btcDeltaPct != null && (
            <span
              className={`ml-1 text-[10px] tabular-nums ${
                btc.above ? 'text-crypto-orange-dim' : 'text-terminal-red'
              }`}
            >
              ({btc.deltaPct! >= 0 ? '+' : ''}
              {btcDeltaPct}% vs 50-EMA daily)
            </span>
          )}
        </div>
        <div
          className={`text-[10px] font-mono uppercase tracking-widest ${statusColor}`}
        >
          {statusText}
        </div>
      </div>

      {triggered.length > 0 && (
        <div className="text-[10px] font-mono text-text-muted pt-2 mt-2 border-t border-terminal-gray-dim/30">
          BTC trend has flipped below its daily 50-EMA — alt flags historically fail
          more often in this regime. scans still run; you decide.
        </div>
      )}
    </div>
  );
}
