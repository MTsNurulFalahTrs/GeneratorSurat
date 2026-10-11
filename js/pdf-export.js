/* =============================================================
   pdf-export.js — Ekspor PDF native via Chromium server-side
   ============================================================= */

/* global TemplateRegistry, State */

// @ts-ignore
const PdfExport = (() => {

  const BUTTON_ID = 'btn-export-pdf';
  const ENDPOINT = '/api/export-pdf';
  let _exporting = false;

  function _getFilename(templateId) {
    // @ts-ignore
    const template = typeof TemplateRegistry !== 'undefined'
      // @ts-ignore
      ? TemplateRegistry.get(templateId)
      : null;
    const label = template?.meta?.name || templateId || 'Surat';

    const safeLabel = String(label)
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')   // fix: was /\\s+/ (double-escaped, tidak cocok spasi)
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
    const links = /** @type {HTMLLinkElement[]} */ (Array.from(document.querySelectorAll('link[rel="stylesheet"][href]')));

    const styles = await Promise.all(links.map(async link => {
      let url;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return '';
      }

      // Lewati stylesheet dari origin lain (CDN, dll.)
      if (url.origin !== window.location.origin) return '';

      // Lewati jika bukan HTTP/HTTPS (mis. file://, data:, dll.)
      // fetch() tidak bisa membaca file:// di browser modern
      if (!['http:', 'https:'].includes(url.protocol)) return '';

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

    // Cek ada konten — surat-page atau setidaknya child element
    if (!preview.querySelector(':scope > .surat-page') && !preview.children.length) {
      throw new Error('Preview Surat belum siap.');
    }

    // @ts-ignore
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
      // @ts-ignore
      filename: _getFilename(State.getActiveTemplate()),
    };
  }

  function _setExportState(isExporting) {
    const button = /** @type {HTMLButtonElement|null} */ (document.getElementById(BUTTON_ID));
    if (!button) return;

    button.disabled = isExporting;
    button.setAttribute('aria-busy', String(isExporting));
    button.dataset.exporting = isExporting ? 'true' : 'false';

    const label = button.querySelector('.btn-label');
    if (label) label.textContent = isExporting ? 'Membuat PDF…' : 'Ekspor PDF';
  }

  async function exportDocument() {
    if (_exporting) return false;

    // @ts-ignore
    if (typeof Utils.flushDebounces === 'function') {
      // @ts-ignore
      Utils.flushDebounces();
    }

    // @ts-ignore
    const templateId = State.getActiveTemplate();
    if (!templateId) {
      // @ts-ignore
      UI.toast('Pilih template surat terlebih dahulu.', 'warning');
      return false;
    }

    // @ts-ignore
    if (typeof PreviewRenderer !== 'undefined'
        // @ts-ignore
        && typeof PreviewRenderer.waitForReady === 'function') {
      // @ts-ignore
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
          'X-Requested-With': 'XMLHttpRequest',
        },
        // Pastikan cookie/credentials tidak ikut terkirim ke endpoint PDF
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let message = '';
        let retryAfter = 0;
        try {
          const data = await response.json();
          message = data?.error || '';
          retryAfter = data?.retryAfter || 0;
        } catch {
          // Response non-JSON; gunakan pesan standar.
        }

        if (response.status === 429) {
          const waitText = retryAfter > 0 ? ` Tunggu ${retryAfter} detik.` : '';
          throw new Error('rate-limit:' + (message || `Terlalu banyak permintaan.${waitText}`));
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

      // @ts-ignore
      UI.toast('PDF berhasil dibuat: ' + (
        document.querySelectorAll('#surat-preview > .surat-page').length || 1
      ) + ' halaman.', 'success', 4500);

      return true;
    } catch (error) {
      console.error('[PdfExport] Gagal membuat PDF:', error);

      // Tampilkan pesan error yang lebih spesifik jika tersedia
      const msg = error?.message || '';
      let userMessage = 'Ekspor PDF gagal. Periksa kembali preview surat lalu coba lagi.';

      if (msg.startsWith('rate-limit:')) {
        userMessage = msg.slice('rate-limit:'.length).trim() ||
          'Terlalu banyak permintaan ekspor PDF. Tunggu sebentar lalu coba lagi.';
      } else if (msg.includes('403') || msg.includes('Origin')) {
        userMessage = 'Ekspor PDF ditolak server. Pastikan aplikasi diakses dari domain yang terdaftar.';
      } else if (msg.includes('413') || msg.includes('besar')) {
        userMessage = 'Data dokumen terlalu besar untuk diekspor. Coba kurangi jumlah data atau ukuran logo.';
      } else if (msg.includes('415')) {
        userMessage = 'Format permintaan tidak valid. Coba refresh halaman lalu ekspor ulang.';
      } else if (msg.includes('HTTP 5') || msg.includes('500')) {
        userMessage = 'Server PDF mengalami kesalahan internal. Coba beberapa saat lagi.';
      } else if (msg.includes('belum siap') || msg.includes('tidak ditemukan')) {
        userMessage = msg;
      } else if (msg.includes('dimensi') || msg.includes('tidak valid')) {
        userMessage = msg;
      }

      // @ts-ignore
      UI.toast(userMessage, 'error', 6000);
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
