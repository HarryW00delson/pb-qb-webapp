import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { parseEnv } from './config/env.js';
import type { PrismaClient } from './db/client.js';

const baseEnv = parseEnv({
  NODE_ENV: 'test',
  CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
});

describe('GET /api/health', () => {
  it('returns 200 with a status of ok', async () => {
    const app = createApp(baseEnv);

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

describe('CORS', () => {
  it('allows requests from an allowlisted origin', async () => {
    const app = createApp(baseEnv);

    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
  });

  it('does not reflect a non-allowlisted origin', async () => {
    const app = createApp(baseEnv);

    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'http://evil.example.com');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('rate limiting', () => {
  it('returns 429 after exceeding the configured request limit', async () => {
    const app = createApp(
      parseEnv({
        NODE_ENV: 'test',
        CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
        RATE_LIMIT_MAX_REQUESTS: '2',
        RATE_LIMIT_WINDOW_MS: '60000',
      }),
    );

    await request(app).get('/api/health');
    await request(app).get('/api/health');
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(429);
  });
});

describe('optional database (/api/notes)', () => {
  it('is not mounted when DATABASE_ENABLED is false', async () => {
    const app = createApp(baseEnv);

    const response = await request(app).get('/api/notes');

    expect(response.status).toBe(404);
  });

  it('throws when DATABASE_ENABLED is true but no client is provided', () => {
    expect(() =>
      createApp(
        parseEnv({
          NODE_ENV: 'test',
          CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
          DATABASE_ENABLED: 'true',
          DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        }),
      ),
    ).toThrow(/no prismaClient was provided/);
  });

  it('lists and creates notes via the injected PrismaClient', async () => {
    const notes = [{ id: '1', content: 'hello', createdAt: new Date() }];
    const fakePrisma = {
      note: {
        findMany: vi.fn().mockResolvedValue(notes),
        create: vi
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: '2', createdAt: new Date(), ...data }),
          ),
      },
    } as unknown as PrismaClient;

    const app = createApp(
      parseEnv({
        NODE_ENV: 'test',
        CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
        DATABASE_ENABLED: 'true',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      }),
      { prismaClient: fakePrisma },
    );

    const listResponse = await request(app).get('/api/notes');
    expect(listResponse.status).toBe(200);
    expect(fakePrisma.note.findMany).toHaveBeenCalled();

    const createResponse = await request(app)
      .post('/api/notes')
      .send({ content: 'a new note' });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({ content: 'a new note' });
  });

  it('returns 400 for an invalid note payload', async () => {
    const fakePrisma = {
      note: { findMany: vi.fn(), create: vi.fn() },
    } as unknown as PrismaClient;

    const app = createApp(
      parseEnv({
        NODE_ENV: 'test',
        CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
        DATABASE_ENABLED: 'true',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      }),
      { prismaClient: fakePrisma },
    );

    const response = await request(app).post('/api/notes').send({});

    expect(response.status).toBe(400);
    expect(fakePrisma.note.create).not.toHaveBeenCalled();
  });

  it('returns a stable JSON 500 when a route handler rejects (e.g. DB failure)', async () => {
    const fakePrisma = {
      note: {
        findMany: vi.fn().mockRejectedValue(new Error('connection refused')),
        create: vi.fn(),
      },
    } as unknown as PrismaClient;

    const app = createApp(
      parseEnv({
        NODE_ENV: 'test',
        CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
        DATABASE_ENABLED: 'true',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      }),
      { prismaClient: fakePrisma },
    );

    const response = await request(app).get('/api/notes');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal server error' });
  });
});
