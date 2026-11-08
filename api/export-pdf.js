import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import {
  HttpError,
  checkUpstashRateLimit,
  createMemoryRateLimiter,
  getClientIp,
  isOriginAllowed,
  isUpstashConfigured,
  parseJsonBody,
  sanitizePdfFilename,
  validateContentLength,
  validatePdfPayload,
} from './export-pdf-security.js';

const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_CSS_BYTES = 2 * 1024 * 1024;
const MAX_PAYLOAD_BYTES = MAX_HTML_BYTES + MAX_CSS_BYTES + 4096;
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_CONCURRENT_RENDERS = 2;
const memoryRateLimiter = createMemoryRateLimiter({
  limit: RATE_LIMIT_MAX,
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxEntries: 10_000,
});
let activeRenders = 0;

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

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
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob:; style-src \'unsafe-inline\' data:; font-src data:; script-src \'none\'; connect-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    parityCss +
    '</head><body>' + safeHtml + '</body></html>';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const requestOrigin = req.headers.origin || '';
  if (!isOriginAllowed(requestOrigin)) {
    return res.status(403).json({ error: 'Origin tidak diizinkan.' });
  }

  const fetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  if (fetchSite === 'cross-site') {
    return res.status(403).json({ error: 'Permintaan lintas situs tidak diizinkan.' });
  }

  res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Requested-With');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }

  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    return res.status(415).json({ error: 'Content-Type harus application/json.' });
  }

  try {
    validateContentLength(req.headers['content-length'], MAX_PAYLOAD_BYTES);
  } catch (error) {
    const status = error instanceof HttpError ? error.statusCode : 400;
    return res.status(status).json({ error: error.message });
  }

  const clientIp = getClientIp(
    req.headers,
    req.socket?.remoteAddress || req.connection?.remoteAddress || ''
  );

  let rateLimit;
  try {
    // When Upstash is configured, Redis is authoritative. Never silently fall
    // back to per-instance memory if the distributed limiter is unavailable.
    rateLimit = await checkUpstashRateLimit(clientIp, {
      limit: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
    if (!rateLimit) rateLimit = memoryRateLimiter.check(clientIp);
  } catch (error) {
    console.error('[api/export-pdf] Rate limit backend unavailable:', error?.name || 'Error');
    return res.status(503).json({
      error: 'Layanan pembatasan permintaan sedang tidak tersedia. Silakan coba kembali.',
    });
  }

  res.setHeader('X-RateLimit-Limit', String(rateLimit.limit));
  res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(rateLimit.resetAt / 1000)));

  if (!rateLimit.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000));
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      error: 'Terlalu banyak permintaan. Silakan coba kembali setelah jeda.',
      retryAfter: retryAfterSec,
    });
  }

  let renderSlotAcquired = false;
  let browser = null;

  try {
    const payload = parseJsonBody(req);
    const document = validatePdfPayload(payload, {
      maxHtmlBytes: MAX_HTML_BYTES,
      maxCssBytes: MAX_CSS_BYTES,
    });
    const documentHtml = buildDocumentHtml(
      document.html,
      document.css,
      document.widthMm,
      document.heightMm
    );

    if (activeRenders >= MAX_CONCURRENT_RENDERS) {
      res.setHeader('Retry-After', '3');
      return res.status(503).json({
        error: 'Antrean ekspor PDF sedang penuh. Silakan coba kembali.',
      });
    }

    activeRenders += 1;
    renderSlotAcquired = true;

    browser = await puppeteer.launch({
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

    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);

    // The renderer only needs embedded content. No external network access,
    // scripts, fetches, frames, or navigation are required to create a PDF.
    await page.setRequestInterception(true);
    page.on('request', interceptedReq => {
      const url = interceptedReq.url();
      const resourceType = interceptedReq.resourceType();

      if (resourceType === 'document' && (url === 'about:blank' || url.startsWith('about:blank#'))) {
        interceptedReq.continue();
        return;
      }
      if (url.startsWith('data:image/') || url.startsWith('data:text/css')) {
        interceptedReq.continue();
        return;
      }

      interceptedReq.abort('blockedbyclient').catch(() => {});
    });

    await page.setViewport({
      width: Math.max(1280, Math.round(document.widthMm * 96 / 25.4)),
      height: Math.max(900, Math.round(document.heightMm * 96 / 25.4)),
      deviceScaleFactor: 1,
    });

    await page.setContent(documentHtml, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
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

    const pdfBuffer = await page.pdf({
      width: document.widthMm + 'mm',
      height: document.heightMm + 'mm',
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      pageRanges: '1-',
      scale: 1,
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="' + sanitizePdfFilename(document.filename).replace(/"/g, '') + '"'
    );
    res.setHeader('Content-Length', String(pdfBuffer.length));
    return res.end(pdfBuffer);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    // Avoid returning internal Chromium/runtime details to callers.
    console.error('[api/export-pdf] Export failed:', error?.name || 'Error');
    return res.status(500).json({
      error: 'Gagal membuat PDF. Silakan coba kembali.',
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Cleanup must not replace the original export result.
      }
    }
    if (renderSlotAcquired) activeRenders = Math.max(0, activeRenders - 1);
  }
}
