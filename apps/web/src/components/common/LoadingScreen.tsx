'use client';
import { motion } from 'framer-motion';

export function LoadingScreen({ label = 'Establishing secure channel...' }: { label?: string }) {
  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-bg">
      <div className="absolute inset-0 bg-grid-fade" />
      <div className="relative flex flex-col items-center gap-6">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative"
        >
          <div className="h-20 w-20 rounded-2xl glass-strong flex items-center justify-center shadow-glow-cyan">
            <div className="font-mono text-2xl font-bold text-gradient-cyan">SY</div>
          </div>
          <motion.div
            className="absolute -inset-2 rounded-3xl border border-accent-cyan/40"
            animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.2, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-fg-subtle">
          <span className="h-2 w-2 rounded-full bg-accent-cyan animate-pulse-glow" />
          {label}
        </div>
      </div>
    </div>
  );
}
