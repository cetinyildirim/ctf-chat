import { cn } from '@/lib/utils';

interface KbdHintProps {
  keys: string[];
  className?: string;
}

export function KbdHint({ keys, className }: KbdHintProps) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {keys.map((k, i) => (
        <kbd
          key={i}
          className="inline-flex items-center justify-center min-w-5 rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[10px] font-mono text-muted-fg"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}
