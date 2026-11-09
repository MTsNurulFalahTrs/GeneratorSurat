import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../js/preview-renderer.js', import.meta.url), 'utf8');

function loadPreviewRenderer() {
  const context = { document: {} };
  runInNewContext(
    `${source}\n;globalThis.PreviewRenderer = PreviewRenderer;`,
    context,
  );
  return context.PreviewRenderer;
}

describe('PreviewRenderer pagination policy', () => {
  it('paginates every registered letter template with fixed paper dimensions', () => {
    const renderer = loadPreviewRenderer();
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    // Ambil semua template yang benar-benar dimuat aplikasi, bukan daftar
    // manual yang berisiko ketinggalan saat menambahkan template baru.
    const templateIds = [...html.matchAll(/<script\b[^>]*src=["']templates\/([^"']+)\.js["']/g)]
      .map(match => match[1]);

    expect(templateIds).toHaveLength(10);
    expect(templateIds).toContain('rekap-nilai');
    expect(templateIds).toContain('surat-izin');
    for (const templateId of templateIds) {
      expect(renderer.usesMultiPageLayout(templateId), templateId).toBe(true);
    }
  });

  it('keeps Surat Izin routed through its document renderer and the paginated preview pipeline', () => {
    const renderer = loadPreviewRenderer();
    const sourceOfSuratIzin = readFileSync(new URL('../templates/surat-izin.js', import.meta.url), 'utf8');

    expect(renderer.usesMultiPageLayout('surat-izin')).toBe(true);
    expect(source).toContain("if (id === 'surat-izin')");
    expect(source).toContain('return _renderSuratIzin(formData, kop, margin, typo)');
    expect(source).toContain('doc-content doc-content--surat-izin');
    expect(source).toContain('await _waitForLayoutAssets(source)');
    expect(source).toContain('_schedulePagination(renderToken, paperWidthPx, paperHeightPx)');
    expect(sourceOfSuratIzin).toContain("const TEMPLATE_ID = 'surat-izin'");
  });

  it('does not treat unknown template identifiers as paginated templates', () => {
    const renderer = loadPreviewRenderer();

    expect(renderer.usesMultiPageLayout('not-a-template')).toBe(false);
    expect(renderer.usesMultiPageLayout(null)).toBe(false);
  });
});
