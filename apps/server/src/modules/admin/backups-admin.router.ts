import { Router } from 'express';
import fsp from 'node:fs/promises';
import { z } from 'zod';
import { Role } from '@sydt/shared';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, Conflict, NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { logger } from '../../lib/logger.js';
import { env } from '../../env.js';
import {
  BACKUP_FREQUENCIES,
  BACKUP_ROOT,
  backupPath,
  backupRunningState,
  diskFreeBytes,
  getBackupConfig,
  listBackups,
  nextRunAt,
  runBackup,
  updateBackupConfig,
} from '../../lib/backup.js';

const router: Router = Router();

router.use(requireRole(Role.SUPER_ADMIN));

router.get('/', async (_req, res, next) => {
  try {
    const cfg = await getBackupConfig();
    res.json({
      settings: {
        enabled: cfg.enabled,
        frequency: cfg.frequency,
        hour: cfg.hour,
        weekday: cfg.weekday,
        retention: cfg.retention,
        includeUploads: cfg.includeUploads,
      },
      lastRun: cfg.lastRunAt
        ? {
            at: cfg.lastRunAt.toISOString(),
            status: cfg.lastStatus,
            error: cfg.lastError,
            durationMs: cfg.lastDurationMs,
            sizeBytes: cfg.lastSizeBytes === null ? null : Number(cfg.lastSizeBytes),
          }
        : null,
      nextRunAt: nextRunAt(cfg),
      running: backupRunningState(),
      backupDir: BACKUP_ROOT,
      uploadDir: env.UPLOAD_DIR,
      diskFreeBytes: await diskFreeBytes(),
      serverTime: new Date().toISOString(),
      backups: await listBackups(),
    });
  } catch (err) {
    next(err);
  }
});

const settingsSchema = z
  .object({
    enabled: z.boolean(),
    frequency: z.enum(BACKUP_FREQUENCIES),
    hour: z.number().int().min(0).max(23),
    weekday: z.number().int().min(0).max(6),
    retention: z.number().int().min(1).max(90),
    includeUploads: z.boolean(),
  })
  .partial();

router.patch('/settings', validate(settingsSchema), async (req, res, next) => {
  try {
    const patch = req.body as z.infer<typeof settingsSchema>;
    const cfg = await updateBackupConfig(patch);
    await audit({ actorId: req.user?.id, action: 'admin.backup.settings', meta: patch });
    res.json({ ok: true, nextRunAt: nextRunAt(cfg) });
  } catch (err) {
    next(err);
  }
});

/** Starts a manual backup in the background; the panel polls GET / until `running` clears. */
router.post('/run', async (req, res, next) => {
  try {
    if (backupRunningState()) throw Conflict('A backup is already running');
    void runBackup('manual').catch((err) => logger.warn({ err }, 'manual backup failed'));
    await audit({ actorId: req.user?.id, action: 'admin.backup.run' });
    res.status(202).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const nameParams = z.object({ name: z.string().max(80) });

router.get('/:name/download', validate(nameParams, 'params'), async (req, res, next) => {
  try {
    const file = backupPath(req.params.name!);
    if (!file) throw BadRequest('Invalid backup name');
    await fsp.access(file).catch(() => {
      throw NotFound();
    });
    await audit({ actorId: req.user?.id, action: 'admin.backup.download', target: req.params.name });
    res.setHeader('Cache-Control', 'no-store');
    res.download(file, req.params.name!);
  } catch (err) {
    next(err);
  }
});

router.delete('/:name', validate(nameParams, 'params'), async (req, res, next) => {
  try {
    const file = backupPath(req.params.name!);
    if (!file) throw BadRequest('Invalid backup name');
    await fsp.unlink(file).catch(() => {
      throw NotFound();
    });
    await audit({ actorId: req.user?.id, action: 'admin.backup.delete', target: req.params.name });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
