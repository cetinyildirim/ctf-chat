import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be >= 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be >= 16 chars'),
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  COOKIE_DOMAIN: z.string().optional().default(''),
  COOKIE_SECURE: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .transform((v) => v === true || v === 'true')
    .default(false),
  ALLOW_BEARER_AUTH: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === 'true')),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  UPLOAD_DIR: z.string().default('uploads'),
  UPLOAD_MAX_MB: z.coerce.number().positive().max(500).default(100),
  SERVER_INVITE_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(7),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';

/** Bearer auth disabled in production unless explicitly enabled. */
export const allowBearerAuth = env.ALLOW_BEARER_AUTH ?? !isProd;

if (isProd) {
  if (!env.COOKIE_SECURE) {
    console.error('COOKIE_SECURE must be true in production');
    process.exit(1);
  }
  if (env.CORS_ORIGIN.split(',').some((o) => o.trim() === '*')) {
    console.error('Wildcard CORS_ORIGIN is not allowed in production');
    process.exit(1);
  }
  if (env.ALLOW_BEARER_AUTH === true) {
    console.warn('ALLOW_BEARER_AUTH is enabled in production — prefer cookie-only auth');
  }
}
