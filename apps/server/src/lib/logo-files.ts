import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { UPLOAD_ROOT } from './upload.js';

export type LogoKind = 'category' | 'channel' | 'user' | 'team' | 'server';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function logoDir(kind: LogoKind): string {
  return path.join(UPLOAD_ROOT, `${kind}-logos`);
}

export function publicLogoPath(kind: LogoKind, id: string): string {
  return `/api/brand/${kind}/${id}`;
}

export async function removeLogoFiles(kind: LogoKind, id: string): Promise<void> {
  const dir = logoDir(kind);
  let files: string[] = [];
  try {
    files = await fs.readdir(dir);
  } catch {
    return;
  }
  for (const f of files) {
    if (f.startsWith(`${id}.`)) {
      await fs.unlink(path.join(dir, f)).catch(() => undefined);
    }
  }
}

export async function writeLogoFile(
  kind: LogoKind,
  id: string,
  buffer: Buffer,
  originalName: string,
): Promise<string> {
  const extRaw = path.extname(originalName).toLowerCase();
  const ext = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(extRaw) ? extRaw : '.png';
  const dir = logoDir(kind);
  await fs.mkdir(dir, { recursive: true });
  await removeLogoFiles(kind, id);
  const dest = path.join(dir, `${id}${ext}`);
  await fs.writeFile(dest, buffer);
  return publicLogoPath(kind, id);
}

export async function resolveLogoFile(
  kind: LogoKind,
  id: string,
): Promise<{ abs: string; mime: string } | null> {
  const dir = logoDir(kind);
  let files: string[] = [];
  try {
    files = await fs.readdir(dir);
  } catch {
    return null;
  }
  const hit = files.find((f) => f.startsWith(`${id}.`));
  if (!hit) return null;
  const ext = path.extname(hit).toLowerCase();
  const mime = MIME[ext] ?? 'application/octet-stream';
  return { abs: path.join(dir, hit), mime };
}

export function streamLogoFile(abs: string, mime: string, res: import('express').Response): void {
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  createReadStream(abs).pipe(res);
}
