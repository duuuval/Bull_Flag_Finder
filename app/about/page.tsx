import Link from 'next/link';
import { BFFLogoLarge, Divider } from '@/components/ASCIIFlair';

export default function AboutPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-6 relative z-10">
      {/* Logo header — matches homepage. Back link top-right. */}
      <section className="mb-5 relative">
        <Link
          href="/"
          aria-label="back to scanner"
          className="absolute top-0 right-0 px-2 py-1 text-text-dim hover:text-terminal-green transition text-[11px] font-mono uppercase tracking-wider"
        >
          ← back
        </Link>
        <BFFLogoLarge />
        <p className="text-text-muted text-xs mt-2 font-mono">
          methodology · how the scan works
        </p>
      </section>

      <Divider label="what this is" />

      <Section title="the tool">
        <p>
          A daily bull flag scanner for the S&amp;P 1500. No paywall, no email signup, no algorithm tweaks
          based on subscription tier. The scan runs every weekday after market close. Whatever it finds is
          what you see.
        </p>
        <p className="mt-2">
          BFF surfaces stocks <em>setting up</em> the pattern so you can set a limit order at structural
          support and walk away. It doesn't predict breakouts. It points the camera.
        </p>
      </Section>

      <Divider label="the pattern" />

      <Section title="what a bull flag is">
        <p>
          Two parts. First, a <span className="text-terminal-green">pole</span> — a sharp, decisive rally on
          elevated volume. Then a <span className="text-terminal-green">flag</span> — a controlled pullback
          or sideways drift over a few days to a few weeks, on declining volume. When price tests structural
          support like the 20-EMA and the trend resumes, that's the trade.
        </p>
      </Section>

      <Section title="two setup types · scored separately">
        <p>
          Not every bull flag is the same trade. BFF classifies each candidate into one of two buckets
          based on what the stock was doing <em>before</em> the pole, and scores them on different rubrics.
        </p>
        <div className="mt-3 space-y-3 font-mono text-xs">
          <div className="border-l-2 border-terminal-green/50 pl-3">
            <div className="text-terminal-green uppercase tracking-widest mb-1">💪 strength · continuation</div>
            <p className="text-text-dim font-sans text-sm">
              The stock was already in an established uptrend before the pole. Higher probability, lower
              payoff — trust the existing trend, expect 5–15% continuation.
            </p>
          </div>
          <div className="border-l-2 border-terminal-blue/50 pl-3">
            <div className="text-terminal-blue uppercase tracking-widest mb-1">🌱 base breakouts · first-stage</div>
            <p className="text-text-dim font-sans text-sm">
              The stock was basing, declining, or just turning up before the pole. Lower probability,
              higher payoff — catch a new Stage 2 trend early, let the winners ride 30–50%+.
            </p>
          </div>
        </div>
        <p className="mt-3 text-text-dim text-xs">
          The classifier: if the 50-EMA rose more than 10% in the 60 days before the pole started, it's
          continuation. Otherwise, first-stage.
        </p>
      </Section>

      <Divider label="qualification" />

      <Section title="hard gates · all candidates">
        <ul className="space-y-1 font-mono text-xs">
          <li>· universe: S&amp;P 500 + 400 + 600</li>
          <li>· price ≥ $5</li>
          <li>· current price above the 50-EMA (trend intact)</li>
          <li>· pole magnitude: 20–80%</li>
          <li>· pole duration: 3–30 days</li>
          <li>· at least one pole day at 1.5x+ avg volume</li>
          <li>· flag duration: 3–20 days since pole top</li>
          <li>· pullback ≤ 20% from the pole top</li>
          <li>· current price within ±5% of the 20-EMA</li>
        </ul>
      </Section>

      <Divider label="scoring" />

      <Section title="strength trades · 100 pts">
        <div className="font-mono text-xs space-y-3">
          <div>
            <div className="text-terminal-green uppercase tracking-widest mb-1">pole · 35 pts</div>
            <ul className="text-text-dim space-y-0.5">
              <li>magnitude (15) · how big was the move</li>
              <li>velocity (10) · how fast did it happen</li>
              <li>volume signature (10) · institutional footprint</li>
            </ul>
          </div>
          <div>
            <div className="text-terminal-green uppercase tracking-widest mb-1">flag · 35 pts</div>
            <ul className="text-text-dim space-y-0.5">
              <li>pullback quality (20) · clean test of the 20-EMA</li>
              <li>volume contraction (10) · sellers exhausted</li>
              <li>entry quality (5) · proximity to support</li>
            </ul>
          </div>
          <div>
            <div className="text-terminal-green uppercase tracking-widest mb-1">context · 30 pts</div>
            <ul className="text-text-dim space-y-0.5">
              <li>relative strength rank (15) · 60-day percentile vs universe</li>
              <li>trend stack (10) · EMAs aligned bullishly</li>
              <li>market regime (5) · SPY above 50-day MA</li>
            </ul>
          </div>
        </div>
        <p className="mt-3 text-text-dim text-xs">
          Pullback quality rewards landing cleanly at the 20-EMA, not having no pullback at all. A 7%
          pullback that tests support scores higher than a 2% pullback that leaves price 8% above the EMA.
          The buy signal is the test of support.
        </p>
      </Section>

      <Section title="base breakouts · 100 pts">
        <div className="font-mono text-xs space-y-3">
          <div>
            <div className="text-terminal-blue uppercase tracking-widest mb-1">pole · 30 pts</div>
            <ul className="text-text-dim space-y-0.5">
              <li>magnitude (15)</li>
              <li>velocity (10)</li>
              <li>volume signature (5)</li>
            </ul>
          </div>
          <div>
            <div className="text-terminal-blue uppercase tracking-widest mb-1">flag · 30 pts</div>
            <ul className="text-text-dim space-y-0.5">
              <li>volume contraction (15)</li>
              <li>entry quality (10)</li>
              <li>pullback quality (5)</li>
            </ul>
          </div>
          <div>
            <div className="text-terminal-blue uppercase tracking-widest mb-1">base · 35 pts</div>
            <ul className="text-text-dim space-y-0.5">
              <li>base length (15) · how long was the accumulation</li>
              <li>base tightness (15) · how narrow was the range</li>
              <li>pole-to-base ratio (5) · expansion vs the prior coil</li>
            </ul>
          </div>
          <div>
            <div className="text-terminal-blue uppercase tracking-widest mb-1">regime · 5 pts</div>
            <ul className="text-text-dim space-y-0.5">
              <li>market regime (5) · SPY above 50-day MA</li>
            </ul>
          </div>
        </div>
        <p className="mt-3 text-text-dim text-xs">
          RS rank is intentionally not scored here. First-stage stocks haven't been running long by
          definition — penalizing them for that defeats the purpose. Base quality replaces RS: a long,
          tight base before a sharp pole is the first-stage equivalent of "this setup has earned the right
          to break out."
        </p>
      </Section>

      <Divider label="stage" />

      <Section title="how ripe is the setup">
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

      <Divider label="trade levels" />

      <Section title="entry · stop · target">
        <ul className="space-y-1 font-mono text-xs">
          <li>· <span className="text-terminal-green">entry</span> = 20-EMA (the limit order price)</li>
          <li>· <span className="text-terminal-red">stop</span> = max(50-EMA, flag low × 0.99), or 7% from entry if that's too tight</li>
          <li>· <span className="text-terminal-green">target</span> = entry × (1 + pole × 0.5) for strength · × 1.0 for base breakouts</li>
        </ul>
        <p className="mt-3 text-text-dim text-xs">
          Continuation gets a conservative half-pole target — trust the trend, take the win. First-stage
          gets a full-pole target — asymmetric upside is the entire point of catching Stage 2 early.
        </p>
      </Section>

      <Divider label="how to use" />

      <Section title="the workflow">
        <ol className="space-y-2 text-sm list-decimal list-inside text-text-dim">
          <li>open the scanner — see today's candidates in both sections, ranked by score</li>
          <li>filter to <span className="text-terminal-green">prime</span> to see what's actionable today</li>
          <li>tap <code className="text-terminal-green">chart →</code> to verify the setup in the TradingView widget</li>
          <li>if it looks clean, set a limit order at the suggested entry</li>
          <li>set the stop at the suggested level</li>
          <li>walk away</li>
        </ol>
      </Section>

      <Section title="what bff doesn't do">
        <ul className="space-y-1 text-sm text-text-dim">
          <li>· no automated trading</li>
          <li>· no position sizing</li>
          <li>· no trade journaling — use your broker's history</li>
          <li>· no opinion on whether you should be trading at all</li>
        </ul>
        <p className="mt-3 text-text-dim text-xs">
          Entry/stop/target are starting points, not advice. Every chart should be eyeballed before
          committing capital. If the setup doesn't look right to you, skip it.
        </p>
      </Section>

      <Divider />

      <p className="text-text-muted text-[10px] font-mono text-center mt-8 opacity-60">
        built on github actions + vercel + yahoo finance · no api keys · $0/month
      </p>
    </main>
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
