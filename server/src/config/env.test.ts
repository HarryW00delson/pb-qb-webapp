import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

describe('parseEnv', () => {
  it('applies sensible defaults outside production', () => {
    const env = parseEnv({ NODE_ENV: 'development' });

    expect(env.PORT).toBe(3001);
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(['http://localhost:5173']);
    expect(env.TRUST_PROXY).toBe(false);
  });

  it('throws when PORT is not a valid number', () => {
    expect(() => parseEnv({ PORT: 'not-a-number' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('throws when CORS_ALLOWED_ORIGINS is missing in production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(
      /CORS_ALLOWED_ORIGINS is required in production/,
    );
  });

  it('throws when an origin is malformed', () => {
    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        CORS_ALLOWED_ORIGINS: 'not-a-valid-origin',
      }),
    ).toThrow(/invalid origin/);
  });

  it('accepts multiple comma-separated origins', () => {
    const env = parseEnv({
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: 'https://a.example.com, https://b.example.com',
    });

    expect(env.CORS_ALLOWED_ORIGINS).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
  });

  it('parses TRUST_PROXY=true', () => {
    const env = parseEnv({ TRUST_PROXY: 'true' });
    expect(env.TRUST_PROXY).toBe(true);
  });

  it('defaults the database feature to disabled', () => {
    const env = parseEnv({ NODE_ENV: 'development' });

    expect(env.DATABASE_ENABLED).toBe(false);
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it('throws when DATABASE_ENABLED is true but DATABASE_URL is missing', () => {
    expect(() => parseEnv({ DATABASE_ENABLED: 'true' })).toThrow(
      /DATABASE_URL is required when DATABASE_ENABLED=true/,
    );
  });

  it('accepts DATABASE_ENABLED=true with a DATABASE_URL', () => {
    const env = parseEnv({
      DATABASE_ENABLED: 'true',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    });

    expect(env.DATABASE_ENABLED).toBe(true);
    expect(env.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
  });

  it('derives a URL-encoded DATABASE_URL from discrete POSTGRES_* parts', () => {
    const env = parseEnv({
      DATABASE_ENABLED: 'true',
      POSTGRES_USER: 'app',
      POSTGRES_PASSWORD: 'p@ss:w/rd#1%',
      POSTGRES_DB: 'app',
      DATABASE_HOST: 'db',
      DATABASE_PORT: '5432',
    });

    expect(env.DATABASE_URL).toBe(
      'postgresql://app:p%40ss%3Aw%2Frd%231%25@db:5432/app',
    );
  });

  it('prefers an explicit DATABASE_URL over discrete POSTGRES_* parts', () => {
    const env = parseEnv({
      DATABASE_ENABLED: 'true',
      DATABASE_URL: 'postgresql://explicit:url@localhost:5432/explicit',
      POSTGRES_USER: 'ignored',
      POSTGRES_PASSWORD: 'ignored',
      POSTGRES_DB: 'ignored',
    });

    expect(env.DATABASE_URL).toBe(
      'postgresql://explicit:url@localhost:5432/explicit',
    );
  });
});
