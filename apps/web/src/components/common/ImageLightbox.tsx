'use client';

import * as React from 'react';
import { Minus, Plus, Scan, X } from 'lucide-react';
import { useI18n } from '@/components/providers/LocaleProvider';

const MIN_SCALE = 1;
const MAX_SCALE = 4;

/** Full-screen image preview. Clicking the backdrop closes it; the picture itself does not. */
export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [scale, setScale] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const drag = React.useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const setZoom = React.useCallback((next: number) => {
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    setScale(scale);
    if (scale === 1) setOffset({ x: 0, y: 0 });
  }, []);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === '+' || event.key === '=') setZoom(scale + 0.5);
      else if (event.key === '-' || event.key === '_') setZoom(scale - 0.5);
      else if (event.key === '0') setZoom(1);
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, scale, setZoom]);

  const onWheel = (event: React.WheelEvent) => {
    setZoom(scale + (event.deltaY < 0 ? 0.25 : -0.25));
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      onWheel={onWheel}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <div className="absolute right-4 top-4 flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
        <LightboxButton label={t.imageZoomOut} onClick={() => setZoom(scale - 0.5)} disabled={scale <= MIN_SCALE}>
          <Minus className="h-4 w-4" />
        </LightboxButton>
        <LightboxButton label={t.imageZoomReset} onClick={() => setZoom(1)} disabled={scale === 1}>
          <Scan className="h-4 w-4" />
        </LightboxButton>
        <LightboxButton label={t.imageZoomIn} onClick={() => setZoom(scale + 0.5)} disabled={scale >= MAX_SCALE}>
          <Plus className="h-4 w-4" />
        </LightboxButton>
        <LightboxButton label={t.commonClose} onClick={onClose}>
          <X className="h-4 w-4" />
        </LightboxButton>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => {
          event.stopPropagation();
          setZoom(scale > 1 ? 1 : 2);
        }}
        onPointerDown={(event) => {
          if (scale <= 1) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) return;
          setOffset({ x: start.ox + event.clientX - start.x, y: start.oy + event.clientY - start.y });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onWheel={onWheel}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          cursor: scale > 1 ? 'grab' : 'zoom-in',
        }}
        className="max-h-[88vh] max-w-[94vw] select-none object-contain"
      />
    </div>
  );
}

function LightboxButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-md bg-black/60 text-white hover:bg-black/80 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Thumbnail that opens the shared image in a lightbox instead of a new tab. */
export function LightboxImage({
  src,
  alt,
  className,
  frameClassName,
}: {
  src: string;
  alt: string;
  className?: string;
  frameClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={frameClassName ?? 'block max-w-md overflow-hidden rounded-md border border-white/10 bg-black/20 text-left'}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={className ?? 'max-h-72 w-full object-contain'} />
      </button>
      {open ? <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
