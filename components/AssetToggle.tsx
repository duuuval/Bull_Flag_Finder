'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function AssetToggle({
  mode,
}: {
  mode: 'stocks' | 'crypto';
}) {
  const router = useRouter();
  const params = useSearchParams();

  const setMode = (next: 'stocks' | 'crypto') => {
    const sp = new URLSearchParams(params?.toString() || '');
    if (next === 'crypto') {
      sp.set('mode', 'crypto');
    } else {
      sp.delete('mode');
    }
    const qs = sp.toString();
    router.push(qs ? `/?${qs}` : '/');
  };

  return (
    <div className="inline-flex items-center gap-0 border border-terminal-gray-dim/60 rounded-sm overflow-hidden">
      <button
        onClick={() => setMode('stocks')}
        className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition ${
          mode === 'stocks'
            ? 'bg-terminal-green/15 text-terminal-green border-r border-terminal-green/40 glow-sm'
            : 'bg-transparent text-text-muted border-r border-terminal-gray-dim/60 hover:text-text-dim'
        }`}
        aria-pressed={mode === 'stocks'}
      >
        <span>💵</span>
        <span>stocks</span>
      </button>
      <button
        onClick={() => setMode('crypto')}
        className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition ${
          mode === 'crypto'
            ? 'bg-crypto-orange/15 text-crypto-orange glow-sm'
            : 'bg-transparent text-text-muted hover:text-text-dim'
        }`}
        aria-pressed={mode === 'crypto'}
      >
        <span>₿</span>
        <span>crypto</span>
      </button>
    </div>
  );
}
