/**
 * Upload malware scanning through a local clamd daemon (INSTREAM protocol).
 *
 * Fail-open by design: if clamd is disabled, down or times out, the upload is
 * accepted and the problem is logged, so a scanner outage never blocks the
 * competition. Only a positive detection rejects a file. clamd also unpacks
 * zip/gzip/tar, so executables hidden inside archives are caught.
 */
import net from 'node:net';
import { createReadStream } from 'node:fs';
import { env } from '../env.js';
import { logger } from './logger.js';
import { BadRequest } from './http-error.js';
import { unlinkQuiet } from './upload.js';

export type ScanResult =
  | { status: 'clean' }
  | { status: 'infected'; signature: string }
  | { status: 'skipped' }
  | { status: 'error'; reason: string };

function connect(): net.Socket {
  return env.CLAMAV_HOST
    ? net.createConnection({ host: env.CLAMAV_HOST, port: env.CLAMAV_PORT })
    : net.createConnection({ path: env.CLAMAV_SOCKET });
}

export function scanFile(filePath: string): Promise<ScanResult> {
  if (!env.CLAMAV_ENABLED) return Promise.resolve({ status: 'skipped' });

  return new Promise((resolve) => {
    let settled = false;
    let reply = '';
    const socket = connect();
    const file = createReadStream(filePath, { highWaterMark: 64 * 1024 });

    const finish = (result: ScanResult) => {
      if (settled) return;
      settled = true;
      file.destroy();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(env.CLAMAV_TIMEOUT_MS, () => finish({ status: 'error', reason: 'timeout' }));
    socket.on('error', (err) => finish({ status: 'error', reason: err.message }));
    file.on('error', (err) => finish({ status: 'error', reason: err.message }));

    socket.on('data', (chunk) => {
      reply += chunk.toString('utf8');
    });
    socket.on('end', () => {
      const text = reply.replace(/\0/g, '').trim();
      const found = /^stream: (.+) FOUND$/.exec(text);
      if (found) finish({ status: 'infected', signature: found[1]! });
      else if (text === 'stream: OK') finish({ status: 'clean' });
      else finish({ status: 'error', reason: text || 'empty reply' });
    });

    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      file.on('data', (chunk) => {
        const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
        const size = Buffer.alloc(4);
        size.writeUInt32BE(buf.length, 0);
        if (!socket.write(Buffer.concat([size, buf]))) {
          file.pause();
          socket.once('drain', () => file.resume());
        }
      });
      file.on('end', () => socket.write(Buffer.alloc(4)));
    });
  });
}

/** Rejects (and deletes) an infected upload; any scanner failure lets it through with a warning. */
export async function assertUploadNotInfected(filePath: string, displayName: string): Promise<void> {
  const result = await scanFile(filePath);
  if (result.status === 'infected') {
    await unlinkQuiet(filePath);
    logger.warn({ file: displayName, signature: result.signature }, 'upload rejected by antivirus');
    throw BadRequest(`File failed the security scan: ${displayName}`, 'UPLOAD_INFECTED');
  }
  if (result.status === 'error') {
    logger.warn({ file: displayName, reason: result.reason }, 'antivirus scan unavailable; upload accepted');
  }
}
