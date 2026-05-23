'use client';

import { useState, useMemo } from 'react';
import CandidateCard from '@/components/CandidateCard';
import { Divider } from '@/components/ASCIIFlair';

type Stage = 'early' | 'forming' | 'prime' | 'late';
type SortMode = 'score' | 'stage';

const STAGE_ORDER: Record<Stage, number> = { prime: 0, forming: 1, early: 2, late: 3 };

export default function TwoSectionScanner({
  continuation,
  firstStage,
}: {
  continuation: any[];
  firstStage: any[];
}) {
  return (
    <>
      <SectionView
        title="strength trades"
        subtitle="continuation flags · pullbacks within established uptrends"
        emoji="💪"
        candidates={continuation}
        accent="green"
      />
      <SectionView
        title="base breakouts"
        subtitle="first-stage flags · fresh moves from consolidation or downtrends"
        emoji="🌱"
        candidates={firstStage}
        accent="blue"
      />
    </>
  );
}

function SectionView({
  title, subtitle, emoji, candidates, accent,
}: {
  title: string;
  subtitle: string;
  emoji: string;
  candidates: any[];
  accent: 'green' | 'blue';
}) {
  const [limit, setLimit] = useState(10);
  const [stages, setStages] = useState<Set<Stage>>(new Set(['prime', 'forming', 'early', 'late']));
  const [sort, setSort] = useState<SortMode>('score');

  const filtered = useMemo(() => {
    const list = candidates.filter(c => stages.has(c.stage));
    if (sort === 'stage') {
      list.sort((a, b) => {
        const diff = STAGE_ORDER[a.stage as Stage] - STAGE_ORDER[b.stage as Stage];
        if (diff !== 0) return diff;
        return b.score - a.score;
      });
    } else {
      list.sort((a, b) => b.score - a.score);
    }
    return list;
  }, [candidates, stages, sort]);

  const visible = filtered.slice(0, limit);
  const accentColor = accent === 'green' ? 'text-terminal-green' : 'text-terminal-blue';

  const toggleStage = (s: Stage) => {
    setStages(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 my-6 text-terminal-gray-dim">
        <span className="font-mono text-xs">═══════</span>
        <span className={`font-mono text-xs ${accentColor} uppercase tracking-widest`}>
          {emoji} {title}
        </span>
        <span className="font-mono text-xs flex-1">═══════════════════════════════════════════</span>
      </div>
      <p className="text-text-muted text-[10px] font-mono mb-4 -mt-3">{subtitle}</p>

      {candidates.length === 0 ? (
        <div className="text-center py-8 text-text-muted font-mono text-sm">
          no {title} found in today's scan
        </div>
      ) : (
        <>
          <div className="bg-bg-card border border-terminal-gray-dim/40 rounded-sm p-3 mb-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-text-muted text-[10px] font-mono uppercase tracking-widest mr-1">stage</span>
              {(['prime', 'forming', 'early', 'late'] as Stage[]).map(s => (
                <button
                  key={s}
                  onClick={() => toggleStage(s)}
                  className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded-sm transition ${
                    stages.has(s)
                      ? `border-terminal-green text-terminal-green bg-terminal-green/10`
                      : 'border-terminal-gray-dim text-text-muted hover:text-text-dim'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-[10px] font-mono uppercase tracking-widest">sort</span>
                <button
                  onClick={() => setSort('score')}
                  className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded-sm ${
                    sort === 'score' ? 'border-terminal-green text-terminal-green' : 'border-terminal-gray-dim text-text-muted'
                  }`}
                >score</button>
                <button
                  onClick={() => setSort('stage')}
                  className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded-sm ${
                    sort === 'stage' ? 'border-terminal-green text-terminal-green' : 'border-terminal-gray-dim text-text-muted'
                  }`}
                >stage</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-[10px] font-mono uppercase tracking-widest">show</span>
                {[5, 10, 20, 50].map(n => (
                  <button
                    key={n}
                    onClick={() => setLimit(n)}
                    className={`px-2 py-0.5 text-[10px] font-mono tabular-nums border rounded-sm ${
                      limit === n ? 'border-terminal-green text-terminal-green' : 'border-terminal-gray-dim text-text-muted'
                    }`}
                  >{n}</button>
                ))}
              </div>
            </div>
            <div className="text-text-muted text-[10px] font-mono">
              showing {visible.length} of {filtered.length} matching · {candidates.length} in section
            </div>
          </div>

          <div className="space-y-3">
            {visible.map(c => (
              <CandidateCard key={c.ticker} candidate={c} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-text-muted font-mono text-sm">
              no candidates match the filter
            </div>
          )}
        </>
      )}
    </section>
  );
}
