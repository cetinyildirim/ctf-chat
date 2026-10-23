import { Router } from 'express';
import { z } from 'zod';
import { FriendshipStatus, NotificationKind } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/http-error.js';
import { validate } from '../../middleware/validate.js';
import { serializeUser } from '../serializers.js';
import { audit } from '../../lib/audit.js';
import { notifyUsers } from '../../lib/notify.js';

const router: Router = Router();

type FriendActor = { id: string; username: string; displayName: string };

function notifyFriendEvent(
  kind: typeof NotificationKind.FRIEND_REQUEST | typeof NotificationKind.FRIEND_ACCEPTED,
  recipientId: string,
  actor: FriendActor,
  friendshipId: string,
): void {
  const name = actor.displayName || actor.username;
  void notifyUsers({
    userIds: [recipientId],
    kind,
    title:
      kind === NotificationKind.FRIEND_REQUEST
        ? `${name} sent you a friend request`
        : `${name} accepted your friend request`,
    body: `@${actor.username}`,
    href: '/friends',
    refType: 'friendship',
    refId: friendshipId,
    meta: { displayName: name, username: actor.username },
  });
}

router.use(requireAuth);

/** One-to-one DM channels of `userId`, keyed by the other participant. */
async function directChannelsByPeer(userId: string) {
  const mine = await prisma.channelDmParticipant.findMany({
    where: { userId, channel: { type: 'DIRECT_MESSAGE' } },
    select: {
      channelId: true,
      lastReadAt: true,
      channel: { select: { dmParticipants: { select: { userId: true } } } },
    },
  });
  const map = new Map<string, { channelId: string; lastReadAt: Date | null }>();
  for (const row of mine) {
    const others = row.channel.dmParticipants.filter((p) => p.userId !== userId);
    if (others.length !== 1) continue;
    map.set(others[0]!.userId, { channelId: row.channelId, lastReadAt: row.lastReadAt });
  }
  return map;
}

const requestSchema = z.object({
  username: z.string().min(3).max(24),
});

router.get('/', async (req, res, next) => {
  try {
    const me = req.user!.id;
    const rows = await prisma.friendship.findMany({
      where: {
        OR: [{ requesterId: me }, { addresseeId: me }],
      },
      include: {
        requester: { include: { team: true } },
        addressee: { include: { team: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const mapRow = (f: (typeof rows)[number]) => ({
      id: f.id,
      requesterId: f.requesterId,
      addresseeId: f.addresseeId,
      status: f.status,
      requester: serializeUser(f.requester),
      addressee: serializeUser(f.addressee),
    });
    const dmByPeer = await directChannelsByPeer(me);
    const accepted = await Promise.all(
      rows
        .filter((f) => f.status === FriendshipStatus.ACCEPTED)
        .map(async (f) => {
          const peerId = f.requesterId === me ? f.addresseeId : f.requesterId;
          const dm = dmByPeer.get(peerId);
          const unreadCount = dm
            ? await prisma.message.count({
                where: {
                  channelId: dm.channelId,
                  authorId: { not: me },
                  deletedAt: null,
                  ...(dm.lastReadAt ? { createdAt: { gt: dm.lastReadAt } } : {}),
                },
              })
            : 0;
          return { ...mapRow(f), dmChannelId: dm?.channelId ?? null, unreadCount };
        }),
    );
    const pendingIn = rows
      .filter((f) => f.status === FriendshipStatus.PENDING && f.addresseeId === me)
      .map(mapRow);
    const pendingOut = rows
      .filter((f) => f.status === FriendshipStatus.PENDING && f.requesterId === me)
      .map(mapRow);
    res.json({ accepted, pendingIncoming: pendingIn, pendingOutgoing: pendingOut });
  } catch (err) {
    next(err);
  }
});

router.post('/request', validate(requestSchema), async (req, res, next) => {
  try {
    const me = req.user!;
    const { username } = req.body as z.infer<typeof requestSchema>;
    const target = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (!target) throw NotFound('User not found');
    if (target.id === me.id) throw BadRequest('Invalid target');

    const opp = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: me.id, addresseeId: target.id },
          { requesterId: target.id, addresseeId: me.id },
        ],
      },
    });
    if (opp?.status === FriendshipStatus.ACCEPTED) throw BadRequest('Already friends');
    if (opp?.status === FriendshipStatus.REJECTED) {
      await prisma.friendship.delete({ where: { id: opp.id } });
    }
    if (opp?.status === FriendshipStatus.PENDING) {
      if (opp.requesterId === me.id) throw BadRequest('Request already sent');
      const updated = await prisma.friendship.update({
        where: { id: opp.id },
        data: { status: FriendshipStatus.ACCEPTED },
        include: {
          requester: { include: { team: true } },
          addressee: { include: { team: true } },
        },
      });
      await audit({
        actorId: me.id,
        action: 'friend.accept',
        target: target.id,
        meta: { username: target.username },
      });
      notifyFriendEvent(NotificationKind.FRIEND_ACCEPTED, target.id, updated.addressee, updated.id);
      res.json({
        friendship: {
          ...updated,
          requester: serializeUser(updated.requester),
          addressee: serializeUser(updated.addressee),
        },
        autoAccepted: true,
      });
      return;
    }
    const created = await prisma.friendship.create({
      data: { requesterId: me.id, addresseeId: target.id, status: FriendshipStatus.PENDING },
      include: {
        requester: { include: { team: true } },
        addressee: { include: { team: true } },
      },
    });
      await audit({
        actorId: me.id,
        action: 'friend.request',
        target: target.id,
        meta: { username: target.username },
      });
      notifyFriendEvent(NotificationKind.FRIEND_REQUEST, target.id, created.requester, created.id);
      res.status(201).json({
      friendship: {
        id: created.id,
        status: created.status,
        requesterId: created.requesterId,
        addresseeId: created.addresseeId,
        requester: serializeUser(created.requester),
        addressee: serializeUser(created.addressee),
      },
    });
  } catch (err) {
    next(err);
  }
});

const idParamSchema = z.object({ id: z.string().cuid() });

router.post('/:id/accept', validate(idParamSchema, 'params'), async (req, res, next) => {
  try {
    const me = req.user!.id;
    const id = req.params.id;
    if (!id) throw NotFound();
    const row = await prisma.friendship.findUnique({
      where: { id },
      include: {
        requester: { include: { team: true } },
        addressee: { include: { team: true } },
      },
    });
    if (!row) throw NotFound();
    if (row.addresseeId !== me) throw Forbidden();
    if (row.status !== FriendshipStatus.PENDING) throw BadRequest('Not pending');

    const updated = await prisma.friendship.update({
      where: { id },
      data: { status: FriendshipStatus.ACCEPTED },
      include: {
        requester: { include: { team: true } },
        addressee: { include: { team: true } },
      },
    });
    const peer =
      updated.requesterId === me ? updated.addressee : updated.requester;
    await audit({
      actorId: me,
      action: 'friend.accept',
      target: peer.id,
      meta: { username: peer.username },
    });
    notifyFriendEvent(NotificationKind.FRIEND_ACCEPTED, updated.requesterId, updated.addressee, updated.id);
    res.json({
      friendship: {
        id: updated.id,
        status: updated.status,
        requesterId: updated.requesterId,
        addresseeId: updated.addresseeId,
        requester: serializeUser(updated.requester),
        addressee: serializeUser(updated.addressee),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reject', validate(idParamSchema, 'params'), async (req, res, next) => {
  try {
    const me = req.user!.id;
    const id = req.params.id;
    if (!id) throw NotFound();
    const row = await prisma.friendship.findUnique({ where: { id } });
    if (!row) throw NotFound();
    if (row.addresseeId !== me && row.requesterId !== me) throw Forbidden();
    await prisma.friendship.update({
      where: { id },
      data: { status: FriendshipStatus.REJECTED },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', validate(idParamSchema, 'params'), async (req, res, next) => {
  try {
    const me = req.user!.id;
    const id = req.params.id;
    if (!id) throw NotFound();
    const row = await prisma.friendship.findUnique({ where: { id } });
    if (!row) throw NotFound();
    if (row.requesterId !== me && row.addresseeId !== me) throw Forbidden();
    await prisma.friendship.delete({ where: { id } });
    await audit({ actorId: me, action: 'friend.remove', target: id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
