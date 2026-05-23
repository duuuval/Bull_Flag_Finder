'use client';

import { useEffect, useState } from 'react';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="back to top"
      className={`fixed bottom-4 right-4 z-20 w-10 h-10 rounded-sm border border-terminal-green/50 bg-bg-card/80 backdrop-blur-sm text-terminal-green font-mono text-base flex items-center justify-center transition-opacity hover:bg-bg-card hover:border-terminal-green ${
        visible ? 'opacity-90' : 'opacity-0 pointer-events-none'
      }`}
    >
      ▲
    </button>
  );
}

