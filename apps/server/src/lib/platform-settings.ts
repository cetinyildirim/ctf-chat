import type { PlatformBranding, RegistrationSettings } from '@sydt/shared';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import { resolveHomeServerId } from './migrate-default-server.js';

const CONFIG_ID = 'default';
const HARD_MAX_MB = 500;

const DEFAULTS: PlatformBranding = {
  platformTitle: 'SYDT',
  platformTagline: 'CTF Operations Console',
  workspaceLabel: 'Komuta',
  workspaceTitle: 'SYDT Chat',
  uploadMaxMb: env.UPLOAD_MAX_MB,
};

let cached: PlatformBranding | null = null;
let cacheAt = 0;
const CACHE_MS = 5_000;

async function loadRow() {
  try {
    return await prisma.appConfig.findUnique({ where: { id: CONFIG_ID } });
  } catch {
    return null;
  }
}

function rowToBranding(row: Awaited<ReturnType<typeof loadRow>>): PlatformBranding {
  if (!row) return { ...DEFAULTS };
  return {
    platformTitle: row.platformTitle || DEFAULTS.platformTitle,
    platformTagline: row.platformTagline || DEFAULTS.platformTagline,
    workspaceLabel: row.workspaceLabel || DEFAULTS.workspaceLabel,
    workspaceTitle: row.workspaceTitle || DEFAULTS.workspaceTitle,
    uploadMaxMb: Math.min(HARD_MAX_MB, Math.max(1, row.uploadMaxMb ?? env.UPLOAD_MAX_MB)),
  };
}

export async function getPlatformBranding(): Promise<PlatformBranding> {
  const now = Date.now();
  if (cached && now - cacheAt < CACHE_MS) return cached;
  cached = rowToBranding(await loadRow());
  cacheAt = now;
  return cached;
}

export async function getUploadMaxMb(): Promise<number> {
  return (await getPlatformBranding()).uploadMaxMb;
}

export function getUploadMaxBytesSync(): number {
  return (cached?.uploadMaxMb ?? env.UPLOAD_MAX_MB) * 1024 * 1024;
}

export async function setUploadMaxMb(mb: number): Promise<number> {
  const clamped = Math.min(HARD_MAX_MB, Math.max(1, Math.round(mb)));
  await prisma.appConfig.upsert({
    where: { id: CONFIG_ID },
    create: {
      id: CONFIG_ID,
      uploadMaxMb: clamped,
      platformTitle: DEFAULTS.platformTitle,
      platformTagline: DEFAULTS.platformTagline,
      workspaceLabel: DEFAULTS.workspaceLabel,
      workspaceTitle: DEFAULTS.workspaceTitle,
    },
    update: { uploadMaxMb: clamped },
  });
  cached = { ...(await getPlatformBranding()), uploadMaxMb: clamped };
  cacheAt = Date.now();
  return clamped;
}

export async function setPlatformBranding(
  patch: Partial<Omit<PlatformBranding, 'uploadMaxMb'>>,
): Promise<PlatformBranding> {
  const current = await getPlatformBranding();
  const next = {
    platformTitle: patch.platformTitle?.trim() || current.platformTitle,
    platformTagline: patch.platformTagline?.trim() || current.platformTagline,
    workspaceLabel: patch.workspaceLabel?.trim() || current.workspaceLabel,
    workspaceTitle: patch.workspaceTitle?.trim() || current.workspaceTitle,
    uploadMaxMb: current.uploadMaxMb,
  };
  await prisma.appConfig.upsert({
    where: { id: CONFIG_ID },
    create: { id: CONFIG_ID, ...next },
    update: next,
  });
  cached = next;
  cacheAt = Date.now();
  return next;
}

export async function getRegistrationSettings(): Promise<RegistrationSettings> {
  const row = await loadRow();
  const configuredId = (row as { defaultRegistrationServerId?: string | null } | null)
    ?.defaultRegistrationServerId ?? null;
  let effectiveServerId: string | null = null;
  let effectiveServerName: string | null = null;
  try {
    effectiveServerId = await resolveHomeServerId();
    const server = await prisma.chatServer.findUnique({
      where: { id: effectiveServerId },
      select: { name: true },
    });
    effectiveServerName = server?.name ?? null;
  } catch {
    effectiveServerId = null;
    effectiveServerName = null;
  }
  return {
    defaultRegistrationServerId: configuredId,
    effectiveServerId,
    effectiveServerName,
  };
}

export async function setDefaultRegistrationServerId(
  serverId: string | null,
): Promise<RegistrationSettings> {
  if (serverId) {
    const exists = await prisma.chatServer.findUnique({
      where: { id: serverId },
      select: { id: true },
    });
    if (!exists) {
      const { BadRequest } = await import('./http-error.js');
      throw BadRequest('Server not found');
    }
  }

  const branding = await getPlatformBranding();
  await prisma.appConfig.upsert({
    where: { id: CONFIG_ID },
    create: {
      id: CONFIG_ID,
      ...branding,
      defaultRegistrationServerId: serverId,
    },
    update: { defaultRegistrationServerId: serverId },
  });
  return getRegistrationSettings();
}

export async function warmPlatformSettingsCache(): Promise<void> {
  await getPlatformBranding();
}
