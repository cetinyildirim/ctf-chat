import { PrismaClient } from '@prisma/client';
import { isDev } from './env.js';

declare global {

  var __sydt_prisma__: PrismaClient | undefined;
}

export const prisma =
  global.__sydt_prisma__ ??
  new PrismaClient({
    log: isDev ? ['warn', 'error'] : ['error'],
  });

if (isDev) {
  global.__sydt_prisma__ = prisma;
}
