import { existsSync, mkdirSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { env } from '../env.js';

export const UPLOAD_ROOT = path.resolve(process.cwd(), env.UPLOAD_DIR);

if (!existsSync(UPLOAD_ROOT)) {
  mkdirSync(UPLOAD_ROOT, { recursive: true });
}

/** Hard ceiling; per-request validation uses platform setting. */
const maxBytes = 500 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_ROOT);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 24);
    cb(null, `tmp-${nanoid()}${ext}`);
  },
});

/** Multipart field name: `files` (max 10 per request). */
export const channelMessageUpload = multer({
  storage,
  limits: { fileSize: maxBytes, files: 10 },
});

/** Single image for category/channel logos (field name: `file`). */
export const logoImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.min(maxBytes, 3 * 1024 * 1024) },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|gif|webp|svg\+xml)$/i.test(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, GIF, WebP, or SVG images are allowed'));
    } else {
      cb(null, true);
    }
  },
});

export function safeBasename(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160) || 'file';
}

export function diskFilenameForAttachment(attachmentId: string, storedName: string): string {
  const ext = path.extname(storedName).slice(0, 24);
  return `${attachmentId}${ext}`;
}

export function absolutePathForStoredAttachment(attachmentId: string, storedName: string): string {
  return path.join(UPLOAD_ROOT, diskFilenameForAttachment(attachmentId, storedName));
}

export async function unlinkQuiet(p: string): Promise<void> {
  try {
    await fs.unlink(p);
  } catch {
    /* ignore */
  }
}
