import Header from '@/components/Header';
import { Divider } from '@/components/ASCIIFlair';

export default function AboutPage() {
  return (
    <>
      <Header subtitle="methodology" />
      <main className="max-w-3xl mx-auto px-4 py-6 relative z-10">
        <h1 className="font-display text-4xl text-terminal-green glow-sm tracking-tight mb-2">
          WHAT IS THIS
        </h1>
        <p className="text-text-dim text-sm mb-6">
          A daily bull flag scanner. No paywall, no email signup, no algorithm tweaks based on subscription tier.
          The scan runs every weekday after market close. Whatever it finds is what you see.
        </p>

        <Divider label="the pattern" />

        <Section title="what a bull flag is">
          <p>
            Two parts. First, a <span className="text-terminal-green">pole</span> — a sharp, decisive rally on
            elevated volume. Then a <span className="text-terminal-green">flag</span> — a controlled pullback or sideways
            drift over a few days to a few weeks, on declining volume. The pattern says: "the move was real,
            sellers are exhausted, the trend wants to continue."
          </p>
          <p className="mt-2">
            BFF doesn't predict the breakout. It surfaces stocks <em>setting up</em> the pattern, so you can
            set a limit order at structural support and walk away.
          </p>
        </Section>

        <Section title="the qualification gates">
          <ul className="space-y-1 font-mono text-xs">
            <li>· pole magnitude ≥ 20%</li>
            <li>· pole within the last 60 days, recent high within last 30</li>
            <li>· days since high: 3–20 (1–4 trading weeks)</li>
            <li>· pullback ≤ 20% from the recent high</li>
            <li>· current price above the 50-EMA</li>
            <li>· at least one pole day with 1.5x+ volume</li>
            <li>· price ≥ $5</li>
            <li>· universe: S&P 500 + 400 + 600</li>
          </ul>
        </Section>

        <Divider label="the score" />

        <Section title="100 points · three categories">
          <div className="font-mono text-xs space-y-3">
            <div>
              <div className="text-terminal-green uppercase tracking-widest mb-1">pole · 35 pts</div>
              <ul className="text-text-dim space-y-0.5">
                <li>magnitude (15) · how big was the move</li>
                <li>velocity (10) · how fast did it happen</li>
                <li>volume (10) · was there institutional buying</li>
              </ul>
            </div>
            <div>
              <div className="text-terminal-green uppercase tracking-widest mb-1">flag · 35 pts</div>
              <ul className="text-text-dim space-y-0.5">
                <li>tightness (20) · shallower pullback = stronger setup</li>
                <li>volume contraction (10) · sellers exhausted</li>
                <li>position vs EMAs (5) · above 10-EMA is best</li>
              </ul>
            </div>
            <div>
              <div className="text-terminal-green uppercase tracking-widest mb-1">context · 30 pts</div>
              <ul className="text-text-dim space-y-0.5">
                <li>relative strength (15) · 60-day return percentile</li>
                <li>trend stack (10) · 20-EMA over 50-EMA, 50 rising</li>
                <li>market regime (5) · SPY above 50-day MA</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section title="stage tells you the lifecycle">
          <div className="font-mono text-xs space-y-1">
            <div>🌱 <span className="text-terminal-gray">early (3-4d)</span> · setup forming, watch develop</div>
            <div>🔨 <span className="text-terminal-blue">forming (5-6d)</span> · could trigger soon</div>
            <div>🎯 <span className="text-terminal-green">prime (7-14d)</span> · peak quality window</div>
            <div>⏰ <span className="text-terminal-amber">late (15-20d)</span> · still tradable, momentum fading</div>
          </div>
          <p className="mt-3 text-text-dim text-xs">
            Score reflects setup quality. Stage reflects how ripe it is to trade. A high-scored early-stage
            candidate is a great watchlist add — not necessarily a same-day trade.
          </p>
        </Section>

        <Divider label="how to use" />

        <Section title="the workflow">
          <ol className="space-y-2 text-sm list-decimal list-inside text-text-dim">
            <li>open the scanner — see today's candidates ranked by score</li>
            <li>filter to <span className="text-terminal-green">prime</span> stage to see what's actionable today</li>
            <li>click <code className="text-terminal-green">chart →</code> to view on TradingView</li>
            <li>if the setup looks clean, set a limit order at the suggested entry (20-EMA)</li>
            <li>set a stop at the suggested level (below the flag low or 50-EMA)</li>
            <li>walk away</li>
          </ol>
        </Section>

        <Section title="what bff doesn't do">
          <ul className="space-y-1 text-sm text-text-dim">
            <li>· no automated trading</li>
            <li>· no recommendations on position sizing</li>
            <li>· no tracking your actual trades</li>
            <li>· no opinion on whether you should be trading at all</li>
          </ul>
          <p className="mt-3 text-text-dim text-xs">
            Suggested entry/stop/target are starting points, not advice. Every chart should be eyeballed before
            committing capital. If the setup doesn't look right to you, skip it.
          </p>
        </Section>

        <Divider />

        <p className="text-text-muted text-[10px] font-mono text-center mt-8 opacity-60">
          built on github actions + vercel + yahoo finance · no api keys required ·{' '}
          <a href="https://github.com" className="hover:text-terminal-green underline">source</a>
        </p>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="font-mono text-[10px] uppercase tracking-widest text-terminal-green mb-2">
        ▸ {title}
      </h2>
      <div className="text-text text-sm leading-relaxed">{children}</div>
    </section>
  );
}
