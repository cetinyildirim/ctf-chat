import dns from 'node:dns/promises';
import { BadRequest } from './http-error.js';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  'metadata.google.internal',
]);

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isBlockedIp(address: string): boolean {
  const lower = address.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (isPrivateIpv4(lower)) return true;
  if (lower === '::1') return true;
  if (lower.startsWith('fe80:')) return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  return false;
}

async function assertResolvedHostsSafe(hostname: string): Promise<void> {
  let records: Array<{ address: string }>;
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw BadRequest('URL host could not be resolved');
  }
  if (records.length === 0) throw BadRequest('URL host could not be resolved');
  for (const { address } of records) {
    if (isBlockedIp(address)) throw BadRequest('URL host is not allowed');
  }
}

/** Reject URLs that could target internal services (SSRF mitigation). */
export async function assertSafeOutboundUrl(raw: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw BadRequest('Invalid URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw BadRequest('URL must use http or https');
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) throw BadRequest('URL host is not allowed');
  if (host.endsWith('.local') || host.endsWith('.internal')) {
    throw BadRequest('URL host is not allowed');
  }
  if (isPrivateIpv4(host)) throw BadRequest('URL host is not allowed');

  if (!isPrivateIpv4(host) && !BLOCKED_HOSTNAMES.has(host)) {
    await assertResolvedHostsSafe(host);
  }

  return url.toString();
}

export function assertSafeOutboundUrlSync(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw BadRequest('Invalid URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw BadRequest('URL must use http or https');
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) throw BadRequest('URL host is not allowed');
  if (host.endsWith('.local') || host.endsWith('.internal')) {
    throw BadRequest('URL host is not allowed');
  }
  if (isPrivateIpv4(host)) throw BadRequest('URL host is not allowed');
  return url.toString();
}
