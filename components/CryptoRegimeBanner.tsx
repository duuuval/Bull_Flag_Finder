type Regime = {
  status: 'ok' | 'warning' | 'hostile';
  btc: {
    price: number | null;
    ema50: number | null;
    above: boolean;
    deltaPct: number | null;
  };
  total3: {
    cap: number | null;
    ema20: number | null;
    above: boolean | null;
    deltaPct: number | null;
  };
  triggered: string[];
};

function formatCap(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  return `$${(n / 1e6).toFixed(0)}M`;
}

function formatBtcPrice(n: number | null): string {
  if (n == null) return '—';
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function CryptoRegimeBanner({ regime }: { regime: Regime }) {
  const { status, btc, total3, triggered } = regime;

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

  const btcDeltaPct =
    btc.deltaPct != null ? (btc.deltaPct * 100).toFixed(1) : null;
  const total3DeltaPct =
    total3.deltaPct != null ? (total3.deltaPct * 100).toFixed(1) : null;

  return (
    <div className="bg-bg-card border border-terminal-gray-dim/40 rounded-sm p-3">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
        <div className="flex items-center gap-4 text-xs font-mono flex-wrap">
          <div>
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
          <div>
            <span className="text-text-muted">TOTAL3 </span>
            <span className="text-text tabular-nums">{formatCap(total3.cap)}</span>
            <span
              className={`ml-1 ${
                total3.above
                  ? 'text-crypto-orange'
                  : total3.above === false
                  ? 'text-terminal-red'
                  : 'text-text-muted'
              }`}
            >
              {total3.above ? '↗' : total3.above === false ? '↘' : '—'}
            </span>
            {total3DeltaPct != null && (
              <span
                className={`ml-1 text-[10px] tabular-nums ${
                  total3.above ? 'text-crypto-orange-dim' : 'text-terminal-red'
                }`}
              >
                ({total3.deltaPct! >= 0 ? '+' : ''}
                {total3DeltaPct}% vs 20-EMA daily)
              </span>
            )}
          </div>
        </div>
        <div
          className={`text-[10px] font-mono uppercase tracking-widest ${statusColor}`}
        >
          {statusText}
        </div>
      </div>

      {triggered.length > 0 && (
        <div className="text-[10px] font-mono text-text-muted pt-2 border-t border-terminal-gray-dim/30">
          triggered:{' '}
          {triggered.map((t, i) => (
            <span key={t}>
              <span className="text-terminal-red">{labelForGate(t)}</span>
              {i < triggered.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function labelForGate(gate: string): string {
  switch (gate) {
    case 'btc_below_50ema':
      return 'BTC below 50-EMA daily';
    case 'total3_below_20ema':
      return 'TOTAL3 below 20-EMA daily';
    default:
      return gate;
  }
}
