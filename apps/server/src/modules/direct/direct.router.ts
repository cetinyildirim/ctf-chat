import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { serializeUser } from '../serializers.js';
import { serializeChannel } from '../serializers.js';
import { ensureDirectChannel } from './direct.service.js';

const router: Router = Router();

router.use(requireAuth);

const openSchema = z.object({
  peerUserId: z.string().cuid(),
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

export default router;
