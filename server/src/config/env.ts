import { z } from 'zod';

// Centralized, validated environment configuration.
//
// OWASP secrets guidance: never hard-code secrets/API keys/tokens in
// source. Load them from the process environment (populated locally via
// .env, which is gitignored, or injected by the platform/orchestrator in
// upper environments). Fail fast at startup if required values are
// missing or malformed rather than surfacing confusing errors later.
//
// parseEnv() is a pure function (no side effects, no dotenv loading) so
// it can be unit tested with arbitrary input. The actual process.env +
// dotenv wiring lives in loadEnv()/bootstrapDotenv() below, called once
// from the real entrypoint (index.ts), not from this module's import.

const originSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'must be a valid http(s) origin, e.g. https://app.example.com');

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    WEB_SOURCES: z
      .string()
      .optional()
      .transform((value) => 
        (value ?? '')
          .split(',')
          .map((source) => source.trim())),
    // Base URL of the entertainment search API. Optional, like
    // WEB_SOURCES/TRACKER_URLS: when unset, /api/entertainment reports a
    // 404 failure instead of the app refusing to start.
    ENTERTAINMENT_API_URL: z
      .string()
      .optional()
      .transform((value) => value ?? ''),
    TRACKER_URLS: z
      .string()
      .optional()
      .transform((value) => 
        (value ?? '')
          .split(',')
          .map((url) => url.trim())),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    // Comma-separated list of origins allowed to make cross-origin
    // requests to this API. Required and validated strictly in
    // production; falls back to the local Vite dev server origin
    // outside production so local dev works with zero config.
    CORS_ALLOWED_ORIGINS: z
      .string()
      .optional()
      .transform((value) =>
        (value ?? '')
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    // Only trust X-Forwarded-* headers when explicitly told a reverse
    // proxy sits in front of the app (e.g. in containerized upper
    // environments). Left disabled by default so rate limiting can't be
    // bypassed by spoofing X-Forwarded-For when there is no real proxy.
    TRUST_PROXY: z
      .string()
      .optional()
      .transform((value) => value === 'true'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
    // Optional database toggle: the app runs perfectly well with this
    // left false/unset (e.g. `docker compose up` with no db service).
    // Set DATABASE_ENABLED=true and provide DATABASE_URL to opt in
    // (e.g. when running `docker compose --profile db up -d`).
    DATABASE_ENABLED: z
      .string()
      .optional()
      .transform((value) => value === 'true'),
    DATABASE_URL: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.NODE_ENV === 'production' &&
      data.CORS_ALLOWED_ORIGINS.length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ALLOWED_ORIGINS'],
        message: 'CORS_ALLOWED_ORIGINS is required in production',
      });
      return;
    }
    for (const origin of data.CORS_ALLOWED_ORIGINS) {
      const result = originSchema.safeParse(origin);
      if (!result.success) {
        ctx.addIssue({
          code: 'custom',
          path: ['CORS_ALLOWED_ORIGINS'],
          message: `invalid origin "${origin}": must be a valid http(s) origin`,
        });
      }
    }
    if (data.DATABASE_ENABLED && !data.DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL is required when DATABASE_ENABLED=true',
      });
    }
  })
  .transform((data) => ({
    ...data,
    CORS_ALLOWED_ORIGINS:
      data.CORS_ALLOWED_ORIGINS.length > 0
        ? data.CORS_ALLOWED_ORIGINS
        : ['http://localhost:5173'],
  }));

export type Env = z.infer<typeof envSchema>;

/**
 * Builds a properly URL-encoded Postgres connection string from discrete
 * parts. Exists because docker-compose.yml can't safely interpolate a
 * raw password into a connection-string template — passwords containing
 * URI-reserved characters (@, :, /, #, %, etc.) would otherwise produce
 * an invalid or misparsed DATABASE_URL. Pure and unit-testable; called
 * from index.ts (not here) so this module stays free of process.env
 * access.
 */
export function buildDatabaseUrl(parts: {
  user: string;
  password: string;
  host: string;
  port: string | number;
  database: string;
}): string {
  const user = encodeURIComponent(parts.user);
  const password = encodeURIComponent(parts.password);
  const database = encodeURIComponent(parts.database);
  return `postgresql://${user}:${password}@${parts.host}:${parts.port}/${database}`;
}

/**
 * Derives DATABASE_URL from discrete POSTGRES_ and DATABASE_HOST/PORT
 * variables when it isn't already set explicitly, and the database
 * feature is enabled. Returns a new env object; never mutates its
 * input. No-op when DATABASE_URL is already present or the required
 * parts are missing (parseEnv's own validation will then report a
 * clear "DATABASE_URL is required" error).
 */
export function deriveDatabaseUrl(
  rawEnv: Record<string, string | undefined>,
): Record<string, string | undefined> {
  if (rawEnv.DATABASE_URL || rawEnv.DATABASE_ENABLED !== 'true') {
    return rawEnv;
  }

  const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB } = rawEnv;
  if (!POSTGRES_USER || !POSTGRES_PASSWORD || !POSTGRES_DB) {
    return rawEnv;
  }

  return {
    ...rawEnv,
    DATABASE_URL: buildDatabaseUrl({
      user: POSTGRES_USER,
      password: POSTGRES_PASSWORD,
      host: rawEnv.DATABASE_HOST ?? 'db',
      port: rawEnv.DATABASE_PORT ?? '5432',
      database: POSTGRES_DB,
    }),
  };
}

/** Pure parse — safe to unit test without touching process.env or dotenv. */
export function parseEnv(rawEnv: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(deriveDatabaseUrl(rawEnv));

  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(parsed.error)}`,
    );
  }

  return parsed.data;
}
