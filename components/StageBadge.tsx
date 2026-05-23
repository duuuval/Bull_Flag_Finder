type Stage = 'early' | 'forming' | 'prime' | 'late';

const STAGES: Record<Stage, { emoji: string; label: string; color: string; bg: string; border: string }> = {
  early: {
    emoji: '🌱',
    label: 'EARLY',
    color: 'text-terminal-gray',
    bg: 'bg-terminal-gray-dim/20',
    border: 'border-terminal-gray-dim',
  },
  forming: {
    emoji: '🔨',
    label: 'FORMING',
    color: 'text-terminal-blue',
    bg: 'bg-terminal-blue/10',
    border: 'border-terminal-blue/40',
  },
  prime: {
    emoji: '🎯',
    label: 'PRIME',
    color: 'text-terminal-green glow-sm',
    bg: 'bg-terminal-green/10',
    border: 'border-terminal-green',
  },
  late: {
    emoji: '⏰',
    label: 'LATE',
    color: 'text-terminal-amber',
    bg: 'bg-terminal-amber/10',
    border: 'border-terminal-amber/40',
  },
};

export default function StageBadge({ stage, daysInFlag }: { stage: Stage; daysInFlag?: number }) {
  const cfg = STAGES[stage] ?? STAGES.forming;
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border ${cfg.bg} ${cfg.border} ${cfg.color} font-mono text-[10px] tracking-wider uppercase`}
    >
      <span>{cfg.emoji}</span>
      <span className="font-bold">{cfg.label}</span>
      {daysInFlag != null && (
        <span className="opacity-60">· {daysInFlag}d</span>
      )}
    </div>
  );
}
