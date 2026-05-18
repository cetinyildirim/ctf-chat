import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        bg: {
          DEFAULT: 'hsl(var(--bg) / <alpha-value>)',
          elev: 'hsl(var(--bg-elev) / <alpha-value>)',
          deep: 'hsl(var(--bg-deep) / <alpha-value>)',
        },
        panel: 'hsl(var(--panel) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          fg: 'hsl(var(--muted-fg) / <alpha-value>)',
        },
        fg: {
          DEFAULT: 'hsl(var(--fg) / <alpha-value>)',
          subtle: 'hsl(var(--fg-subtle) / <alpha-value>)',
        },
        accent: {
          cyan: 'hsl(var(--accent-cyan) / <alpha-value>)',
          violet: 'hsl(var(--accent-violet) / <alpha-value>)',
          emerald: 'hsl(var(--accent-emerald) / <alpha-value>)',
          rose: 'hsl(var(--accent-rose) / <alpha-value>)',
          amber: 'hsl(var(--accent-amber) / <alpha-value>)',
        },
        severity: {
          info: 'hsl(var(--accent-cyan) / <alpha-value>)',
          low: 'hsl(var(--accent-emerald) / <alpha-value>)',
          medium: 'hsl(var(--accent-amber) / <alpha-value>)',
          high: 'hsl(var(--accent-rose) / <alpha-value>)',
          critical: 'hsl(var(--accent-rose) / <alpha-value>)',
        },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 2px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 0 1px rgba(34,211,238,0.4), 0 0 24px -4px rgba(34,211,238,0.45)',
        'glow-violet': '0 0 0 1px rgba(167,139,250,0.4), 0 0 24px -4px rgba(167,139,250,0.45)',
        'glow-emerald': '0 0 0 1px rgba(52,211,153,0.4), 0 0 24px -4px rgba(52,211,153,0.45)',
        'glow-rose': '0 0 0 1px rgba(251,113,133,0.4), 0 0 24px -4px rgba(251,113,133,0.45)',
        glass: '0 1px 0 rgba(255,255,255,0.05) inset, 0 12px 32px -16px rgba(0,0,0,0.6)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(2px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(34,211,238,0.5)' },
          '50%': { boxShadow: '0 0 0 8px rgba(34,211,238,0)' },
        },
        marqueeSlow: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out both',
        shimmer: 'shimmer 1.4s linear infinite',
        'pulse-glow': 'pulseGlow 1.6s ease-out infinite',
        'marquee-slow': 'marqueeSlow 30s linear infinite',
      },
      backgroundImage: {
        'grid-fade':
          'radial-gradient(ellipse at top, hsla(189, 90%, 60%, 0.08), transparent 60%), radial-gradient(ellipse at bottom right, hsla(260, 80%, 70%, 0.08), transparent 50%)',
        'scanlines':
          'repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 3px)',
      },
    },
  },
  plugins: [animate],
};
export default config;
