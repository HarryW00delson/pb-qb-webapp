import 'dotenv/config';
import { createApp } from './app.js';
import { parseEnv } from './config/env.js';
import { createPrismaClient } from './db/client.js';

let env;
try {
  env = parseEnv(process.env);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

// Prisma reads DATABASE_URL directly from process.env (via the
// env("DATABASE_URL") call in schema.prisma), not from our parsed env
// object — so when deriveDatabaseUrl() (inside parseEnv) computed it
// from discrete POSTGRES_* parts, that derived/encoded value must be
// written back for Prisma to see it.
if (env.DATABASE_ENABLED && env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

const prismaClient = env.DATABASE_ENABLED ? createPrismaClient() : undefined;

const app = createApp(env, { prismaClient });

const server = app.listen(env.PORT, () => {
  console.log(`Server listening on port ${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    void (async () => {
      if (prismaClient) {
        await prismaClient.$disconnect();
      }
      process.exit(0);
    })();
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
