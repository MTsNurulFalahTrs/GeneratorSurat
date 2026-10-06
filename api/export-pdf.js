import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_CSS_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION_MM = 1000;

function byteLength(value) {
  return Buffer.byteLength(String(value || ''), 'utf8');
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

function buildDocumentHtml(html, css, widthMm, heightMm) {
  const width = positiveNumber(widthMm, 210);
  const height = positiveNumber(heightMm, 297);

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
    '</head><body>' + html + '</body></html>';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }

  let payload;

  try {
    payload = parseBody(req);

    if (typeof payload.html !== 'string' || !payload.html.trim()) {
      throw new Error('HTML Preview Surat tidak tersedia.');
    }

    if (typeof payload.css !== 'string') {
      throw new Error('CSS Preview Surat tidak tersedia.');
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
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: 'shell',
    });

    try {
      const page = await browser.newPage();

      await page.setViewport({
        width: Math.max(1280, Math.round(widthMm * 96 / 25.4)),
        height: Math.max(900, Math.round(heightMm * 96 / 25.4)),
        deviceScaleFactor: 1,
      });

      await page.setContent(documentHtml, {
        waitUntil: 'networkidle0',
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

      await new Promise(resolve => setTimeout(resolve, 50));

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
