'use client';

import * as React from 'react';
import { FileText, ImageIcon, Paperclip } from 'lucide-react';
import type { TicketAttachmentDto } from '@sydt/shared';
import { ImageLightbox } from '@/components/common/ImageLightbox';

function ImageChip({
  name,
  url,
  size,
  className,
  icon,
}: {
  name: string;
  url: string;
  size: string;
  className: string;
  icon: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {icon}
        <span className="max-w-[14rem] truncate">{name}</span>
        <span className="text-[10px] text-muted-fg">{size}</span>
      </button>
      {open ? <ImageLightbox src={url} alt={name} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Attachment links. The href hits the authenticated download route, which
 * re-checks ticket access on every request.
 */
export function TicketAttachmentList({ attachments }: { attachments: TicketAttachmentDto[] }) {
  if (attachments.length === 0) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5">
      {attachments.map((att) => {
        const image = att.mimeType.startsWith('image/');
        const Icon = image
          ? ImageIcon
          : att.mimeType === 'application/pdf' || att.mimeType.startsWith('text/')
            ? FileText
            : Paperclip;
        const className =
          'flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-fg-subtle transition-colors hover:border-accent-cyan/40 hover:text-fg';
        return (
          <li key={att.id}>
            {image ? (
              <ImageChip name={att.name} url={att.url} size={sizeLabel(att.size)} className={className} icon={<Icon className="h-3.5 w-3.5 text-accent-cyan" />} />
            ) : (
              <a href={att.url} target="_blank" rel="noreferrer" className={className}>
                <Icon className="h-3.5 w-3.5 text-accent-cyan" />
                <span className="max-w-[14rem] truncate">{att.name}</span>
                <span className="text-[10px] text-muted-fg">{sizeLabel(att.size)}</span>
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
