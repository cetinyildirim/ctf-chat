import { cn } from '@/lib/utils';

/** Flag of Türkiye with the official 2:3 proportions and crescent/star geometry. */
export function TurkishFlag({ className, title = 'Türk Bayrağı' }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 -30000 90000 60000" role="img" aria-label={title} className={cn('h-6 w-9', className)}>
      <title>{title}</title>
      <path fill="#e30a17" d="M0-30000h90000v60000H0z" />
      <path
        fill="#fff"
        d="m41750 0 13568-4408-8386 11541V-7133l8386 11541zm925 8021a15000 15000 0 1 1 0-16042 12000 12000 0 1 0 0 16042z"
      />
    </svg>
  );
}
