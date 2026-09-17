import { Router } from 'express';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { NotFound } from '../../lib/http-error.js';
import { loadChannel, assertCanAccessChannel } from '../messages/access.js';
import { absolutePathForStoredAttachment } from '../../lib/upload.js';
import { isInlineSafeMime } from '../../lib/allowed-upload.js';
import { fileDownloadLimiter } from '../../middleware/ratelimit.js';
import { loadAccessibleTicket } from '../tickets/ticket-access.js';
import { auditRequest } from '../../lib/audit.js';

const router: Router = Router();

router.use(requireAuth);

/**
 * Authenticated download of an attachment. URL is stored on Attachment as
 * `/api/files/:id`.
 *
 * Authorization is re-evaluated per request and depends on where the attachment
 * hangs: channel attachments go through channel access, ticket attachments
 * through ticket access (team isolation, spec §31). An attachment that belongs
 * to neither is treated as missing.
 */
router.get('/:attachmentId', fileDownloadLimiter, async (req, res, next) => {
  try {
    const attachmentId = req.params.attachmentId;
    if (!attachmentId) throw NotFound();

    const att = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: { select: { id: true, channelId: true, deletedAt: true } },
        ticketEvent: { select: { id: true, ticketId: true, type: true } },
      },
    });
    if (!att) throw NotFound();

    if (att.message) {
      if (att.message.deletedAt) throw NotFound();
      const channel = await loadChannel(att.message.channelId);
      await assertCanAccessChannel(channel, req.user!);
    } else if (att.ticketEvent) {
      // Throws NotFound for anyone outside the ticket's team/organizer scope.
      const { ticket, access } = await loadAccessibleTicket(att.ticketEvent.ticketId, req.user!);
      if (att.ticketEvent.type === 'INTERNAL_NOTE' && !access.canSeeInternal) throw NotFound();
      await auditRequest(req, {
        action: 'ticket.attachment_download',
        target: ticket.id,
        meta: { attachmentId: att.id, name: att.name, code: ticket.code },
      });
    } else {
      throw NotFound();
    }

    const abs = absolutePathForStoredAttachment(att.id, att.name);
    try {
      await fs.access(abs);
    } catch {
      throw NotFound('File missing');
    }

    res.setHeader('Content-Type', att.mimeType || 'application/octet-stream');
    const disposition = isInlineSafeMime(att.mimeType) ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(att.name)}"`);
    createReadStream(abs).pipe(res);
  } catch (err) {
    next(err);
  }
});

export default router;
