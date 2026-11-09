import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const root = new URL('../', import.meta.url);

describe('PWA deployment contract', () => {
  it('references existing local files from HTML script and link tags', () => {
    const html = read('index.html');
    const refs = html.split('<').filter(tag => tag.startsWith('script ') || tag.startsWith('link ')).map(tag => {
      const marker = tag.startsWith('script ') ? 'src="' : 'href="';
      const offset = tag.indexOf(marker);
      if (offset < 0) return null;
      return tag.slice(offset + marker.length).split('"')[0];
    }).filter(value => value && !/^https?:/i.test(value));
    expect(refs.length).toBeGreaterThan(20);
    for (const path of refs) expect(existsSync(resolve(root.pathname, path)), path).toBe(true);
  });

  it('declares stable standalone identity and valid same-origin SVG icons', () => {
    const manifest = JSON.parse(read('manifest.webmanifest'));
    expect(manifest.id).toBe('./');
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('assets/icons/')).toBe(true);
      expect(icon.sizes).toBeTruthy();
      expect(existsSync(resolve(root.pathname, icon.src))).toBe(true);
    }
  });

  it('sets revalidation cache headers for worker, manifest and assets', () => {
    const config = JSON.parse(read('vercel.json'));
    const valueFor = source => config.headers.find(rule => rule.source === source)
      ?.headers.find(header => header.key.toLowerCase() === 'cache-control')?.value;
    expect(valueFor('/sw.js')).toContain('no-store');
    expect(valueFor('/manifest.webmanifest')).toContain('max-age=0');
    expect(valueFor('/assets/(.*)')).toContain('must-revalidate');
  });

  it('keeps service workers and manifest resources enabled by the CSP', () => {
    const config = JSON.parse(read('vercel.json'));
    const csp = config.headers.find(rule => rule.source === '/(.*)')
      ?.headers.find(header => header.key === 'Content-Security-Policy')?.value;
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain("manifest-src 'self'");
  });

  it('includes all manifest icons in the worker app shell', () => {
    const manifest = JSON.parse(read('manifest.webmanifest'));
    const sw = read('sw.js');
    const start = sw.indexOf('const APP_SHELL = [');
    const end = sw.indexOf('];', start);
    const shell = sw.slice(start, end);
    for (const icon of manifest.icons) expect(shell).toContain(icon.src);
  });
});
