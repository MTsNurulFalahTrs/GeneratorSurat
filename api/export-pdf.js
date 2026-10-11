import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_CSS_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION_MM = 1000;

// ──────────────────────────────────────────────────────────────
// Rate Limiter — Token Bucket per IP
// ──────────────────────────────────────────────────────────────
// Setiap IP mendapat jatah RATE_LIMIT_MAX request per window
// RATE_LIMIT_WINDOW_MS. Jika melebihi, dikembalikan 429.
//
// Catatan arsitektur serverless:
// Map in-memory ini hidup di satu instance Vercel Function.
// Di production dengan traffic tinggi, Vercel bisa menjalankan
// beberapa instance paralel — masing-masing punya map sendiri.
// Untuk rate limiting yang ketat lintas-instance, gunakan
// Vercel KV (Redis). Untuk aplikasi madrasah dengan usage normal
// (beberapa user per hari), implementasi ini sudah memadai:
// satu instance biasanya menangani semua request dari satu sesi.
// ──────────────────────────────────────────────────────────────

const RATE_LIMIT_MAX        = 10;               // maks request per IP per window
const RATE_LIMIT_WINDOW_MS  = 60 * 1000;        // window 1 menit
const RATE_LIMIT_CLEANUP_MS = 5 * 60 * 1000;   // bersihkan entry lama tiap 5 menit

/** @type {Map<string, { count: number, windowStart: number }>} */
const _rateLimitMap = new Map();
let _lastCleanup = Date.now();

/**
 * Ekstrak IP klien dari request Vercel.
 * Vercel menyuntikkan header x-forwarded-for secara otomatis.
 * Ambil IP pertama (IP klien asli) dan validasi formatnya.
 */
function _getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for bisa berisi "client, proxy1, proxy2"
    const first = String(forwarded).split(',')[0].trim();
    // Validasi ringan: hanya izinkan karakter IPv4/IPv6 yang valid
    if (/^[\d.:\[\]a-fA-F]+$/.test(first) && first.length <= 45) {
      return first;
    }
  }
  // Fallback ke remoteAddress jika header tidak ada
  const remote = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  return remote || 'unknown';
}

/**
 * Bersihkan entry yang sudah kedaluwarsa dari map.
 * Dipanggil periodik untuk mencegah memory leak di instance long-lived.
 */
function _cleanupRateLimitMap() {
  const now = Date.now();
  if (now - _lastCleanup < RATE_LIMIT_CLEANUP_MS) return;
  _lastCleanup = now;
  for (const [ip, record] of _rateLimitMap.entries()) {
    if (now - record.windowStart >= RATE_LIMIT_WINDOW_MS) {
      _rateLimitMap.delete(ip);
    }
  }
}

/**
 * Cek dan catat request dari IP tertentu.
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
function _checkRateLimit(ip) {
  _cleanupRateLimitMap();

  const now = Date.now();
  const record = _rateLimitMap.get(ip);

  if (!record || now - record.windowStart >= RATE_LIMIT_WINDOW_MS) {
    // Window baru — reset counter
    _rateLimitMap.set(ip, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    // Melebihi batas
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.windowStart + RATE_LIMIT_WINDOW_MS,
    };
  }

  // Masih dalam batas — tambah counter
  record.count += 1;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX - record.count,
    resetAt: record.windowStart + RATE_LIMIT_WINDOW_MS,
  };
}

// ── Daftar origin yang diizinkan mengakses endpoint ini ──
// Tambahkan domain Vercel production Anda di sini.
const ALLOWED_ORIGINS = [
  'https://generatorsurat.vercel.app',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:3000',
];

// ── Validasi apakah origin diizinkan ──
// Menerima origin eksplisit dalam ALLOWED_ORIGINS ATAU
// subdomain Vercel preview (*.vercel.app) untuk deployment preview otomatis.
function isOriginAllowed(origin) {
  if (!origin) return true; // Request non-browser (server-to-server, curl) diizinkan
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Izinkan semua Vercel preview deployment (format: https://<project>-<hash>-<team>.vercel.app)
  try {
    const url = new URL(origin);
    if (url.protocol === 'https:' && url.hostname.endsWith('.vercel.app')) return true;
  } catch {
    // URL tidak valid
  }
  return false;
}

function byteLength(value) {
  return new TextEncoder().encode(String(value || '')).length;
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new Error('Payload JSON tidak valid.');
    }
  }

  throw new Error('Payload ekspor PDF tidak tersedia.');
}

function sanitizeFilename(filename) {
  const value = String(filename || 'Surat')
    .replace(/[\\/:*?"<>|\x00-\x1F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const base = value || 'Surat';
  return base.toLowerCase().endsWith('.pdf') ? base : base + '.pdf';
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

// ── Saran 4: Sanitasi HTML sebelum dirender Puppeteer ──
// Menghapus tag script, event handler inline, javascript: URI, iframe, dan
// elemen berbahaya lainnya. HTML yang masuk adalah output renderer klien,
// bukan input bebas pengguna — sanitasi ini adalah lapisan pertahanan berlapis.
function sanitizeHtml(html) {
  return html
    // Hapus seluruh blok <script>...</script>
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // Hapus tag <script ...> yang tidak ditutup
    .replace(/<script[^>]*>/gi, '')
    // Hapus iframe
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<iframe[^>]*>/gi, '')
    // Hapus event handler inline (onclick, onload, onerror, dll.)
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Hapus javascript: URI
    .replace(/javascript\s*:/gi, 'blocked:')
    // Hapus vbscript: URI
    .replace(/vbscript\s*:/gi, 'blocked:')
    // Hapus data: URI yang digunakan di href/action (bukan src gambar)
    .replace(/(<(?:a|form|button|input)[^>]+(?:href|action)\s*=\s*)["']data:[^"']*["']/gi, '$1"#"')
    // Hapus <meta http-equiv="refresh"> untuk mencegah redirect
    .replace(/<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, '');
}

function buildDocumentHtml(html, css, widthMm, heightMm) {
  const width = positiveNumber(widthMm, 210);
  const height = positiveNumber(heightMm, 297);

  // Sanitasi HTML sebelum dimasukkan ke dokumen Puppeteer (Saran 4)
  const safeHtml = sanitizeHtml(html);

  const parityCss =
    '<style>' +
    css +
    '\n' +
    'html,body{margin:0!important;padding:0!important;background:#fff!important;}' +
    'body{overflow:visible!important;}' +
    '#surat-preview{width:auto!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;background:transparent!important;box-shadow:none!important;}' +
    '#surat-preview.surat-preview--document{display:block!important;width:auto!important;min-height:0!important;gap:0!important;}' +
    '#surat-preview>.surat-page{' +
      'width:' + width + 'mm!important;' +
      'height:' + height + 'mm!important;' +
      'min-width:' + width + 'mm!important;' +
      'min-height:' + height + 'mm!important;' +
      'max-width:' + width + 'mm!important;' +
      'max-height:' + height + 'mm!important;' +
      'margin:0!important;box-shadow:none!important;overflow:visible!important;' +
      'break-after:page!important;page-break-after:always!important;break-inside:avoid!important;page-break-inside:avoid!important;' +
    '}' +
    '#surat-preview>.surat-page:last-child{break-after:auto!important;page-break-after:auto!important;}' +
    '@page{size:' + width + 'mm ' + height + 'mm;margin:0;}' +
    '</style>';

  return '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    parityCss +
    '</head><body>' + safeHtml + '</body></html>';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  // ── Validasi Origin request ──
  const requestOrigin = req.headers['origin'] || '';

  if (!isOriginAllowed(requestOrigin)) {
    console.warn('[api/export-pdf] Origin tidak diizinkan:', requestOrigin);
    return res.status(403).json({ error: 'Origin tidak diizinkan.' });
  }

  // Tambahkan CORS header agar browser tidak memblokir response
  if (requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Requested-With');
    res.setHeader('Vary', 'Origin');
  }

  // Tangani CORS preflight request (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }

  // ── Rate Limiting ──
  // Batasi request per IP untuk mencegah penyalahgunaan resource Puppeteer/Chromium.
  // Header rate limit ditambahkan agar klien bisa tahu sisa kuota.
  const clientIp = _getClientIp(req);
  const rateLimit = _checkRateLimit(clientIp);

  res.setHeader('X-RateLimit-Limit',     String(RATE_LIMIT_MAX));
  res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining));
  res.setHeader('X-RateLimit-Reset',     String(Math.ceil(rateLimit.resetAt / 1000)));

  if (!rateLimit.allowed) {
    const retryAfterSec = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    console.warn('[api/export-pdf] Rate limit terlampaui untuk IP:', clientIp);
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      error: `Terlalu banyak permintaan. Coba lagi dalam ${retryAfterSec} detik.`,
      retryAfter: retryAfterSec,
    });
  }

  // ── Validasi Content-Type ──
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    return res.status(415).json({ error: 'Content-Type harus application/json.' });
  }

  // ── Validasi Content-Length awal sebelum parsing body ──
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  const maxPayloadBytes = MAX_HTML_BYTES + MAX_CSS_BYTES + 4096; // toleransi 4KB untuk field lain
  if (contentLength > maxPayloadBytes) {
    return res.status(413).json({ error: 'Payload terlalu besar.' });
  }

  let payload;

  try {
    payload = parseBody(req);

    if (typeof payload.html !== 'string' || !payload.html.trim()) {
      throw new Error('HTML Preview Surat tidak tersedia.');
    }

    if (typeof payload.css !== 'string') {
      throw new Error('CSS Preview Surat tidak valid.');
    }

    if (byteLength(payload.html) > MAX_HTML_BYTES) {
      throw new Error('Ukuran HTML Preview terlalu besar.');
    }

    if (byteLength(payload.css) > MAX_CSS_BYTES) {
      throw new Error('Ukuran CSS Preview terlalu besar.');
    }

    const widthMm = positiveNumber(payload.widthMm, 210);
    const heightMm = positiveNumber(payload.heightMm, 297);

    if (widthMm > MAX_DIMENSION_MM || heightMm > MAX_DIMENSION_MM) {
      throw new Error('Dimensi kertas tidak didukung.');
    }

    const documentHtml = buildDocumentHtml(
      payload.html,
      payload.css,
      widthMm,
      heightMm
    );

    const browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--disable-extensions',
        '--disable-plugins',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
      ],
      executablePath: await chromium.executablePath(),
      headless: 'shell',
    });

    try {
      const page = await browser.newPage();

      // ── Saran 5: Blokir request jaringan eksternal dari halaman yang dirender ──
      // HTML dokumen surat berisi CSS inline (<style>) dan gambar data URI (logo base64).
      // Semua konten sudah disematkan — tidak ada alasan untuk keluar ke jaringan.
      // Yang diizinkan: dokumen utama (setContent), gambar data URI, stylesheet inline.
      // Yang diblokir: script, xhr, fetch, websocket, dan resource HTTP/HTTPS eksternal.
      await page.setRequestInterception(true);
      page.on('request', (interceptedReq) => {
        const resourceType = interceptedReq.resourceType();
        const url = interceptedReq.url();

        // Izinkan dokumen utama (dipanggil oleh setContent via about:blank)
        if (resourceType === 'document') {
          interceptedReq.continue();
          return;
        }

        // Izinkan gambar dengan data URI (logo KOP dalam format base64)
        if (url.startsWith('data:image/')) {
          interceptedReq.continue();
          return;
        }

        // Izinkan stylesheet data URI (jika ada CSS yang diembed sebagai data URI)
        if (url.startsWith('data:text/css')) {
          interceptedReq.continue();
          return;
        }

        // Blokir semua request ke jaringan eksternal (HTTP/HTTPS ke domain luar)
        // Script, XHR, fetch, WebSocket, dll. tidak boleh keluar dari sandbox render.
        console.warn('[api/export-pdf] Request jaringan diblokir:', resourceType, url.slice(0, 120));
        interceptedReq.abort('blockedbyclient');
      });

      await page.setViewport({
        width: Math.max(1280, Math.round(widthMm * 96 / 25.4)),
        height: Math.max(900, Math.round(heightMm * 96 / 25.4)),
        deviceScaleFactor: 1,
      });

      await page.setContent(documentHtml, {
        // Gunakan 'domcontentloaded' karena request interception aktif —
        // 'networkidle0' bisa hang jika ada request yang diblokir (abort tidak
        // dihitung sebagai "settled" di beberapa versi Puppeteer).
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready;

        const images = Array.from(document.images);
        await Promise.all(images.map(image => {
          if (image.complete) {
            return image.decode?.().catch(() => undefined) || Promise.resolve();
          }

          return new Promise(resolve => {
            const done = () => resolve();
            image.addEventListener('load', done, { once: true });
            image.addEventListener('error', done, { once: true });
          });
        }));
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const pdfBuffer = await page.pdf({
        width: widthMm + 'mm',
        height: heightMm + 'mm',
        margin: {
          top: '0mm',
          right: '0mm',
          bottom: '0mm',
          left: '0mm',
        },
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        pageRanges: '1-',
        scale: 1,
      });

      const filename = sanitizeFilename(payload.filename);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="' + filename.replace(/"/g, '') + '"'
      );
      res.setHeader('Content-Length', String(pdfBuffer.length));
      return res.end(pdfBuffer);
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error('[api/export-pdf] Export failed:', error);
    return res.status(500).json({
      error: error?.message || 'Gagal membuat PDF.',
    });
  }
}
