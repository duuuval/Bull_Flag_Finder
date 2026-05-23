'use client';

import { useState, useMemo } from 'react';
import CandidateCard from '@/components/CandidateCard';

type Stage = 'early' | 'forming' | 'prime' | 'late';
type SortMode = 'score' | 'stage';

const STAGE_ORDER: Record<Stage, number> = {
  prime: 0,
  forming: 1,
  early: 2,
  late: 3,
};

export default function ScannerControls({ candidates }: { candidates: any[] }) {
  const [limit, setLimit] = useState(10);
  const [stages, setStages] = useState<Set<Stage>>(
    new Set(['prime', 'forming', 'early', 'late'])
  );
  const [sort, setSort] = useState<SortMode>('score');

  const filtered = useMemo(() => {
    const filteredList = candidates.filter(c => stages.has(c.stage));
    if (sort === 'stage') {
      filteredList.sort((a, b) => {
        const stageDiff = STAGE_ORDER[a.stage as Stage] - STAGE_ORDER[b.stage as Stage];
        if (stageDiff !== 0) return stageDiff;
        return b.score - a.score;
      });
    } else {
      filteredList.sort((a, b) => b.score - a.score);
    }
    return filteredList;
  }, [candidates, stages, sort]);

  const visible = filtered.slice(0, limit);

  const toggleStage = (stage: Stage) => {
    setStages(prev => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  };

  return (
    <div>
      {/* Controls */}
      <div className="bg-bg-card border border-terminal-gray-dim/40 rounded-sm p-3 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-text-muted text-[10px] font-mono uppercase tracking-widest mr-1">stage</span>
          {(['prime', 'forming', 'early', 'late'] as Stage[]).map(s => (
            <button
              key={s}
              onClick={() => toggleStage(s)}
              className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded-sm transition ${
                stages.has(s)
                  ? 'border-terminal-green text-terminal-green bg-terminal-green/10'
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
                sort === 'score'
                  ? 'border-terminal-green text-terminal-green'
                  : 'border-terminal-gray-dim text-text-muted'
              }`}
            >
              score
            </button>
            <button
              onClick={() => setSort('stage')}
              className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded-sm ${
                sort === 'stage'
                  ? 'border-terminal-green text-terminal-green'
                  : 'border-terminal-gray-dim text-text-muted'
              }`}
            >
              stage
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-text-muted text-[10px] font-mono uppercase tracking-widest">show</span>
            {[5, 10, 20, 50].map(n => (
              <button
                key={n}
                onClick={() => setLimit(n)}
                className={`px-2 py-0.5 text-[10px] font-mono tabular-nums border rounded-sm ${
                  limit === n
                    ? 'border-terminal-green text-terminal-green'
                    : 'border-terminal-gray-dim text-text-muted'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="text-text-muted text-[10px] font-mono">
          showing {visible.length} of {filtered.length} matching · {candidates.length} total
        </div>
      </div>

      {/* Candidate grid */}
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
    </div>
  );
}
