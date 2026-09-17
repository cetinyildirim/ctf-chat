/**
 * Ticket attachment storage.
 *
 * Files live outside the web root (UPLOAD_ROOT) and are only reachable through
 * /api/files/:id, which re-authorizes the ticket on every download. The name on
 * disk is derived from the attachment id, never from the uploaded filename, so
 * path traversal via the original name is impossible.
 */
import fs from 'node:fs/promises';
import type { Request } from 'express';
import type { TicketAttachmentDto } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { BadRequest } from '../../lib/http-error.js';
import { getUploadMaxMb } from '../../lib/platform-settings.js';
import { verifyTicketUploadFile } from '../../lib/allowed-upload.js';
import {
  absolutePathForStoredAttachment,
  safeBasename,
  unlinkQuiet,
} from '../../lib/upload.js';

export const TICKET_ATTACHMENT_FIELD = 'files';
export const MAX_TICKET_ATTACHMENTS = 5;

export function uploadedFiles(req: Request): Express.Multer.File[] {
  return ((req as Request & { files?: Express.Multer.File[] }).files ?? []) as Express.Multer.File[];
}

export function isMultipart(req: Request): boolean {
  return (req.get('content-type') ?? '').includes('multipart/form-data');
}

/** Removes the temp files multer wrote, used when a request fails validation. */
export async function discardUploads(files: Express.Multer.File[]): Promise<void> {
  for (const file of files) await unlinkQuiet(file.path);
}

/**
 * Moves verified uploads into the attachment store and links them to a ticket
 * event. Any rejected file aborts the whole batch so a ticket never ends up
 * with a half-written evidence set.
 */
export async function attachFilesToTicketEvent(args: {
  ticketEventId: string;
  uploadedById: string;
  files: Express.Multer.File[];
}): Promise<TicketAttachmentDto[]> {
  const { files } = args;
  if (files.length === 0) return [];
  if (files.length > MAX_TICKET_ATTACHMENTS) {
    await discardUploads(files);
    throw BadRequest(`At most ${MAX_TICKET_ATTACHMENTS} files per message`);
  }

  const maxBytes = (await getUploadMaxMb()) * 1024 * 1024;
  const created: TicketAttachmentDto[] = [];

  try {
    for (const file of files) {
      if (file.size > maxBytes) {
        throw BadRequest(`File "${file.originalname}" exceeds the upload limit`);
      }
      // Trust the bytes, not the declared type or the extension.
      const verifiedMime = await verifyTicketUploadFile(file.path, file.mimetype).catch((err) => {
        throw BadRequest(`${safeBasename(file.originalname)}: ${(err as Error).message}`);
      });

      const attachment = await prisma.attachment.create({
        data: {
          ticketEventId: args.ticketEventId,
          uploadedById: args.uploadedById,
          name: safeBasename(file.originalname),
          mimeType: verifiedMime,
          size: file.size,
          url: '',
        },
      });
      await fs.rename(file.path, absolutePathForStoredAttachment(attachment.id, attachment.name));
      const stored = await prisma.attachment.update({
        where: { id: attachment.id },
        data: { url: `/api/files/${attachment.id}` },
      });
      created.push({
        id: stored.id,
        name: stored.name,
        mimeType: stored.mimeType,
        size: stored.size,
        url: stored.url,
        createdAt: stored.createdAt.toISOString(),
      });
    }
  } catch (err) {
    // Roll back everything this batch produced, on disk and in the database.
    await discardUploads(files);
    for (const att of created) {
      await unlinkQuiet(absolutePathForStoredAttachment(att.id, att.name));
      await prisma.attachment.delete({ where: { id: att.id } }).catch(() => undefined);
    }
    throw err;
  }

  return created;
}
