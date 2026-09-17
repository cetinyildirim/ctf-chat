'use client';

import * as React from 'react';
import { FileText, ImageIcon, Paperclip } from 'lucide-react';
import type { TicketAttachmentDto } from '@sydt/shared';

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
        const Icon = att.mimeType.startsWith('image/')
          ? ImageIcon
          : att.mimeType === 'application/pdf' || att.mimeType.startsWith('text/')
            ? FileText
            : Paperclip;
        return (
          <li key={att.id}>
            <a
              href={att.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-fg-subtle transition-colors hover:border-accent-cyan/40 hover:text-fg"
            >
              <Icon className="h-3.5 w-3.5 text-accent-cyan" />
              <span className="max-w-[14rem] truncate">{att.name}</span>
              <span className="text-[10px] text-muted-fg">{sizeLabel(att.size)}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
