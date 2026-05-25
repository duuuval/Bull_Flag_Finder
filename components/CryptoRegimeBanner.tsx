type Regime = {
  state?: 'strong' | 'mixed' | 'weak';
  btc: {
    price: number | null;
    ema50: number | null;
    above: boolean;
    deltaPct: number | null;
    ema50Rising?: boolean | null;
    ema50SlopePct?: number | null;
  };
  total3?: any;
  // Legacy fields preserved for back-compat with older JSON payloads
  status?: 'ok' | 'warning' | 'hostile';
  triggered?: string[];
};

function formatBtcPrice(n: number | null): string {
  if (n == null) return '—';
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

// Derive state from the new `state` field if present, otherwise fall back to
// the legacy `status` field for older JSON payloads (so the page still renders
// during a deploy window before the next scan writes the new schema).
function resolveState(regime: Regime): 'strong' | 'mixed' | 'weak' {
  if (regime.state) return regime.state;
  if (regime.status === 'ok') return 'strong';
  if (regime.status === 'hostile') return 'weak';
  return 'mixed';
}

const STATE_DISPLAY: Record<
  'strong' | 'mixed' | 'weak',
  { label: string; color: string; bg: string; border: string; symbol: string }
> = {
  strong: {
    label: 'STRONG',
    color: 'text-terminal-green',
    bg: 'bg-terminal-green/5',
    border: 'border-terminal-green/40',
    symbol: '▲',
  },
  mixed: {
    label: 'MIXED',
    color: 'text-terminal-amber',
    bg: 'bg-terminal-amber/5',
    border: 'border-terminal-amber/40',
    symbol: '◆',
  },
  weak: {
    label: 'WEAK',
    color: 'text-terminal-red',
    bg: 'bg-terminal-red/5',
    border: 'border-terminal-red/40',
    symbol: '▼',
  },
};

export default function CryptoRegimeBanner({ regime }: { regime: Regime }) {
  const state = resolveState(regime);
  const display = STATE_DISPLAY[state];
  const { btc } = regime;

  const btcDeltaPct = btc.deltaPct != null ? (btc.deltaPct * 100).toFixed(1) : null;
  const slopeText =
    btc.ema50Rising === true
      ? 'rising'
      : btc.ema50Rising === false
        ? 'falling'
        : null;

  // Short, action-oriented sub-line that translates the state into "what this means for finding flags"
  const sublineByState: Record<'strong' | 'mixed' | 'weak', string> = {
    strong:
      'BTC above its daily 50-EMA and 50-EMA rising. setups have the broader tape behind them.',
    mixed:
      'BTC and its 50-EMA disagree, or trend is flat. expect more noise, more false starts — flags still surface, you decide.',
    weak:
      'BTC below its daily 50-EMA and 50-EMA falling. flags can still form but tend to fail more often. scans still run; you decide.',
  };

  return (
    <div className={`bg-bg-card border ${display.border} rounded-sm p-3`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="text-xs font-mono">
          <span className="text-text-muted">BTC </span>
          <span className="text-text tabular-nums">{formatBtcPrice(btc.price)}</span>
          <span
            className={`ml-1 ${btc.above ? 'text-crypto-orange' : 'text-terminal-red'}`}
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
              {btcDeltaPct}% vs 50-EMA daily
              {slopeText ? `, ${slopeText}` : ''})
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-text-muted text-[9px] font-mono uppercase tracking-widest">
            market state
          </span>
          <span
            className={`text-[11px] font-mono uppercase tracking-widest ${display.color}`}
          >
            {display.symbol} {display.label}
          </span>
        </div>
      </div>

      <div className="text-[10px] font-mono text-text-muted pt-2 mt-2 border-t border-terminal-gray-dim/30">
        {sublineByState[state]}
      </div>
    </div>
  );
}
