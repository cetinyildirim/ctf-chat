import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

type Source = 'body' | 'query' | 'params';

export function validate<S extends ZodTypeAny>(schema: S, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error);
      return;
    }
    (req as unknown as Record<Source, z.infer<S>>)[source] = result.data;
    next();
  };
}

/**
 * Same validation, for handlers that must normalize the payload themselves
 * (multipart requests, where every field arrives as a string).
 */
export function parseOrThrow<S extends ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw result.error;
  return result.data;
}
