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
    const templateIds = [
      'dpu',
      'mutasi-masuk',
      'siswa-baru',
      'ijop-permohonan',
      'ijop-sptjm-satpen',
      'ijop-rekomendasi-pengawas',
      'ijop-rekomendasi-kankemenag',
      'ijop-sptjm-kankemenag',
    ];

    for (const templateId of templateIds) {
      expect(renderer.usesMultiPageLayout(templateId), templateId).toBe(true);
    }
  });

  it('does not treat unknown template identifiers as paginated templates', () => {
    const renderer = loadPreviewRenderer();

    expect(renderer.usesMultiPageLayout('not-a-template')).toBe(false);
    expect(renderer.usesMultiPageLayout(null)).toBe(false);
  });
});
