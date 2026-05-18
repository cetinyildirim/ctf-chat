export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, message: string, code = 'ERROR', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const BadRequest = (msg = 'Bad request', code = 'BAD_REQUEST', details?: unknown) =>
  new HttpError(400, msg, code, details);
export const Unauthorized = (msg = 'Unauthorized', code = 'UNAUTHORIZED') =>
  new HttpError(401, msg, code);
export const Forbidden = (msg = 'Forbidden', code = 'FORBIDDEN') => new HttpError(403, msg, code);
export const NotFound = (msg = 'Not found', code = 'NOT_FOUND') => new HttpError(404, msg, code);
export const Conflict = (msg = 'Conflict', code = 'CONFLICT') => new HttpError(409, msg, code);
export const TooMany = (msg = 'Too many requests', code = 'RATE_LIMIT') =>
  new HttpError(429, msg, code);
