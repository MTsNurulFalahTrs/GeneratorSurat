import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

const DEFAULT_HTML_LIMIT = 3 * 1024 * 1024;
const DEFAULT_CSS_LIMIT = 2 * 1024 * 1024;

function normalizeConfiguredOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  try {
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : 'https://' + raw;
    const url = new URL(candidate);
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== '/' && url.pathname !== '') return null;
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Browser CORS is an origin boundary, not authentication. Only exact origins
 * are accepted; arbitrary *.vercel.app hosts are deliberately not trusted.
 */
export function isOriginAllowed(origin, env = process.env) {
  if (typeof origin !== 'string' || !origin.trim()) return false;

  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.origin !== origin || parsed.username || parsed.password) return false;

  const allowed = new Set(['https://generatorsurat.vercel.app']);

  for (const key of ['VERCEL_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_PRODUCTION_URL']) {
    const value = normalizeConfiguredOrigin(env?.[key]);
    if (value) allowed.add(value);
  }

  String(env?.PDF_ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => normalizeConfiguredOrigin(value))
    .filter(Boolean)
    .forEach(value => allowed.add(value));

  const isLoopback = parsed.hostname === 'localhost'
    || parsed.hostname === '127.0.0.1'
    || parsed.hostname === '[::1]';

  if (isLoopback && env?.NODE_ENV !== 'production') {
    allowed.add(parsed.origin);
  }

  return allowed.has(origin);
}

export function getClientIp(headers = {}, remoteAddress = '') {
  // Vercel documents x-real-ip and x-vercel-forwarded-for as client-IP
  // headers generated at its edge. Prefer them over the general XFF chain.
  const candidates = [
    String(headers['x-real-ip'] || '').trim(),
    String(headers['x-vercel-forwarded-for'] || '').split(',')[0].trim(),
    String(headers['x-forwarded-for'] || '').split(',')[0].trim(),
    String(remoteAddress || '').trim(),
  ];

  for (const candidate of candidates) {
    const unwrapped = candidate.startsWith('[') && candidate.endsWith(']')
      ? candidate.slice(1, -1)
      : candidate;
    if (isIP(unwrapped)) return unwrapped.toLowerCase();
  }

  return 'unknown';
}

/** Bounded fixed-window limiter for local development and single-instance fallback. */
export function createMemoryRateLimiter({
  limit = 10,
  windowMs = 60_000,
  maxEntries = 10_000,
  now = Date.now,
} = {}) {
  const records = new Map();

  return {
    check(key) {
      const timestamp = now();

      for (const [entryKey, record] of records) {
        if (timestamp - record.windowStart >= windowMs) records.delete(entryKey);
      }

      const current = records.get(key);
      if (!current || timestamp - current.windowStart >= windowMs) {
        if (!records.has(key) && records.size >= maxEntries) {
          const oldestKey = records.keys().next().value;
          if (oldestKey !== undefined) records.delete(oldestKey);
        }
        records.set(key, { count: 1, windowStart: timestamp });
        return {
          allowed: true,
          limit,
          remaining: Math.max(0, limit - 1),
          resetAt: timestamp + windowMs,
        };
      }

      current.count += 1;
      const resetAt = current.windowStart + windowMs;
      return {
        allowed: current.count <= limit,
        limit,
        remaining: Math.max(0, limit - current.count),
        resetAt,
      };
    },
    size() {
      return records.size;
    },
  };
}

export function validateContentLength(headerValue, maxBytes) {
  if (headerValue === undefined || headerValue === null || headerValue === '') return null;

  const raw = String(headerValue).trim();
  if (!/^\d+$/.test(raw)) {
    throw new HttpError(400, 'Header Content-Length tidak valid.');
  }

  const length = Number(raw);
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new HttpError(400, 'Header Content-Length tidak valid.');
  }
  if (length > maxBytes) {
    throw new HttpError(413, 'Payload terlalu besar.');
  }
  return length;
}

export function parseJsonBody(req) {
  if (req?.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    return req.body;
  }

  if (typeof req?.body === 'string') {
    try {
      const value = JSON.parse(req.body);
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Payload JSON harus berupa object.');
      }
      return value;
    } catch {
      throw new HttpError(400, 'Payload JSON tidak valid.');
    }
  }

  throw new HttpError(400, 'Payload ekspor PDF tidak tersedia.');
}

export function validatePdfPayload(payload, {
  maxHtmlBytes = DEFAULT_HTML_LIMIT,
  maxCssBytes = DEFAULT_CSS_LIMIT,
  maxDimensionMm = 900,
  maxAreaMm2 = 600_000,
} = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new HttpError(400, 'Payload ekspor PDF tidak valid.');
  }

  if (typeof payload.html !== 'string' || !payload.html.trim()) {
    throw new HttpError(400, 'HTML Preview Surat tidak tersedia.');
  }
  if (typeof payload.css !== 'string') {
    throw new HttpError(400, 'CSS Preview Surat tidak valid.');
  }

  const htmlBytes = Buffer.byteLength(payload.html, 'utf8');
  const cssBytes = Buffer.byteLength(payload.css, 'utf8');
  if (htmlBytes > maxHtmlBytes) throw new HttpError(413, 'Ukuran HTML Preview terlalu besar.');
  if (cssBytes > maxCssBytes) throw new HttpError(413, 'Ukuran CSS Preview terlalu besar.');

  const widthMm = payload.widthMm === undefined ? 210 : Number(payload.widthMm);
  const heightMm = payload.heightMm === undefined ? 297 : Number(payload.heightMm);

  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)
      || widthMm < 50 || heightMm < 50
      || widthMm > maxDimensionMm || heightMm > maxDimensionMm
      || widthMm * heightMm > maxAreaMm2) {
    throw new HttpError(400, 'Dimensi kertas tidak didukung.');
  }

  return {
    html: payload.html,
    css: payload.css,
    widthMm,
    heightMm,
    filename: sanitizePdfFilename(payload.filename),
  };
}

export function sanitizePdfFilename(filename) {
  const value = String(filename || 'Surat')
    .replace(/[\\/:*?"<>|\x00-\x1F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

  const base = value || 'Surat';
  return base.toLowerCase().endsWith('.pdf') ? base : base + '.pdf';
}

const UPSTASH_SCRIPT = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('PTTL', KEYS[1])",
  "return {count, ttl}",
].join('\n');

export function isUpstashConfigured(env = process.env) {
  return Boolean(env?.UPSTASH_REDIS_REST_URL && env?.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Distributed rate limiting through Upstash Redis REST, without adding a
 * runtime dependency. Returns null when no Upstash credentials are configured.
 */
export async function checkUpstashRateLimit(clientIp, {
  env = process.env,
  fetchImpl = globalThis.fetch,
  limit = 10,
  windowMs = 60_000,
  timeoutMs = 2_000,
  now = Date.now,
} = {}) {
  const hasUrl = Boolean(env?.UPSTASH_REDIS_REST_URL);
  const hasToken = Boolean(env?.UPSTASH_REDIS_REST_TOKEN);
  if (!hasUrl && !hasToken) return null;
  if (!hasUrl || !hasToken) {
    throw new Error('Konfigurasi rate limit Redis belum lengkap.');
  }
  if (typeof fetchImpl !== 'function') throw new Error('Fetch tidak tersedia untuk rate limit Redis.');

  let endpoint;
  try {
    endpoint = new URL(env.UPSTASH_REDIS_REST_URL);
  } catch {
    throw new Error('URL Redis rate limit tidak valid.');
  }
  if (endpoint.protocol !== 'https:') {
    throw new Error('URL Redis rate limit harus menggunakan HTTPS.');
  }

  const ipHash = createHash('sha256').update(String(clientIp || 'unknown')).digest('hex');
  const key = 'generator-surat:pdf-rate:' + ipHash;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(endpoint.toString(), {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.UPSTASH_REDIS_REST_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['EVAL', UPSTASH_SCRIPT, '1', key, String(windowMs)]),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error('Redis rate limit mengembalikan HTTP ' + response.status + '.');
    const body = await response.json();
    const result = body?.result;
    const count = Number(Array.isArray(result) ? result[0] : NaN);
    const ttl = Number(Array.isArray(result) ? result[1] : NaN);
    if (!Number.isFinite(count) || count < 1 || !Number.isFinite(ttl)) {
      throw new Error('Respons Redis rate limit tidak valid.');
    }

    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt: now() + Math.max(0, ttl),
      distributed: true,
    };
  } finally {
    clearTimeout(timer);
  }
}
