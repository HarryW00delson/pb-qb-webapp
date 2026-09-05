import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import type { Env } from './config/env.js';
import type { PrismaClient } from './db/client.js';
import { createNotesRouter } from './routes/notes.js';

export interface AppDependencies {
  // Allows tests to inject a fake/mocked PrismaClient instead of the
  // real one, so the test suite never needs a live database.
  prismaClient?: PrismaClient;
}

export function createApp(env: Env, deps: AppDependencies = {}) {
  if (env.DATABASE_ENABLED && !deps.prismaClient) {
    // Fail loudly rather than silently omitting /api/notes: this
    // indicates a wiring bug (DATABASE_ENABLED=true should always come
    // with a PrismaClient from index.ts), not a valid "database
    // disabled" state that callers should mistake for a 404.
    throw new Error(
      'DATABASE_ENABLED is true but no prismaClient was provided to createApp()',
    );
  }

  const app = express();

  // OWASP baseline hardening -------------------------------------------
  // Only trust X-Forwarded-* headers when a real reverse proxy is known
  // to be in front of the app (set TRUST_PROXY=true in that case).
  // Left disabled by default: trusting it unconditionally lets clients
  // spoof X-Forwarded-For and bypass the rate limiter below.
  if (env.TRUST_PROXY) {
    app.set('trust proxy', 1);
  }

  // Sets a broad set of secure HTTP response headers (CSP, no-sniff,
  // frameguard, HSTS in production, etc.) and removes X-Powered-By.
  app.use(helmet());

  // Restrict cross-origin requests to an explicit allowlist rather than
  // reflecting any origin or defaulting to "*".
  app.use(
    cors({
      origin: env.CORS_ALLOWED_ORIGINS,
    }),
  );

  // Basic brute-force / abuse mitigation. Tune per-route as needed once
  // authentication endpoints exist.
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      limit: env.RATE_LIMIT_MAX_REQUESTS,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use(express.json({ limit: '100kb' }));
  // ----------------------------------------------------------------------

  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/api/web-sources', (_req: Request, res: Response) => {
    if (env.WEB_SOURCES) {
      res.status(200).json({
        status: 'ok',
        err: false,
        webSources: env.WEB_SOURCES,
        message: null
      })
    } else {
      res.status(404).json({
        status: 'failure',
        err: true,
        webSources: null,
        message: 'No Web Sources Configured'
      })
    }
  });

  app.get('/api/entertainment', (req: Request, res: Response) => {
    if (env.ENTERTAINMENT_API_URL) {
      // Placeholder handler: proves end-to-end connectivity with the
      // client before the real search integration lands.
      const query = typeof req.query.q === 'string' ? req.query.q : '';
      res.status(200).json({
        status: 'ok',
        err: false,
        query,
        message: null,
      });
    } else {
      res.status(404).json({
        status: 'failure',
        err: true,
        query: null,
        message: 'No Entertainment API Configured',
      });
    }
  });

  // Optional database (see server/prisma/schema.prisma and .env.example).
  // Nothing here runs, and no connection is attempted, unless
  // DATABASE_ENABLED=true.
  if (env.DATABASE_ENABLED && deps.prismaClient) {
    app.use('/api/notes', createNotesRouter(deps.prismaClient));
  }

  // Terminal JSON error handler — normalizes any error thrown/rejected
  // by route handlers (e.g. a Prisma connectivity failure) into a
  // stable JSON response instead of Express's default HTML error page.
  // Must be registered last and take 4 args for Express to treat it as
  // an error handler.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express only recognizes error middleware with this 4-arg signature.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
