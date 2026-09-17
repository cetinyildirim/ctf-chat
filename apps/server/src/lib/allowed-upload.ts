const ALLOWED_MESSAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
  'audio/mpeg',
  'audio/wav',
  'video/mp4',
  'video/webm',
]);

const BLOCKED_MESSAGE_MIMES = new Set([
  'text/html',
  'application/javascript',
  'text/javascript',
  'image/svg+xml',
  'application/xhtml+xml',
]);

function normalizeMime(mime: string): string {
  return (mime || 'application/octet-stream').split(';')[0]!.trim().toLowerCase();
}

export function isAllowedMessageUpload(mime: string): boolean {
  const normalized = normalizeMime(mime);
  if (BLOCKED_MESSAGE_MIMES.has(normalized)) return false;
  if (ALLOWED_MESSAGE_MIMES.has(normalized)) return true;
  if (normalized.startsWith('image/') && normalized !== 'image/svg+xml') return true;
  if (normalized.startsWith('audio/')) return true;
  if (normalized.startsWith('video/')) return true;
  return false;
}

/** Match declared MIME to magic bytes (first 4KB). */
export async function verifyMessageUploadFile(
  filePath: string,
  claimedMime: string,
): Promise<string> {
  const claimed = normalizeMime(claimedMime);
  if (!isAllowedMessageUpload(claimed)) {
    throw new Error(`File type not allowed: ${claimed}`);
  }

  if (claimed === 'text/plain') {
    const { open } = await import('node:fs/promises');
    const fh = await open(filePath, 'r');
    try {
      const sample = Buffer.alloc(Math.min(8192, 8192));
      const { bytesRead } = await fh.read(sample, 0, sample.length, 0);
      const slice = sample.subarray(0, bytesRead);
      if (slice.includes(0)) throw new Error('Invalid plain text file');
    } finally {
      await fh.close();
    }
    return claimed;
  }

  const { fileTypeFromFile } = await import('file-type');
  const detected = await fileTypeFromFile(filePath);
  const detectedMime = detected?.mime ? normalizeMime(detected.mime) : null;

  if (!detectedMime) {
    throw new Error('Could not detect file type');
  }
  if (!isAllowedMessageUpload(detectedMime)) {
    throw new Error(`Detected file type not allowed: ${detectedMime}`);
  }
  if (detectedMime !== claimed && !(claimed.startsWith('image/') && detectedMime.startsWith('image/'))) {
    throw new Error('File content does not match declared type');
  }
  return detectedMime;
}

/**
 * Ticket evidence types (spec §16): screenshots, logs, error output, PDFs and
 * packet captures. Media (audio/video) is deliberately excluded — a ticket is
 * not a place to upload a movie — and the message blocklist still applies.
 */
const ALLOWED_TICKET_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
  'application/gzip',
  'application/x-tar',
  'application/vnd.tcpdump.pcap',
  'application/x-pcapng',
]);

/** Types checked as text (no magic bytes) rather than by signature. */
const TEXT_LIKE_TICKET_MIMES = new Set([
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
]);

export function isAllowedTicketUpload(mime: string): boolean {
  const normalized = normalizeMime(mime);
  if (BLOCKED_MESSAGE_MIMES.has(normalized)) return false;
  if (ALLOWED_TICKET_MIMES.has(normalized)) return true;
  return normalized.startsWith('image/') && normalized !== 'image/svg+xml';
}

/**
 * Confirms the bytes match the declared type, so a competitor cannot smuggle an
 * HTML/script payload behind a `.png` name and MIME (spec §37 file security).
 */
export async function verifyTicketUploadFile(
  filePath: string,
  claimedMime: string,
): Promise<string> {
  const claimed = normalizeMime(claimedMime);
  if (!isAllowedTicketUpload(claimed)) {
    throw new Error(`File type not allowed: ${claimed}`);
  }

  if (TEXT_LIKE_TICKET_MIMES.has(claimed)) {
    const { open } = await import('node:fs/promises');
    const fh = await open(filePath, 'r');
    try {
      const sample = Buffer.alloc(8192);
      const { bytesRead } = await fh.read(sample, 0, sample.length, 0);
      // Binary payloads renamed to .log/.txt are rejected outright.
      if (sample.subarray(0, bytesRead).includes(0)) {
        throw new Error('Invalid text file');
      }
    } finally {
      await fh.close();
    }
    return claimed;
  }

  const { fileTypeFromFile } = await import('file-type');
  const detected = await fileTypeFromFile(filePath);
  const detectedMime = detected?.mime ? normalizeMime(detected.mime) : null;
  if (!detectedMime) throw new Error('Could not detect file type');
  if (!isAllowedTicketUpload(detectedMime)) {
    throw new Error(`Detected file type not allowed: ${detectedMime}`);
  }
  const bothImages = claimed.startsWith('image/') && detectedMime.startsWith('image/');
  const bothArchives = /zip|gzip|tar/.test(claimed) && /zip|gzip|tar/.test(detectedMime);
  if (detectedMime !== claimed && !bothImages && !bothArchives) {
    throw new Error('File content does not match declared type');
  }
  return detectedMime;
}

export function isInlineSafeMime(mime: string): boolean {
  const normalized = normalizeMime(mime);
  return (
    normalized.startsWith('image/') &&
    normalized !== 'image/svg+xml' &&
    !BLOCKED_MESSAGE_MIMES.has(normalized)
  );
}
