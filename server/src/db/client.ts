import { PrismaClient } from '@prisma/client';

/**
 * Lazily creates a PrismaClient. Only call this when env.DATABASE_ENABLED
 * is true (and DATABASE_URL is guaranteed to be set — enforced by the
 * env schema). Keeping this separate from module-load time means the
 * template works with zero database configuration by default: nothing
 * tries to connect unless the feature is explicitly opted into.
 */
export function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

export type { PrismaClient };
