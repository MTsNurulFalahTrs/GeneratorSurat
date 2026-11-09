import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const templateFiles = [
  ['dpu', 'templates/dpu.js'],
  ['mutasi-masuk', 'templates/mutasi-masuk.js'],
  ['siswa-baru', 'templates/siswa-baru.js'],
  ['ijop-permohonan', 'templates/ijop-permohonan.js'],
  ['ijop-sptjm-satpen', 'templates/ijop-sptjm-satpen.js'],
  ['ijop-rekomendasi-pengawas', 'templates/ijop-rekomendasi-pengawas.js'],
  ['ijop-rekomendasi-kankemenag', 'templates/ijop-rekomendasi-kankemenag.js'],
  ['ijop-sptjm-kankemenag', 'templates/ijop-sptjm-kankemenag.js'],
];

function loadTemplateRegistry() {
  const context = { console: { info: vi.fn(), warn: vi.fn() } };
  runInNewContext(read('js/utils.js'), context, { filename: 'js/utils.js' });
  for (const [, path] of templateFiles) {
    runInNewContext(read(path), context, { filename: path });
  }
  runInNewContext(
    read('js/template-registry.js') + '\nglobalThis.__registry = TemplateRegistry; TemplateRegistry.init();',
    context,
    { filename: 'js/template-registry.js' },
  );
  return context.__registry;
}

describe('Application shell integration', () => {
  it('loads core scripts in dependency order, with the app bootstrap last', () => {
    const html = read('index.html');
    const scripts = html.split('<script').slice(1).map(tag => {
      const marker = 'src="';
      const offset = tag.indexOf(marker);
      if (offset < 0) return null;
      return tag.slice(offset + marker.length).split('"')[0];
    }).filter(Boolean);
    const position = path => scripts.indexOf(path);

    expect(position('js/utils.js')).toBeGreaterThanOrEqual(0);
    expect(position('js/utils.js')).toBeLessThan(position('js/storage.js'));
    expect(position('js/storage.js')).toBeLessThan(position('js/state.js'));
    expect(position('templates/dpu.js')).toBeLessThan(position('js/template-registry.js'));
    expect(position('templates/ijop-sptjm-kankemenag.js')).toBeLessThan(position('js/template-registry.js'));
    expect(position('js/preview-renderer.js')).toBeLessThan(position('js/print.js'));
    expect(position('js/pdf-export.js')).toBeLessThan(position('js/app.js'));
    expect(position('js/platform.js')).toBeLessThan(position('js/app.js'));
    expect(position('js/app.js')).toBe(scripts.length - 1);
  });

  it('loads and registers all eight templates with unique stable identifiers', () => {
    const registry = loadTemplateRegistry();
    const templates = registry.getAll();
    const ids = templates.map(template => template.TEMPLATE_ID);

    expect(registry.count()).toBe(8);
    expect(new Set(ids).size).toBe(8);
    expect(ids).toEqual(templateFiles.map(([id]) => id));
    expect(registry.get('not-a-template')).toBeNull();
  });

  it('provides required metadata and form contracts for every registered template', () => {
    const registry = loadTemplateRegistry();
    for (const template of registry.getAll()) {
      expect(template.meta?.name, template.TEMPLATE_ID).toBeTruthy();
      expect(['portrait', 'landscape']).toContain(template.meta?.orientation);
      expect(typeof template.createDefaultData, template.TEMPLATE_ID).toBe('function');
      expect(Array.isArray(template.formSections), template.TEMPLATE_ID).toBe(true);
      expect(Array.isArray(template.tableColumns), template.TEMPLATE_ID).toBe(true);
    }
  });

  it('keeps install and update controls hidden until browser support is available', () => {
    const html = read('index.html');
    expect(html).toMatch(/id="btn-install-app"[^>]*hidden/);
    expect(html).toMatch(/id="btn-update-app"[^>]*hidden/);
    expect(read('js/platform.js')).toContain("window.addEventListener('beforeinstallprompt'");
    expect(read('js/platform.js')).toContain("window.addEventListener('appinstalled'");
  });
});
