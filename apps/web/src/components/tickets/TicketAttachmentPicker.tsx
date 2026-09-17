'use client';

import * as React from 'react';
import { Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/providers/LocaleProvider';

/**
 * File picker for ticket evidence. The server re-validates type, size and count;
 * this only keeps the user from queueing something obviously wrong.
 */
export const TICKET_ACCEPT =
  'image/*,application/pdf,text/plain,text/csv,text/markdown,application/json,application/zip,application/gzip,application/x-tar,.log,.pcap,.pcapng';

export function TicketAttachmentPicker({
  files,
  onChange,
  max = 5,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const add = (incoming: FileList | null) => {
    if (!incoming) return;
    onChange([...files, ...Array.from(incoming)].slice(0, max));
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={TICKET_ACCEPT}
          className="hidden"
          onChange={(e) => add(e.target.files)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || files.length >= max}
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip className="h-3.5 w-3.5" /> {t.ticketAttach}
        </Button>
        <span className="text-[10px] text-muted-fg">{t.ticketAttachHint}</span>
      </div>
      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px]"
            >
              <span className="max-w-[12rem] truncate">{file.name}</span>
              <button
                type="button"
                aria-label={`remove ${file.name}`}
                className="text-muted-fg hover:text-fg"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
