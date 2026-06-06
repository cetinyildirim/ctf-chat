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

export function isInlineSafeMime(mime: string): boolean {
  const normalized = normalizeMime(mime);
  return (
    normalized.startsWith('image/') &&
    normalized !== 'image/svg+xml' &&
    !BLOCKED_MESSAGE_MIMES.has(normalized)
  );
}
