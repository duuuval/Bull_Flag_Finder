'use client';

import { useState } from 'react';
import StageBadge from './StageBadge';
import ScoreDisplay from './ScoreDisplay';

type Candidate = {
  ticker: string;
  name: string;
  exchange: string;
  price: number;
  setupType: 'continuation' | 'first-stage';
  score: number;
  subscores: Record<string, number>;
  breakdown: Record<string, number>;
  stage: 'early' | 'forming' | 'prime' | 'late';
  daysInFlag: number;
  pattern: {
    polePct: number;
    poleDays: number;
    poleStartDate: string;
    poleStartPrice: number;
    recentHigh: number;
    recentHighDate: string;
    pullbackPct: number;
    flagLow: number;
    volumeContraction: number;
    poleVolumeRatio: number;
    distAbove20Ema: number;
    direction: 'descending' | 'flat' | 'ascending';
  };
  base?: {
    baseDays: number;
    baseRange: number;
    prePoleSlope: number;
  };
  ema: {
    ema10: number | null;
    ema20: number | null;
    ema50: number | null;
    ema50Rising: boolean;
  };
  levels: {
    entry: number;
    stop: number;
    target: number;
    riskPct: number;
    rewardPct: number;
    rr: number | null;
  };
  rsPercentile: number;
  return60dPct: number;
  chartUrl: string;
};

const DIRECTION_DISPLAY: Record<string, { icon: string; label: string; color: string }> = {
  descending: { icon: '↘', label: 'descending', color: 'text-terminal-green' },
  flat: { icon: '→', label: 'flat', color: 'text-terminal-blue' },
  ascending: { icon: '↗', label: 'ascending', color: 'text-terminal-amber' },
};

export default function CandidateCard({ candidate }: { candidate: Candidate }) {
  const [expanded, setExpanded] = useState(false);
  const c = candidate;
  const isFirstStage = c.setupType === 'first-stage';

  const polePct = (c.pattern.polePct * 100).toFixed(1);
  const pullbackPct = (c.pattern.pullbackPct * 100).toFixed(1);
  const distPct = (c.pattern.distAbove20Ema * 100).toFixed(1);
  const rsRank = Math.round(c.rsPercentile * 100);
  const dir = DIRECTION_DISPLAY[c.pattern.direction] ?? DIRECTION_DISPLAY.flat;

  return (
    <div className="card-interactive bg-bg-card border border-terminal-gray-dim/40 rounded-sm p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-display text-3xl font-bold text-text tracking-tight">{c.ticker}</span>
            <span className="text-terminal-gray-dim text-xs">·</span>
            <span className="font-mono text-text-dim text-sm tabular-nums">${c.price.toFixed(2)}</span>
          </div>
          <div className="text-text-muted text-[10px] uppercase tracking-wider truncate">
            {c.name} {c.exchange && `· ${c.exchange}`}
          </div>
        </div>
        <ScoreDisplay score={c.score} size="md" />
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <StageBadge stage={c.stage} daysInFlag={c.daysInFlag} />
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-terminal-gray-dim/40 bg-bg-elevated ${dir.color} text-[10px] tracking-wider uppercase`}>
          <span>{dir.icon}</span>
          <span>{dir.label}</span>
        </span>
        {!isFirstStage && rsRank >= 75 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-terminal-green/30 bg-terminal-green/5 text-terminal-green text-[10px] tracking-wider uppercase">
            RS {rsRank}
          </span>
        )}
        {isFirstStage && c.base && c.base.baseDays >= 40 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-terminal-blue/30 bg-terminal-blue/5 text-terminal-blue text-[10px] tracking-wider uppercase">
            base {c.base.baseDays}d
          </span>
        )}
        {c.ema.ema50Rising && c.ema.ema20 && c.ema.ema50 && c.ema.ema20 > c.ema.ema50 && (
          <span className="text-terminal-green-dim text-[10px] tracking-wider uppercase">↗ stacked</span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
        <div>
          <div className="text-text-muted text-[9px] tracking-widest uppercase">Pole</div>
          <div className="font-mono text-text tabular-nums">+{polePct}% <span className="text-text-muted">/ {c.pattern.poleDays}d</span></div>
        </div>
        <div>
          <div className="text-text-muted text-[9px] tracking-widest uppercase">Pullback</div>
          <div className="font-mono text-text tabular-nums">-{pullbackPct}%</div>
        </div>
        <div>
          <div className="text-text-muted text-[9px] tracking-widest uppercase">From EMA</div>
          <div className="font-mono text-text tabular-nums">{c.pattern.distAbove20Ema >= 0 ? '+' : ''}{distPct}%</div>
        </div>
        <div>
          <div className="text-text-muted text-[9px] tracking-widest uppercase">Vol</div>
          <div className="font-mono text-text tabular-nums">{c.pattern.poleVolumeRatio.toFixed(1)}x</div>
        </div>
      </div>

      <div className="bg-bg-elevated border border-terminal-gray-dim/30 rounded-sm p-2 mb-3">
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <div className="text-text-muted text-[9px] tracking-widest uppercase">Entry</div>
            <div className="font-mono text-terminal-green tabular-nums">${c.levels.entry.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-text-muted text-[9px] tracking-widest uppercase">Stop</div>
            <div className="font-mono text-terminal-red/80 tabular-nums">${c.levels.stop.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-text-muted text-[9px] tracking-widest uppercase">Target</div>
            <div className="font-mono text-terminal-green-glow tabular-nums">${c.levels.target.toFixed(2)}</div>
          </div>
        </div>
        {c.levels.rr && (
          <div className="text-text-muted text-[10px] mt-1 font-mono">
            risk {(c.levels.riskPct * 100).toFixed(1)}% · reward {(c.levels.rewardPct * 100).toFixed(1)}% · R/R {c.levels.rr.toFixed(1)}
            {isFirstStage && <span className="text-terminal-blue ml-2">· full-pole target</span>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <a
          href={c.chartUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center px-3 py-1.5 bg-terminal-green/10 border border-terminal-green/40 text-terminal-green text-xs font-mono uppercase tracking-wider hover:bg-terminal-green/20 transition"
        >chart →</a>
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-1.5 bg-bg-elevated border border-terminal-gray-dim text-text-dim text-xs font-mono uppercase tracking-wider hover:border-terminal-gray hover:text-text"
        >{expanded ? 'less' : 'more'}</button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-terminal-gray-dim/30">
          <div className="text-[10px] text-terminal-gray font-mono uppercase tracking-widest mb-2">
            score breakdown {isFirstStage ? '(first-stage)' : '(continuation)'}
          </div>
          {isFirstStage ? (
            <div className="grid grid-cols-4 gap-3 text-[11px] mb-3">
              <div>
                <div className="text-text-muted text-[9px] uppercase">Pole {c.subscores.pole}/30</div>
                <div className="font-mono space-y-0.5 text-text-dim">
                  <div>mag {c.breakdown.poleMagnitude}</div>
                  <div>vel {c.breakdown.poleVelocity}</div>
                  <div>vol {c.breakdown.poleVolume}</div>
                </div>
              </div>
              <div>
                <div className="text-text-muted text-[9px] uppercase">Flag {c.subscores.flag}/30</div>
                <div className="font-mono space-y-0.5 text-text-dim">
                  <div>vol {c.breakdown.flagContraction}</div>
                  <div>entry {c.breakdown.flagEntry}</div>
                  <div>pb {c.breakdown.flagPullback}</div>
                </div>
              </div>
              <div>
                <div className="text-text-muted text-[9px] uppercase">Base {c.subscores.base}/35</div>
                <div className="font-mono space-y-0.5 text-text-dim">
                  <div>len {c.breakdown.baseLength}</div>
                  <div>tight {c.breakdown.baseTightness}</div>
                  <div>p/b {c.breakdown.basePoleRatio}</div>
                </div>
              </div>
              <div>
                <div className="text-text-muted text-[9px] uppercase">Mkt {c.subscores.context}/5</div>
                <div className="font-mono space-y-0.5 text-text-dim">
                  <div>{c.breakdown.ctxMarket}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 text-[11px] mb-3">
              <div>
                <div className="text-text-muted text-[9px] uppercase">Pole {c.subscores.pole}/35</div>
                <div className="font-mono space-y-0.5 text-text-dim">
                  <div>mag {c.breakdown.poleMagnitude}</div>
                  <div>vel {c.breakdown.poleVelocity}</div>
                  <div>vol {c.breakdown.poleVolume}</div>
                </div>
              </div>
              <div>
                <div className="text-text-muted text-[9px] uppercase">Flag {c.subscores.flag}/35</div>
                <div className="font-mono space-y-0.5 text-text-dim">
                  <div>pb {c.breakdown.flagPullback}</div>
                  <div>vol {c.breakdown.flagContraction}</div>
                  <div>entry {c.breakdown.flagEntry}</div>
                </div>
              </div>
              <div>
                <div className="text-text-muted text-[9px] uppercase">Ctx {c.subscores.context}/30</div>
                <div className="font-mono space-y-0.5 text-text-dim">
                  <div>RS {c.breakdown.ctxRs}</div>
                  <div>trend {c.breakdown.ctxTrend}</div>
                  <div>mkt {c.breakdown.ctxMarket}</div>
                </div>
              </div>
            </div>
          )}

          <div className="text-[10px] text-terminal-gray font-mono uppercase tracking-widest mb-2">Pattern details</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono text-text-dim">
            <div>pole start: <span className="text-text">${c.pattern.poleStartPrice.toFixed(2)} ({c.pattern.poleStartDate})</span></div>
            <div>recent high: <span className="text-text">${c.pattern.recentHigh.toFixed(2)} ({c.pattern.recentHighDate})</span></div>
            <div>flag low: <span className="text-text">${c.pattern.flagLow.toFixed(2)}</span></div>
            <div>vol contraction: <span className="text-text">{c.pattern.volumeContraction.toFixed(2)}x</span></div>
            <div>20-EMA: <span className="text-text">${c.ema.ema20?.toFixed(2) ?? '—'}</span></div>
            <div>50-EMA: <span className="text-text">${c.ema.ema50?.toFixed(2) ?? '—'} {c.ema.ema50Rising && '↗'}</span></div>
            <div>60d ret: <span className="text-text">{(c.return60dPct * 100).toFixed(1)}%</span></div>
            <div>direction: <span className={dir.color}>{dir.icon} {dir.label}</span></div>
            {c.base && (
              <>
                <div>base days: <span className="text-text">{c.base.baseDays}</span></div>
                <div>base range: <span className="text-text">{(c.base.baseRange * 100).toFixed(1)}%</span></div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
