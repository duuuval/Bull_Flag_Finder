'use client';

import { useState, useMemo } from 'react';
import CandidateCard from '@/components/CandidateCard';

type Stage = 'early' | 'forming' | 'prime' | 'late';
type SortMode = 'score' | 'stage';
type Accent = 'green' | 'blue' | 'amber';

const STAGE_ORDER: Record<Stage, number> = { prime: 0, forming: 1, early: 2, late: 3 };

export default function TwoSectionScanner({
  htf,
  continuation,
  firstStage,
}: {
  htf?: any[];
  continuation: any[];
  firstStage: any[];
}) {
  return (
    <>
      {htf && htf.length > 0 && (
        <SectionView
          title="high-tight flags"
          subtitle="rare big-pole, tight-pullback setups · ≥80% pole, ≤25% pullback, ≤40 days"
          emoji="⭐"
          candidates={htf}
          accent="amber"
          defaultLimit={5}
        />
      )}
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
  title, subtitle, emoji, candidates, accent, defaultLimit = 10,
}: {
  title: string;
  subtitle: string;
  emoji: string;
  candidates: any[];
  accent: Accent;
  defaultLimit?: number;
}) {
  const [limit, setLimit] = useState(defaultLimit);
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

  const accentText =
    accent === 'green' ? 'text-terminal-green'
    : accent === 'blue' ? 'text-terminal-blue'
    : 'text-terminal-amber';
  const accentDivider =
    accent === 'green' ? 'text-terminal-green/50'
    : accent === 'blue' ? 'text-terminal-blue/50'
    : 'text-terminal-amber/50';
  const accentGlow =
    accent === 'green' ? { textShadow: '0 0 8px rgba(74, 222, 128, 0.7), 0 0 16px rgba(74, 222, 128, 0.4)' }
    : accent === 'blue' ? { textShadow: '0 0 8px rgba(96, 165, 250, 0.7), 0 0 16px rgba(96, 165, 250, 0.4)' }
    : { textShadow: '0 0 8px rgba(251, 191, 36, 0.7), 0 0 16px rgba(251, 191, 36, 0.4)' };

  // Active-state pill colors match the section accent
  const activePillClass =
    accent === 'green' ? 'border-terminal-green text-terminal-green bg-terminal-green/10'
    : accent === 'blue' ? 'border-terminal-blue text-terminal-blue bg-terminal-blue/10'
    : 'border-terminal-amber text-terminal-amber bg-terminal-amber/10';
  const activeSortClass =
    accent === 'green' ? 'border-terminal-green text-terminal-green'
    : accent === 'blue' ? 'border-terminal-blue text-terminal-blue'
    : 'border-terminal-amber text-terminal-amber';

  const toggleStage = (s: Stage) => {
    setStages(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  return (
    <section className="mb-12">
      {/* Centered section header with minimal flanking dividers */}
      <div className="flex items-center justify-center gap-3 my-7">
        <span className={`font-mono text-base ${accentDivider} shrink-0`} aria-hidden>══</span>
        <span
          className={`font-display text-2xl sm:text-3xl ${accentText} uppercase tracking-widest text-center`}
          style={accentGlow}
        >
          <span className="mr-2 align-middle text-[1.2em]">{emoji}</span>
          {title}
        </span>
        <span className={`font-mono text-base ${accentDivider} shrink-0`} aria-hidden>══</span>
      </div>
      <p className="text-text-muted text-[10px] font-mono mb-4 -mt-3 text-center">{subtitle}</p>

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
                      ? activePillClass
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
                    sort === 'score' ? activeSortClass : 'border-terminal-gray-dim text-text-muted'
                  }`}
                >score</button>
                <button
                  onClick={() => setSort('stage')}
                  className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded-sm ${
                    sort === 'stage' ? activeSortClass : 'border-terminal-gray-dim text-text-muted'
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
                      limit === n ? activeSortClass : 'border-terminal-gray-dim text-text-muted'
                    }`}
                  >{n}</button>
                ))}
              </div>
            </div>
            <div className="text-text-muted text-[10px] font-mono">
              showing {visible.length} of {filtered.length} matching · {candidates.length} in section
            </div>
          </div>

          {/* Ranked list: rank prop passed into card, full horizontal width preserved */}
          <div className="space-y-3">
            {visible.map((c, idx) => (
              <CandidateCard key={c.ticker} candidate={c} rank={idx + 1} />
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
