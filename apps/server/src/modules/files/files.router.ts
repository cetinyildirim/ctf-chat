import { Router } from 'express';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { NotFound } from '../../lib/http-error.js';
import { loadChannel, assertCanAccessChannel } from '../messages/access.js';
import { absolutePathForStoredAttachment } from '../../lib/upload.js';

const router: Router = Router();

router.use(requireAuth);

/**
 * Authenticated download of a message attachment. URL is stored on Attachment as `/api/files/:id`.
 */
router.get('/:attachmentId', async (req, res, next) => {
  try {
    const attachmentId = req.params.attachmentId;
    if (!attachmentId) throw NotFound();

    const att = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: { select: { id: true, channelId: true, deletedAt: true } },
      },
    });
    if (!att || !att.message || att.message.deletedAt) throw NotFound();

    const channel = await loadChannel(att.message.channelId);
    await assertCanAccessChannel(channel, req.user!);

    const abs = absolutePathForStoredAttachment(att.id, att.name);
    try {
      await fs.access(abs);
    } catch {
      throw NotFound('File missing');
    }

    res.setHeader('Content-Type', att.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(att.name)}"`);
    createReadStream(abs).pipe(res);
  } catch (err) {
    next(err);
  }
});

export default router;
