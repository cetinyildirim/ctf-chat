import { Router } from 'express';
import { z } from 'zod';
import { NotificationKind } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { NotFound } from '../../lib/http-error.js';
import { serializeUser } from '../serializers.js';
import { serializeChannel } from '../serializers.js';
import { ensureDirectChannel } from './direct.service.js';

const router: Router = Router();

router.use(requireAuth);

const openSchema = z.object({
  peerUserId: z.string().cuid(),
});

const channelParamSchema = z.object({ channelId: z.string().cuid() });

const PREVIEW_LENGTH = 140;

/** My one-to-one conversations with their last message and unread count, newest first. */
router.get('/', async (req, res, next) => {
  try {
    const me = req.user!.id;
    const rows = await prisma.channelDmParticipant.findMany({
      where: { userId: me, channel: { type: 'DIRECT_MESSAGE' } },
      select: {
        channelId: true,
        lastReadAt: true,
        channel: {
          select: {
            dmParticipants: { select: { user: { include: { team: true } } } },
            messages: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                authorId: true,
                content: true,
                createdAt: true,
                _count: { select: { attachments: true } },
              },
            },
          },
        },
      },
    });

    const conversations = await Promise.all(
      rows.map(async (row) => {
        const peers = row.channel.dmParticipants.map((p) => p.user).filter((u) => u.id !== me);
        const last = row.channel.messages[0];
        if (peers.length !== 1 || !last) return null;
        const unreadCount = await prisma.message.count({
          where: {
            channelId: row.channelId,
            authorId: { not: me },
            deletedAt: null,
            ...(row.lastReadAt ? { createdAt: { gt: row.lastReadAt } } : {}),
          },
        });
        return {
          channelId: row.channelId,
          peer: serializeUser(peers[0]!),
          lastMessage: {
            id: last.id,
            authorId: last.authorId,
            preview: last.content.replace(/\s+/g, ' ').trim().slice(0, PREVIEW_LENGTH),
            attachmentCount: last._count.attachments,
            createdAt: last.createdAt.toISOString(),
          },
          unreadCount,
        };
      }),
    );

    const list = conversations
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt));
    res.json({
      conversations: list,
      totalUnread: list.reduce((sum, c) => sum + c.unreadCount, 0),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/open', validate(openSchema), async (req, res, next) => {
  try {
    const { peerUserId } = req.body as z.infer<typeof openSchema>;
    const channelId = await ensureDirectChannel(req.user!.id, peerUserId);
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: { category: true, dmParticipants: { include: { user: { include: { team: true } } } } },
    });
    if (!channel) throw new Error('dm channel missing');

    const peer = channel.dmParticipants.map((p) => p.user).find((u) => u.id !== req.user!.id);
    const ch = serializeChannel(channel);
    res.json({
      channel: {
        ...ch,
        name: peer?.displayName ?? ch.name,
        dmPeer: peer ? serializeUser(peer) : null,
      },
      channelId,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:channelId/read', validate(channelParamSchema, 'params'), async (req, res, next) => {
  try {
    const { count } = await prisma.channelDmParticipant.updateMany({
      where: { channelId: req.params.channelId!, userId: req.user!.id },
      data: { lastReadAt: new Date() },
    });
    if (count === 0) throw NotFound();
    await prisma.notification.updateMany({
      where: {
        userId: req.user!.id,
        kind: NotificationKind.DIRECT_MESSAGE,
        refId: req.params.channelId!,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
