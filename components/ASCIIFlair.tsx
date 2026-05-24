// ASCII flair components

export function BFFLogoLarge() {
  return (
    <pre className="ascii text-terminal-green glow-sm text-[8px] leading-[1.1] sm:text-xs sm:leading-[1.1] inline-block">
{` /$$$$$$$  /$$$$$$$$ /$$$$$$$$
| $$__  $$| $$_____/| $$_____/
| $$  / $$| $$      | $$      
| $$$$$$$ | $$$$$   | $$$$$   
| $$__  $$| $$__/   | $$__/   
| $$  / $$| $$      | $$      
| $$$$$$$/| $$      | $$      
|_______/ |__/      |__/      `}
                              
                              
                              

      
    </pre>
  );
}

export function BFFLogoSmall() {
  return (
    <span className="font-display text-terminal-green glow-sm text-3xl tracking-tight">
      BFF
    </span>
  );
}

export function Divider({ label }: { label?: string }) {
  if (label) {
    return (
      <div className="flex items-center gap-3 my-6 text-terminal-gray-dim overflow-hidden">
        <span className="font-mono text-xs shrink-0">═══════</span>
        <span className="font-mono text-xs text-terminal-green uppercase tracking-widest shrink-0">{label}</span>
        <span className="font-mono text-xs flex-1 overflow-hidden whitespace-nowrap">
          {/* Make this string long enough for wide desktop screens; the overflow classes will clip it cleanly on mobile */}
          ════════════════════════════════════════════════════════════════════════════════════════════
        </span>
      </div>
    );
  }
  return (
    <div className="my-6 text-terminal-gray-dim font-mono text-xs overflow-hidden whitespace-nowrap">
      {'═'.repeat(80)}
    </div>
  );
}

export function EmptyFlag({ message }: { message?: string }) {
  // Proper bull flag: pole rises bottom-left to top-right,
  // flag drifts slightly down-right from the peak (consolidation).
  return (
    <div className="text-center py-12 px-4">
      <pre className="ascii text-terminal-gray inline-block text-xs leading-[1.1] text-left">
{`                ▲
               ╱ ╲___
              ╱      ╲___
             ╱           ╲
            ╱
           ╱
          ╱
         ╱
        ╱
       ╱
      ╱
     ╱
    ╱
   ╱
  ╱
 ╱`}
      </pre>
      <p className="text-terminal-gray mt-4 text-sm">
        {message || 'no flags today. markets need to move first.'}
      </p>
    </div>
  );
}

export function ScanComplete() {
  return (
    <pre className="ascii text-terminal-green-dim text-[10px] leading-[1.1] inline-block">
{`  ┌────────────────────────┐
  │  ✓  SCAN COMPLETE      │
  └────────────────────────┘`}
    </pre>
  );
}

export function TriggerBolt() {
  return (
    <pre className="ascii text-terminal-amber glow-sm text-[10px] leading-[1.1] inline-block">
{` ⚡
 ⚡⚡
⚡⚡⚡`}
    </pre>
  );
}
