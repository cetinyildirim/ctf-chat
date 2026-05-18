import { Router } from 'express';
import type { Request, RequestHandler } from 'express';
import fs from 'node:fs/promises';
import { Permission, isStaff, schemas } from '@sydt/shared';
import { MAX_MESSAGE_LENGTH } from '@sydt/shared';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { messageLimiter } from '../../middleware/ratelimit.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { serializeMessage } from '../serializers.js';
import { loadChannel, assertCanAccessChannel } from './access.js';
import { channelMessageUpload, safeBasename, absolutePathForStoredAttachment, unlinkQuiet } from '../../lib/upload.js';
import {
  emitMessageDelete,
  emitMessageEdit,
  emitMessageNew,
  emitMessageReact,
  emitMention,
} from '../../realtime/broadcasters.js';
import { effectiveNotifyModes } from '../../lib/channel-notify-prefs.js';
import { assertUserCanUsePlatform } from '../../lib/user-moderation.js';
import { getUploadMaxMb } from '../../lib/platform-settings.js';

const router: Router = Router({ mergeParams: true });

router.use(requireAuth);

const messageInclude = {
  author: { include: { team: true } },
  attachments: true,
  reactions: { select: { emoji: true, userId: true } },
  replyTo: { select: { id: true, authorId: true, content: true } },
  pin: true,
} satisfies Prisma.MessageInclude;

const parseMultipart: RequestHandler = (req, _res, next) => {
  const ct = req.get('content-type') ?? '';
  if (ct.includes('multipart/form-data')) {
    return channelMessageUpload.array('files', 10)(req, _res, next);
  }
  next();
};

const validateJsonMessage: RequestHandler = (req, res, next) => {
  const ct = req.get('content-type') ?? '';
  if (ct.includes('multipart/form-data')) {
    next();
    return;
  }
  validate(schemas.sendMessageSchema)(req, res, next);
};

function extractMentions(content: string): string[] {
  const set = new Set<string>();
  for (const m of content.matchAll(/@([a-z0-9_.-]{3,24})/gi)) {
    if (m[1]) set.add(m[1].toLowerCase());
  }
  return Array.from(set);
}

router.get(
  '/:channelId/messages',
  validate(schemas.listMessagesQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const channelId = req.params.channelId;
      if (!channelId) throw NotFound();
      const channel = await loadChannel(channelId);
      await assertCanAccessChannel(channel, req.user!);
      const { cursor, take, direction } = req.query as unknown as {
        cursor?: string;
        take: number;
        direction: 'backward' | 'forward';
      };
      const isBackward = direction === 'backward';
      const messages = await prisma.message.findMany({
        where: { channelId, deletedAt: null },
        include: messageInclude,
        orderBy: { createdAt: isBackward ? 'desc' : 'asc' },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const hasMore = messages.length > take;
      const slice = hasMore ? messages.slice(0, take) : messages;
      const ordered = isBackward ? slice.reverse() : slice;
      const nextCursor = hasMore ? slice[slice.length - 1]?.id ?? null : null;
      res.json({
        messages: ordered.map(serializeMessage),
        nextCursor,
        hasMore,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:channelId/messages',
  messageLimiter,
  requirePermission(Permission.MESSAGE_SEND),
  parseMultipart,
  validateJsonMessage,
  async (req, res, next) => {
    const tempPaths: string[] = [];
    try {
      const channelId = req.params.channelId;
      if (!channelId) throw NotFound();
      await assertUserCanUsePlatform(req.user!.id);
      const channel = await loadChannel(channelId);
      await assertCanAccessChannel(channel, req.user!);
      if (channel.isLocked && !isStaff(req.user!.role)) {
        throw Forbidden('Channel is locked');
      }
      if (channel.type === 'GLOBAL_ANNOUNCEMENT' && !isStaff(req.user!.role)) {
        throw Forbidden('Only staff may post in announcement channels');
      }

      const isMultipart = (req.get('content-type') ?? '').includes('multipart/form-data');
      let content: string;
      let replyToId: string | null;

      if (isMultipart) {
        const files = ((req as Request & { files?: Express.Multer.File[] }).files ??
          []) as Express.Multer.File[];
        const maxBytes = (await getUploadMaxMb()) * 1024 * 1024;
        for (const f of files) {
          if (f.size > maxBytes) {
            throw BadRequest(`File "${f.originalname}" exceeds upload limit`);
          }
          tempPaths.push(f.path);
        }

        content = String(req.body?.content ?? '').trim();
        const rawReply = req.body?.replyToId;
        replyToId = null;
        if (rawReply !== undefined && rawReply !== null && String(rawReply).trim() !== '') {
          const id = String(rawReply).trim();
          const c = z.string().cuid().safeParse(id);
          if (!c.success) throw BadRequest('Invalid reply target');
          replyToId = c.data;
        }

        if (content.length > MAX_MESSAGE_LENGTH) {
          throw BadRequest(`Message too long (max ${MAX_MESSAGE_LENGTH})`);
        }
        if (!content && files.length === 0) {
          throw BadRequest('Add text or attach at least one file');
        }
      } else {
        const data = req.body as ReturnType<typeof schemas.sendMessageSchema.parse>;
        content = data.content;
        replyToId = data.replyToId ?? null;
      }

      const mentions = extractMentions(content);
      const message = await prisma.message.create({
        data: {
          channelId,
          authorId: req.user!.id,
          content,
          mentionsJson: JSON.stringify(mentions),
          replyToId,
        },
        include: messageInclude,
      });

      if (isMultipart) {
        const files = ((req as Request & { files?: Express.Multer.File[] }).files ??
          []) as Express.Multer.File[];
        try {
          for (const file of files) {
            const att = await prisma.attachment.create({
              data: {
                messageId: message.id,
                name: safeBasename(file.originalname),
                mimeType: file.mimetype || 'application/octet-stream',
                size: file.size,
                url: '',
              },
            });
            const dest = absolutePathForStoredAttachment(att.id, att.name);
            await fs.rename(file.path, dest);
            await prisma.attachment.update({
              where: { id: att.id },
              data: { url: `/api/files/${att.id}` },
            });
          }
        } catch (err) {
          await prisma.message.delete({ where: { id: message.id } }).catch(() => undefined);
          for (const p of tempPaths) void unlinkQuiet(p);
          throw err;
        }
      }

      const full = await prisma.message.findUnique({
        where: { id: message.id },
        include: messageInclude,
      });
      if (!full) throw NotFound();

      const serialized = serializeMessage(full);
      emitMessageNew(channelId, serialized);

      if (mentions.length > 0) {
        const mentionedUsers = await prisma.user.findMany({
          where: { username: { in: mentions } },
          select: { id: true },
        });
        const preview = content.slice(0, 140);
        const recipients = mentionedUsers.filter((u) => u.id !== req.user!.id).map((u) => u.id);
        const modes =
          recipients.length > 0
            ? await effectiveNotifyModes(channelId, recipients)
            : new Map<string, 'ALL' | 'MENTIONS_ONLY' | 'NONE' | 'MUTED'>();
        for (const uId of recipients) {
          const eff = modes.get(uId) ?? 'ALL';
          if (eff === 'NONE' || eff === 'MUTED') continue;
          emitMention({
            userId: uId,
            fromUserId: req.user!.id,
            channelId,
            messageId: message.id,
            preview,
          });
        }
      }

      res.status(201).json({ message: serialized });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/messages/:id',
  validate(schemas.editMessageSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id) throw NotFound();
      const original = await prisma.message.findUnique({ where: { id } });
      if (!original) throw NotFound('Message not found');
      const isOwner = original.authorId === req.user!.id;
      if (!isOwner) throw Forbidden('Cannot edit other messages');
      const data = req.body as ReturnType<typeof schemas.editMessageSchema.parse>;
      const message = await prisma.message.update({
        where: { id },
        data: {
          content: data.content,
          mentionsJson: JSON.stringify(extractMentions(data.content)),
          editedAt: new Date(),
        },
        include: messageInclude,
      });
      const serialized = serializeMessage(message);
      emitMessageEdit(message.channelId, serialized);
      res.json({ message: serialized });
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/messages/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) throw NotFound();
    const original = await prisma.message.findUnique({ where: { id } });
    if (!original) throw NotFound('Message not found');
    const isOwner = original.authorId === req.user!.id;
    const canDeleteAny = isStaff(req.user!.role);
    if (!isOwner && !canDeleteAny) throw Forbidden();
    await prisma.message.update({
      where: { id },
      data: { deletedAt: new Date(), content: '' },
    });
    if (!isOwner) {
      await audit({
        actorId: req.user?.id,
        action: 'message.delete',
        target: id,
        meta: { channelId: original.channelId },
      });
    }
    emitMessageDelete(original.channelId, id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/messages/:id/react',
  requirePermission(Permission.MESSAGE_REACT),
  validate(schemas.reactMessageSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id) throw NotFound();
      const data = req.body as ReturnType<typeof schemas.reactMessageSchema.parse>;
      const existing = await prisma.reaction.findUnique({
        where: {
          messageId_userId_emoji: {
            messageId: id,
            userId: req.user!.id,
            emoji: data.emoji,
          },
        },
      });
      if (existing) {
        await prisma.reaction.delete({ where: { id: existing.id } });
      } else {
        try {
          await prisma.reaction.create({
            data: { messageId: id, userId: req.user!.id, emoji: data.emoji },
          });
        } catch {
          throw BadRequest('Could not react');
        }
      }
      const message = await prisma.message.findUnique({
        where: { id },
        include: messageInclude,
      });
      if (!message) throw NotFound();
      const serialized = serializeMessage(message);
      emitMessageReact(message.channelId, message.id, serialized.reactions);
      res.json({ reactions: serialized.reactions });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/messages/:id/pin',
  requirePermission(Permission.MESSAGE_PIN),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id) throw NotFound();
      const message = await prisma.message.findUnique({ where: { id } });
      if (!message) throw NotFound();
      await prisma.pin.upsert({
        where: { messageId: id },
        update: { pinnedById: req.user!.id, pinnedAt: new Date() },
        create: { channelId: message.channelId, messageId: id, pinnedById: req.user!.id },
      });
      await audit({ actorId: req.user?.id, action: 'message.pin', target: id });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/:channelId/pins', async (req, res, next) => {
  try {
    const channelId = req.params.channelId;
    if (!channelId) throw NotFound();
    const channel = await loadChannel(channelId);
    await assertCanAccessChannel(channel, req.user!);
    const pins = await prisma.pin.findMany({
      where: { channelId },
      include: { message: { include: messageInclude } },
      orderBy: { pinnedAt: 'desc' },
    });
    res.json({
      pins: pins
        .filter((p) => p.message)
        .map((p) => serializeMessage(p.message)),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
