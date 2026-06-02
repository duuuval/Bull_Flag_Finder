import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { BFFLogoLarge, Divider } from '@/components/ASCIIFlair';
import BackToTop from '@/components/BackToTop';
import ArchiveBrowser from './ArchiveBrowser';

// Re-read the directory on each request so newly committed scans show up
// without a manual rebuild. (Vercel also rebuilds on every scan commit, so
// this is belt-and-suspenders, but it keeps the listing correct regardless.)
export const dynamic = 'force-dynamic';

function listScanDates(): string[] {
  try {
    const dir = path.join(process.cwd(), 'public', 'scans');
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) // YYYY-MM-DD only
      .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)); // newest first
  } catch {
    return [];
  }
}

export default function ArchivePage() {
  const dates = listScanDates();

  return (
    <>
      <main className="max-w-5xl mx-auto px-4 py-6 relative z-10">
        <section className="mb-3 relative">
          <Link
            href="/"
            aria-label="back to today"
            className="absolute top-0 right-0 px-2 py-1 text-text-dim hover:text-terminal-green transition text-[11px] font-mono uppercase tracking-wider"
          >
            today
          </Link>
          <BFFLogoLarge />
          <p className="text-text-muted text-xs mt-2 font-mono">
            archive · past S&amp;P 1500 scans
          </p>
          <p className="text-terminal-green text-xs mt-1 font-mono">
            60% of the time, it works every time.
          </p>
        </section>

        <Divider label="archive" />

        <ArchiveBrowser dates={dates} />
      </main>

      <BackToTop />
    </>
  );
}
