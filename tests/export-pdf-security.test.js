import { describe, expect, it, vi } from 'vitest';
import {
  HttpError,
  checkUpstashRateLimit,
  createMemoryRateLimiter,
  getClientIp,
  isOriginAllowed,
  validateContentLength,
  validatePdfPayload,
} from '../api/export-pdf-security.js';

describe('PDF export security helpers', () => {
  it('accepts only exact configured origins, not arbitrary Vercel subdomains', () => {
    const productionEnv = { NODE_ENV: 'production' };

    expect(isOriginAllowed('https://generatorsurat.vercel.app', productionEnv)).toBe(true);
    expect(isOriginAllowed('https://attacker.vercel.app', productionEnv)).toBe(false);
    expect(isOriginAllowed('https://generatorsurat.vercel.app.attacker.test', productionEnv)).toBe(false);
    expect(isOriginAllowed('', productionEnv)).toBe(false);
    expect(isOriginAllowed('https://generatorsurat.vercel.app/path', productionEnv)).toBe(false);
  });

  it('supports exact deployment and explicitly configured origins', () => {
    expect(isOriginAllowed('https://preview-123.vercel.app', {
      NODE_ENV: 'production',
      VERCEL_URL: 'preview-123.vercel.app',
    })).toBe(true);

    expect(isOriginAllowed('https://letters.example.id', {
      NODE_ENV: 'production',
      PDF_ALLOWED_ORIGINS: 'https://letters.example.id,https://admin.example.id',
    })).toBe(true);
  });

  it('prefers Vercel edge client IP headers and falls back to a validated address', () => {
    expect(getClientIp({
      'x-forwarded-for': '203.0.113.5, 10.0.0.1',
      'x-real-ip': '198.51.100.2',
    })).toBe('198.51.100.2');

    expect(getClientIp({
      'x-vercel-forwarded-for': '192.0.2.25',
      'x-forwarded-for': '203.0.113.5',
    })).toBe('192.0.2.25');

    expect(getClientIp({
      'x-forwarded-for': '203.0.113.5, 10.0.0.1',
    })).toBe('203.0.113.5');

    expect(getClientIp({
      'x-forwarded-for': 'not-an-ip',
      'x-real-ip': '198.51.100.2',
    })).toBe('198.51.100.2');

    expect(getClientIp({ 'x-forwarded-for': 'fake' }, '127.0.0.1')).toBe('127.0.0.1');
  });

  it('enforces a bounded fixed-window memory rate limit', () => {
    let now = 1_000;
    const limiter = createMemoryRateLimiter({
      limit: 2,
      windowMs: 1_000,
      maxEntries: 1,
      now: () => now,
    });

    expect(limiter.check('client-a').allowed).toBe(true);
    expect(limiter.check('client-a').allowed).toBe(true);
    expect(limiter.check('client-a').allowed).toBe(false);
    expect(limiter.size()).toBe(1);

    now += 1_001;
    expect(limiter.check('client-a').allowed).toBe(true);
  });

  it('rejects malformed and oversized Content-Length headers', () => {
    expect(() => validateContentLength('not-a-number', 100))
      .toThrowError(HttpError);
    expect(() => validateContentLength('101', 100))
      .toThrowError(HttpError);
    expect(validateContentLength('100', 100)).toBe(100);
    expect(validateContentLength(undefined, 100)).toBeNull();
  });

  it('validates payload types, byte limits, and paper dimensions', () => {
    expect(validatePdfPayload({
      html: '<main>Surat</main>',
      css: 'body { color: black; }',
    })).toMatchObject({ widthMm: 210, heightMm: 297, filename: 'Surat.pdf' });

    expect(() => validatePdfPayload({ html: '', css: '' })).toThrowError(HttpError);
    expect(() => validatePdfPayload({ html: '<p>surat</p>', css: 'x'.repeat(20) }, {
      maxCssBytes: 10,
    })).toThrowError(HttpError);
    expect(() => validatePdfPayload({
      html: '<p>surat</p>', css: '', widthMm: 1, heightMm: 297,
    })).toThrowError(HttpError);
    expect(() => validatePdfPayload({
      html: '<p>surat</p>', css: '', widthMm: 900, heightMm: 900,
    })).toThrowError(HttpError);
  });

  it('uses the distributed Upstash limiter when credentials are provided', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: [3, 20_000] }),
    });

    const result = await checkUpstashRateLimit('203.0.113.5', {
      env: {
        UPSTASH_REDIS_REST_URL: 'https://redis.example.com',
        UPSTASH_REDIS_REST_TOKEN: 'test-token',
      },
      fetchImpl,
      limit: 10,
      windowMs: 60_000,
      now: () => 50_000,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ allowed: true, remaining: 7, resetAt: 70_000, distributed: true });
  });

  it('fails closed when only one Upstash credential is configured', async () => {
    await expect(checkUpstashRateLimit('203.0.113.5', {
      env: { UPSTASH_REDIS_REST_URL: 'https://redis.example.com' },
      fetchImpl: vi.fn(),
    })).rejects.toThrow(/belum lengkap/i);
  });
});
