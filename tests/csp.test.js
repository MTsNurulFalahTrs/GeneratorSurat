import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('CSP compatibility guards', () => {
  it('does not contain inline script blocks or inline event attributes in the HTML shell', () => {
    const html = read('index.html');
    const scriptTags = [...html.matchAll(/<script\\b([^>]*)>/gi)];
    const inlineScripts = scriptTags.filter(([, attributes]) => !/\\bsrc\\s*=/i.test(attributes));

    expect(inlineScripts).toHaveLength(0);
    expect(html).not.toMatch(/\\bon[a-z]+\\s*=/i);
  });

  it('does not generate inline click handlers in application empty/error states', () => {
    expect(read('js/app.js')).not.toMatch(/\\bonclick\\s*=/i);
    expect(read('js/form-renderer.js')).not.toMatch(/\\bonclick\\s*=/i);
  });

  it('loads the early theme bootstrap as a same-origin external script', () => {
    const html = read('index.html');
    expect(html).toContain('<script src="js/theme-init.js"></script>');
    expect(read('js/theme-init.js')).toContain("localStorage.getItem('ui-theme')");
  });

  it('keeps DataManager and DocumentViewer in separate global declarations', () => {
    expect(read('js/data-manager.js')).toContain('const DataManager =');
    expect(read('js/data-manager.js')).not.toContain('const DocumentViewer =');
    expect(read('js/document-viewer.js')).toContain('const DocumentViewer =');
  });
});
