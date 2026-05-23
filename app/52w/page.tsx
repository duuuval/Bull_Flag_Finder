import fs from 'fs';
import path from 'path';
import Header from '@/components/Header';
import FiftyTwoWeekCard from '@/components/FiftyTwoWeekCard';
import { Divider } from '@/components/ASCIIFlair';

export const dynamic = 'force-static';

function loadLatestScan() {
  try {
    const p = path.join(process.cwd(), 'public', 'latest.json');
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export default function FiftyTwoWeekPage() {
  const data = loadLatestScan();
  const candidates = data?.fiftyTwoWeekCandidates ?? [];

  return (
    <>
      <Header subtitle={data ? `52w radar · ${data.scanDate} · ${candidates.length} breakouts` : '52w radar'} />

      <main className="max-w-5xl mx-auto px-4 py-6 relative z-10">
        <section className="mb-6">
          <h1 className="font-display text-4xl text-terminal-green glow-sm tracking-tight">52W RADAR</h1>
          <p className="text-text-muted text-xs mt-1 font-mono">
            fresh 52-week breakouts on elevated volume · secondary signal
          </p>
        </section>

        <div className="bg-bg-card border border-terminal-amber/30 rounded-sm p-3 mb-6">
          <p className="text-text-dim text-[11px] font-mono">
            <span className="text-terminal-amber">note</span> · 52w radar surfaces stocks just printing
            new highs. these are early-stage signals — most should be added to a watchlist for the bull flag
            to develop. trade the flag, not the spike.
          </p>
        </div>

        {!data ? (
          <div className="text-center py-12 text-text-muted font-mono text-sm">
            no scan data yet
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-12 text-text-muted font-mono text-sm">
            no 52w breakouts today
          </div>
        ) : (
          <>
            <Divider label="breakouts" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {candidates.map((c: any) => (
                <FiftyTwoWeekCard key={c.ticker} candidate={c} />
              ))}
            </div>
          </>
        )}

        <footer className="mt-12 pt-6 border-t border-terminal-gray-dim/30 text-center">
          <p className="text-text-muted text-[10px] font-mono opacity-60">
            sorted by volume ratio · highest activity first
          </p>
        </footer>
      </main>
    </>
  );
}
