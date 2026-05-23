import Link from 'next/link';
import { BFFLogoSmall } from './ASCIIFlair';

export default function Header({ subtitle }: { subtitle?: string }) {
  return (
    <header className="border-b border-terminal-gray-dim/30 bg-bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="group">
          <div className="flex items-baseline gap-2">
            <BFFLogoSmall />
            <span className="hidden sm:inline text-text-muted text-[10px] font-mono uppercase tracking-widest">
              bull flag finder
            </span>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider">
          <Link
            href="/"
            className="px-2 py-1 text-text-dim hover:text-terminal-green transition"
          >
            scan
          </Link>
          <Link
            href="/52w"
            className="px-2 py-1 text-text-dim hover:text-terminal-green transition"
          >
            52w
          </Link>
          <Link
            href="/about"
            className="px-2 py-1 text-text-dim hover:text-terminal-green transition"
          >
            ?
          </Link>
        </nav>
      </div>
      {subtitle && (
        <div className="max-w-5xl mx-auto px-4 pb-2">
          <div className="text-text-muted text-[10px] font-mono">{subtitle}</div>
        </div>
      )}
    </header>
  );
}
