/**
 * Platform backups: a consistent SQLite snapshot (VACUUM INTO) plus, optionally,
 * the uploads folder, packed into one `.tar.gz` under BACKUP_DIR.
 *
 * Archives contain password hashes and every private message, so the API only
 * exposes them to SUPER_ADMIN and names are validated against BACKUP_NAME_RE
 * before touching the filesystem. Restore is intentionally not offered over
 * HTTP: it needs the API stopped (see the admin panel instructions).
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import { logger } from './logger.js';
import { UPLOAD_ROOT } from './upload.js';

export const BACKUP_ROOT = path.resolve(process.cwd(), env.BACKUP_DIR);
export const BACKUP_NAME_RE = /^sydt-backup-\d{8}-\d{6}-(auto|manual)\.tar\.gz$/;

export const BACKUP_FREQUENCIES = ['EVERY_6H', 'EVERY_12H', 'DAILY', 'WEEKLY'] as const;
export type BackupFrequency = (typeof BACKUP_FREQUENCIES)[number];
export type BackupTrigger = 'auto' | 'manual';

const CONFIG_ID = 'default';

export interface BackupFileInfo {
  name: string;
  sizeBytes: number;
  createdAt: string;
  trigger: BackupTrigger;
}

let running: { trigger: BackupTrigger; startedAt: Date } | null = null;

export function backupRunningState() {
  return running ? { trigger: running.trigger, startedAt: running.startedAt.toISOString() } : null;
}

export async function getBackupConfig() {
  return prisma.backupConfig.upsert({
    where: { id: CONFIG_ID },
    create: { id: CONFIG_ID },
    update: {},
  });
}

export async function updateBackupConfig(patch: {
  enabled?: boolean;
  frequency?: BackupFrequency;
  hour?: number;
  weekday?: number;
  retention?: number;
  includeUploads?: boolean;
}) {
  await getBackupConfig();
  return prisma.backupConfig.update({ where: { id: CONFIG_ID }, data: patch });
}

type Config = Awaited<ReturnType<typeof getBackupConfig>>;

function hourMatches(cfg: Config, at: Date): boolean {
  const h = at.getHours();
  switch (cfg.frequency as BackupFrequency) {
    case 'EVERY_6H':
      return (((h - cfg.hour) % 6) + 6) % 6 === 0;
    case 'EVERY_12H':
      return (((h - cfg.hour) % 12) + 12) % 12 === 0;
    case 'WEEKLY':
      return h === cfg.hour && at.getDay() === cfg.weekday;
    default:
      return h === cfg.hour;
  }
}

function floorToHour(d: Date): Date {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  return x;
}

/**
 * A slot is due only during its own hour, so enabling the schedule never fires a
 * backlog; a restart within that hour still catches up.
 */
function isDue(cfg: Config, now: Date): boolean {
  if (!cfg.enabled) return false;
  const slot = floorToHour(now);
  if (!hourMatches(cfg, slot)) return false;
  return !cfg.lastAutoRunAt || cfg.lastAutoRunAt < slot;
}

export function nextRunAt(cfg: Config, now = new Date()): string | null {
  if (!cfg.enabled) return null;
  const slot = floorToHour(now);
  if (isDue(cfg, now)) return slot.toISOString();
  for (let i = 1; i <= 24 * 8; i++) {
    const candidate = new Date(slot.getTime() + i * 3_600_000);
    if (hourMatches(cfg, candidate)) return candidate.toISOString();
  }
  return null;
}

function pad(n: number, w = 2) {
  return String(n).padStart(w, '0');
}

function stamp(d: Date) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// ---------------------------------------------------------------------------
// Minimal streaming tar (ustar + PAX long names) — no extra dependency.

function octal(value: number, width: number): string {
  return value.toString(8).padStart(width - 1, '0') + '\0';
}

function tarHeader(name: string, size: number, mtime: Date, type: '0' | 'x' = '0'): Buffer {
  const h = Buffer.alloc(512, 0);
  h.write(name, 0, 100, 'utf8');
  h.write(octal(0o644, 8), 100, 'ascii');
  h.write(octal(0, 8), 108, 'ascii');
  h.write(octal(0, 8), 116, 'ascii');
  h.write(octal(size, 12), 124, 'ascii');
  h.write(octal(Math.floor(mtime.getTime() / 1000), 12), 136, 'ascii');
  h.write('        ', 148, 'ascii');
  h.write(type, 156, 'ascii');
  h.write('ustar\0', 257, 'ascii');
  h.write('00', 263, 'ascii');
  let sum = 0;
  for (const byte of h) sum += byte;
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
  return h;
}

function paxRecord(key: string, value: string): Buffer {
  const body = ` ${key}=${value}\n`;
  let len = Buffer.byteLength(body) + 1;
  while (String(len).length + Buffer.byteLength(body) !== len) len = String(len).length + Buffer.byteLength(body);
  return Buffer.from(`${len}${body}`, 'utf8');
}

class TarGzWriter {
  private readonly gzip = zlib.createGzip({ level: 6 });
  private readonly out: fs.WriteStream;

  constructor(filePath: string) {
    this.out = fs.createWriteStream(filePath, { mode: 0o600 });
    this.gzip.pipe(this.out);
  }

  private async write(buf: Buffer) {
    if (!this.gzip.write(buf)) await once(this.gzip, 'drain');
  }

  private async padTo512(size: number) {
    const rest = size % 512;
    if (rest) await this.write(Buffer.alloc(512 - rest, 0));
  }

  private async header(name: string, size: number, mtime: Date) {
    if (Buffer.byteLength(name) > 100) {
      const pax = paxRecord('path', name);
      await this.write(tarHeader(`PaxHeader/${name.slice(-80)}`, pax.length, mtime, 'x'));
      await this.write(pax);
      await this.padTo512(pax.length);
    }
    await this.write(tarHeader(name, size, mtime));
  }

  async addBuffer(name: string, data: Buffer, mtime = new Date()) {
    await this.header(name, data.length, mtime);
    await this.write(data);
    await this.padTo512(data.length);
  }

  /** Writes exactly the stat'ed size so a file growing mid-read cannot corrupt the archive. */
  async addFile(name: string, filePath: string) {
    const st = await fsp.stat(filePath);
    await this.header(name, st.size, st.mtime);
    let written = 0;
    for await (const chunk of fs.createReadStream(filePath)) {
      const buf = chunk as Buffer;
      const take = Math.min(buf.length, st.size - written);
      if (take <= 0) break;
      await this.write(take === buf.length ? buf : buf.subarray(0, take));
      written += take;
    }
    if (written < st.size) await this.write(Buffer.alloc(st.size - written, 0));
    await this.padTo512(st.size);
  }

  async close() {
    await this.write(Buffer.alloc(1024, 0));
    this.gzip.end();
    await finished(this.out);
  }

  destroy() {
    this.gzip.destroy();
    this.out.destroy();
  }
}

async function* walk(dir: string, rel = ''): AsyncGenerator<{ abs: string; rel: string }> {
  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (path.resolve(abs) === BACKUP_ROOT) continue;
    if (e.isDirectory()) yield* walk(abs, r);
    else if (e.isFile() && !(rel === '' && e.name.startsWith('tmp-'))) yield { abs, rel: r };
  }
}

// ---------------------------------------------------------------------------

async function snapshotDatabase(target: string) {
  const escaped = target.replace(/\\/g, '/').replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${escaped}'`);
}

export async function listBackups(): Promise<BackupFileInfo[]> {
  let names: string[] = [];
  try {
    names = await fsp.readdir(BACKUP_ROOT);
  } catch {
    return [];
  }
  const out: BackupFileInfo[] = [];
  for (const name of names) {
    if (!BACKUP_NAME_RE.test(name)) continue;
    const st = await fsp.stat(path.join(BACKUP_ROOT, name)).catch(() => null);
    if (!st) continue;
    out.push({
      name,
      sizeBytes: st.size,
      createdAt: st.mtime.toISOString(),
      trigger: name.endsWith('-manual.tar.gz') ? 'manual' : 'auto',
    });
  }
  return out.sort((a, b) => b.name.localeCompare(a.name));
}

export function backupPath(name: string): string | null {
  return BACKUP_NAME_RE.test(name) ? path.join(BACKUP_ROOT, name) : null;
}

export async function diskFreeBytes(): Promise<number | null> {
  try {
    await fsp.mkdir(BACKUP_ROOT, { recursive: true });
    const s = await fsp.statfs(BACKUP_ROOT);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return null;
  }
}

async function pruneAutoBackups(retention: number) {
  const autos = (await listBackups()).filter((b) => b.trigger === 'auto');
  for (const old of autos.slice(retention)) {
    await fsp.unlink(path.join(BACKUP_ROOT, old.name)).catch(() => undefined);
  }
}

/** Runs one backup; resolves with the archive info. Only one backup runs at a time. */
export async function runBackup(trigger: BackupTrigger): Promise<BackupFileInfo> {
  if (running) throw new Error('A backup is already running');
  const startedAt = new Date();
  running = { trigger, startedAt };
  const cfg = await getBackupConfig();
  await fsp.mkdir(BACKUP_ROOT, { recursive: true, mode: 0o700 });

  const name = `sydt-backup-${stamp(startedAt)}-${trigger}.tar.gz`;
  const finalPath = path.join(BACKUP_ROOT, name);
  const partialPath = `${finalPath}.partial`;
  const dbTmp = path.join(BACKUP_ROOT, `.snapshot-${stamp(startedAt)}.db`);
  let writer: TarGzWriter | null = null;

  try {
    await snapshotDatabase(dbTmp);
    writer = new TarGzWriter(partialPath);
    let uploadFiles = 0;
    await writer.addFile('database.db', dbTmp);
    if (cfg.includeUploads) {
      for await (const f of walk(UPLOAD_ROOT)) {
        await writer.addFile(`uploads/${f.rel}`, f.abs);
        uploadFiles++;
      }
    }
    const manifest = {
      app: 'sydt-chat',
      createdAt: startedAt.toISOString(),
      trigger,
      includeUploads: cfg.includeUploads,
      uploadFiles,
      restore: 'Stop sydt-api, replace the DATABASE_URL file with database.db, copy uploads/ into UPLOAD_DIR, start sydt-api.',
    };
    await writer.addBuffer('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));
    await writer.close();
    writer = null;
    await fsp.rename(partialPath, finalPath);

    const st = await fsp.stat(finalPath);
    await prisma.backupConfig.update({
      where: { id: CONFIG_ID },
      data: {
        lastRunAt: startedAt,
        lastStatus: 'OK',
        lastError: null,
        lastDurationMs: Date.now() - startedAt.getTime(),
        lastSizeBytes: BigInt(st.size),
        ...(trigger === 'auto' ? { lastAutoRunAt: startedAt } : {}),
      },
    });
    if (trigger === 'auto') await pruneAutoBackups(cfg.retention);
    logger.info({ name, sizeBytes: st.size, uploadFiles }, 'backup completed');
    return { name, sizeBytes: st.size, createdAt: st.mtime.toISOString(), trigger };
  } catch (err) {
    writer?.destroy();
    await fsp.unlink(partialPath).catch(() => undefined);
    const message = (err as Error).message ?? String(err);
    logger.error({ err }, 'backup failed');
    await prisma.backupConfig
      .update({
        where: { id: CONFIG_ID },
        data: {
          lastRunAt: startedAt,
          lastStatus: 'FAILED',
          lastError: message.slice(0, 500),
          lastDurationMs: Date.now() - startedAt.getTime(),
          ...(trigger === 'auto' ? { lastAutoRunAt: startedAt } : {}),
        },
      })
      .catch(() => undefined);
    throw err;
  } finally {
    await fsp.unlink(dbTmp).catch(() => undefined);
    running = null;
  }
}

export function startBackupScheduler() {
  const tick = async () => {
    if (running) return;
    const cfg = await getBackupConfig();
    if (isDue(cfg, new Date())) await runBackup('auto');
  };
  setInterval(() => {
    void tick().catch((err) => logger.warn({ err }, 'backup scheduler failed'));
  }, 60_000).unref?.();
}
