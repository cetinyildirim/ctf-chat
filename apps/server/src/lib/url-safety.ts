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

/** RFC1918 + CGNAT — typical LAN / corporate CTF ranges. */
export function isLanIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return false;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isLoopbackOrLinkLocalIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  return false;
}

function isBlockedIpStrict(address: string): boolean {
  const lower = address.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (isLoopbackOrLinkLocalIpv4(lower)) return true;
  if (isLanIpv4(lower)) return true;
  if (lower === '::1') return true;
  if (lower.startsWith('fe80:')) return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  return false;
}

/** CTFd may live on LAN; still block loopback / link-local / metadata. */
function isBlockedIpForCtfd(address: string): boolean {
  const lower = address.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (isLoopbackOrLinkLocalIpv4(lower)) return true;
  if (lower === '::1') return true;
  if (lower.startsWith('fe80:')) return true;
  return false;
}

async function assertResolvedHosts(
  hostname: string,
  isBlocked: (address: string) => boolean,
): Promise<void> {
  let records: Array<{ address: string }>;
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw BadRequest('URL host could not be resolved');
  }
  if (records.length === 0) throw BadRequest('URL host could not be resolved');
  for (const { address } of records) {
    if (isBlocked(address)) throw BadRequest('URL host is not allowed');
  }
}

function parseHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw BadRequest('Invalid URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw BadRequest('URL must use http or https');
  }
  return url;
}

/** Reject URLs that could target internal services (SSRF mitigation) — webhooks etc. */
export async function assertSafeOutboundUrl(raw: string): Promise<string> {
  const url = parseHttpUrl(raw);
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) throw BadRequest('URL host is not allowed');
  if (host.endsWith('.local') || host.endsWith('.internal')) {
    throw BadRequest('URL host is not allowed');
  }
  if (isLanIpv4(host) || isLoopbackOrLinkLocalIpv4(host)) {
    throw BadRequest('URL host is not allowed');
  }
  await assertResolvedHosts(host, isBlockedIpStrict);
  return url.toString();
}

export function assertSafeOutboundUrlSync(raw: string): string {
  const url = parseHttpUrl(raw);
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) throw BadRequest('URL host is not allowed');
  if (host.endsWith('.local') || host.endsWith('.internal')) {
    throw BadRequest('URL host is not allowed');
  }
  if (isLanIpv4(host) || isLoopbackOrLinkLocalIpv4(host)) {
    throw BadRequest('URL host is not allowed');
  }
  return url.toString();
}

/**
 * CTFd is often hosted on a private LAN IP (e.g. https://10.0.0.10).
 * Allow RFC1918 / CGNAT literals and LAN DNS names; still block loopback & metadata.
 */
export async function assertCtfdOutboundUrl(raw: string): Promise<string> {
  const url = parseHttpUrl(raw);
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) throw BadRequest('URL host is not allowed');
  if (isLoopbackOrLinkLocalIpv4(host)) throw BadRequest('URL host is not allowed');
  if (isLanIpv4(host)) return url.toString();
  await assertResolvedHosts(host, isBlockedIpForCtfd);
  return url.toString();
}

/** Self-signed HTTPS is common for LAN CTFd — skip TLS verify only for private IPs. */
export function ctfdAllowsInsecureTls(hostname: string): boolean {
  return isLanIpv4(hostname.toLowerCase());
}
