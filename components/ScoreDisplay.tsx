export default function ScoreDisplay({
  score,
  size = 'md',
}: {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const color = scoreColor(score);
  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-5xl',
  }[size];

  return (
    <div className="inline-flex flex-col items-center font-display leading-none">
      <div className="flex items-baseline">
        <span className="text-terminal-gray-dim text-[10px] font-mono">┌</span>
        <span className={`${sizeClasses} ${color} font-bold tabular-nums px-1`}>
          {score}
        </span>
        <span className="text-terminal-gray-dim text-[10px] font-mono">┐</span>
      </div>
      <div className="text-terminal-gray-dim text-[8px] font-mono tracking-widest">SCORE</div>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 85) return 'text-terminal-green-glow glow';
  if (score >= 70) return 'text-terminal-green glow-sm';
  if (score >= 55) return 'text-terminal-amber';
  if (score >= 40) return 'text-terminal-amber/70';
  return 'text-terminal-red/80';
}

export function ScoreInline({ score }: { score: number }) {
  return (
    <span className={`font-display font-bold tabular-nums ${scoreColor(score)}`}>
      {score}
    </span>
  );
}
