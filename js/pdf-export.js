/* =============================================================
   pdf-export.js — Ekspor PDF native via Chromium server-side
   ============================================================= */

const PdfExport = (() => {

  const BUTTON_ID = 'btn-export-pdf';
  const ENDPOINT = '/api/export-pdf';
  let _exporting = false;

  function _getFilename(templateId) {
    const template = typeof TemplateRegistry !== 'undefined'
      ? TemplateRegistry.get(templateId)
      : null;
    const label = template?.meta?.name || templateId || 'Surat';

    const safeLabel = String(label)
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\\s+/g, ' ')
      .trim();

    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');

    return 'Surat - ' + (safeLabel || 'Dokumen') + ' - ' + date + '.pdf';
  }

  async function _collectStylesheets() {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'));

    const styles = await Promise.all(links.map(async link => {
      const url = new URL(link.href, window.location.href);

      if (url.origin !== window.location.origin) return '';

      try {
        const response = await fetch(url.href, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
        });

        if (!response.ok) return '';
        return await response.text();
      } catch (error) {
        console.warn('[PdfExport] Gagal membaca stylesheet:', url.href, error);
        return '';
      }
    }));

    const inlineStyles = Array.from(document.querySelectorAll('style'))
      .map(style => style.textContent || '');

    return [...styles, ...inlineStyles]
      .filter(Boolean)
      .join('\n\n');
  }

  async function _buildPayload() {
    const preview = document.getElementById('surat-preview');
    if (!preview) throw new Error('Elemen Preview Surat tidak ditemukan.');

    const pages = preview.querySelectorAll(':scope > .surat-page');
    if (!pages.length && !preview.children.length) {
      throw new Error('Preview Surat belum siap.');
    }

    const dimensions = State.getPaperDimensions();
    const widthMm = Number(dimensions.widthMm);
    const heightMm = Number(dimensions.heightMm);

    if (!(widthMm > 0) || !(heightMm > 0)) {
      throw new Error('Dimensi kertas dokumen tidak valid.');
    }

    return {
      html: preview.outerHTML,
      css: await _collectStylesheets(),
      widthMm,
      heightMm,
      filename: _getFilename(State.getActiveTemplate()),
    };
  }

  function _setExportState(isExporting) {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;

    button.disabled = isExporting;
    button.setAttribute('aria-busy', String(isExporting));
    button.dataset.exporting = isExporting ? 'true' : 'false';

    const label = button.querySelector('.btn-label');
    if (label) label.textContent = isExporting ? 'Membuat PDF…' : 'Ekspor PDF';
  }

  async function exportDocument() {
    if (_exporting) return false;

    if (typeof Utils.flushDebounces === 'function') {
      Utils.flushDebounces();
    }

    const templateId = State.getActiveTemplate();
    if (!templateId) {
      UI.toast('Pilih template surat terlebih dahulu.', 'warning');
      return false;
    }

    if (typeof PreviewRenderer !== 'undefined'
        && typeof PreviewRenderer.waitForReady === 'function') {
      await PreviewRenderer.waitForReady();
    }

    _exporting = true;
    _setExportState(true);

    try {
      if (document.fonts?.ready) await document.fonts.ready;

      const preview = document.getElementById('surat-preview');
      if (preview) {
        const images = Array.from(preview.querySelectorAll('img'));
        await Promise.all(images.map(img => {
          if (img.complete) {
            return img.decode?.().catch(() => undefined) || Promise.resolve();
          }
          return new Promise(resolve => {
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          });
        }));
      }

      await new Promise(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });

      const payload = await _buildPayload();

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/pdf, application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let message = '';
        try {
          const data = await response.json();
          message = data?.error || '';
        } catch {
          // Response non-JSON; gunakan pesan standar.
        }

        throw new Error(message || 'Server PDF merespons HTTP ' + response.status + '.');
      }

      const blob = await response.blob();
      if (!blob.size) throw new Error('Server PDF mengembalikan file kosong.');

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = payload.filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);

      UI.toast('PDF berhasil dibuat: ' + (
        document.querySelectorAll('#surat-preview > .surat-page').length || 1
      ) + ' halaman.', 'success', 4500);

      return true;
    } catch (error) {
      console.error('[PdfExport] Gagal membuat PDF:', error);
      UI.toast(
        'Ekspor PDF gagal. Periksa kembali preview surat lalu coba lagi.',
        'error',
        5500
      );
      return false;
    } finally {
      _setExportState(false);
      _exporting = false;
    }
  }

  return {
    exportDocument,
  };

})();
