import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0e0a',
          card: '#0f1410',
          elevated: '#141a14',
        },
        terminal: {
          green: '#00ff66',
          'green-dim': '#00cc52',
          'green-glow': '#7fff9f',
          amber: '#ffaa00',
          red: '#ff3355',
          blue: '#5599ff',
          gray: '#5a6b5a',
          'gray-dim': '#3a453a',
        },
        text: {
          DEFAULT: '#d4e0d4',
          dim: '#7a8a7a',
          muted: '#4a554a',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['"VT323"', '"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'scan-line': 'scan-line 8s linear infinite',
        'flicker': 'flicker 0.15s infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 8px currentColor)' },
          '50%': { opacity: '0.7', filter: 'drop-shadow(0 0 16px currentColor)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.96' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
