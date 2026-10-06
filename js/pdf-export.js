/* =============================================================
   pdf-export.js — Ekspor surat langsung menjadi PDF
   =============================================================
   Mengambil halaman yang SUDAH dirender oleh PreviewRenderer sebagai
   sumber kebenaran tunggal. Setiap .surat-page ditangkap langsung oleh
   html2canvas melalui API html2pdf, lalu digabungkan ke satu PDF.
   Tidak membuat clone/staging DOM sehingga layout PDF mengikuti Preview.
============================================================= */

const PdfExport = (() => {

  const BUTTON_ID = 'btn-export-pdf';
  const RENDER_SCALE = 2;

  let _exporting = false;

  function _getLibrary() {
    const html2pdfCtor = window.html2pdf;

    if (typeof html2pdfCtor !== 'function') {
      return null;
    }

    return { html2pdf: html2pdfCtor };
  }

  async function _waitForLibrary(timeoutMs = 8000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const library = _getLibrary();
      if (library) return library;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return null;
  }

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

  function _getPageElements() {
    const preview = document.getElementById('surat-preview');
    if (!preview) return [];

    const pages = Array.from(preview.querySelectorAll(':scope > .surat-page'));
    if (pages.length) return pages;

    // Fallback satu halaman lama/non-multi-page.
    return [preview];
  }

  function _waitForNextPaint() {
    return new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  async function _waitForImages(root) {
    const images = Array.from(root.querySelectorAll('img'));
    if (!images.length) return;

    await Promise.all(images.map(img => {
      if (img.complete) {
        return img.decode?.().catch(() => undefined) || Promise.resolve();
      }

      return new Promise(resolve => {
        const finish = () => resolve();
        img.addEventListener('load', finish, { once: true });
        img.addEventListener('error', finish, { once: true });
      });
    }));
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

  function _buildPdfOptions(pageWidthMm, pageHeightMm, pageWidthPx, pageHeightPx) {
    return {
      margin: 0,
      image: {
        type: 'jpeg',
        quality: 0.96,
      },
      html2canvas: {
        scale: RENDER_SCALE,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        imageTimeout: 15000,
        logging: false,
        removeContainer: true,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        width: pageWidthPx,
        height: pageHeightPx,
        windowWidth: Math.max(pageWidthPx, document.documentElement.clientWidth || 1),
        windowHeight: Math.max(pageHeightPx, document.documentElement.clientHeight || 1),
      },
      jsPDF: {
        unit: 'mm',
        format: [pageWidthMm, pageHeightMm],
        orientation: pageWidthMm >= pageHeightMm ? 'landscape' : 'portrait',
        compress: true,
      },
    };
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

    const library = await _waitForLibrary();
    if (!library) {
      UI.toast(
        'Mesin ekspor PDF belum tersedia. Muat ulang aplikasi dan coba lagi.',
        'error',
        5500
      );
      return false;
    }

    if (typeof PreviewRenderer !== 'undefined'
        && typeof PreviewRenderer.waitForReady === 'function') {
      await PreviewRenderer.waitForReady();
    }

    const pages = _getPageElements();
    if (!pages.length || pages.every(page => !page || !page.children.length)) {
      UI.toast('Preview surat belum siap untuk diekspor.', 'warning');
      return false;
    }

    _exporting = true;
    _setExportState(true);

    const dimensions = State.getPaperDimensions();
    const pageWidthMm = Number(dimensions.widthMm);
    const pageHeightMm = Number(dimensions.heightMm);

    if (!(pageWidthMm > 0) || !(pageHeightMm > 0)) {
      _setExportState(false);
      _exporting = false;
      UI.toast('Dimensi kertas dokumen tidak valid.', 'error');
      return false;
    }

    const pageWidthPx = pageWidthMm * 96 / 25.4;
    const pageHeightPx = pageHeightMm * 96 / 25.4;

    const wrapper = document.getElementById('preview-canvas-wrapper');
    const previousWrapperTransform = wrapper?.style.transform || '';
    const previousWrapperTransition = wrapper?.style.transition || '';
    const pageStyleSnapshots = pages.map(page => ({
      boxShadow: page.style.boxShadow,
      transition: page.style.transition,
    }));

    try {
      /*
       * Preview zoom hanya mempengaruhi tampilan. Untuk proses capture,
       * lepaskan transform pada wrapper agar html2canvas menerima ukuran
       * halaman fisik 1:1 yang sama dengan PreviewRenderer.
       */
      if (wrapper) {
        wrapper.style.transition = 'none';
        wrapper.style.transform = 'none';
      }

      // Hilangkan bayangan visual kertas selama capture; bayangan Preview
      // adalah elemen UI dan bukan bagian dari dokumen yang dicetak.
      pages.forEach(page => {
        page.style.boxShadow = 'none';
        page.style.transition = 'none';
      });

      await _waitForImages(document.getElementById('surat-preview') || document);
      if (document.fonts?.ready) await document.fonts.ready;
      await _waitForNextPaint();

      /*
       * Tangkap halaman Preview secara langsung, tanpa clone atau staging.
       * Ini memastikan CSS descendant, inherited style, table wrapping,
       * KOP, tanda tangan, dan nomor halaman identik dengan Preview.
       */
      let pdf = null;

      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index];
        if (!page) continue;

        const rect = page.getBoundingClientRect();
        const actualWidthPx = page.offsetWidth || Math.round(rect.width);
        const actualHeightPx = page.offsetHeight || Math.round(rect.height);

        const options = _buildPdfOptions(
          pageWidthMm,
          pageHeightMm,
          actualWidthPx || pageWidthPx,
          actualHeightPx || pageHeightPx
        );

        const worker = library.html2pdf()
          .set(options)
          .from(page)
          .toCanvas();

        if (!pdf) {
          pdf = await worker.toPdf().get('pdf');
        } else {
          const canvas = await worker.get('canvas');
          pdf.addPage([pageWidthMm, pageHeightMm]);
          pdf.addImage(
            canvas.toDataURL('image/jpeg', 0.96),
            'JPEG',
            0,
            0,
            pageWidthMm,
            pageHeightMm,
            undefined,
            'FAST'
          );
        }
      }

      if (!pdf) {
        throw new Error('Tidak ada halaman PDF yang dapat dibuat.');
      }

      pdf.save(_getFilename(templateId));
      UI.toast('PDF berhasil dibuat: ' + pages.length + ' halaman.', 'success', 4500);
      return true;
    } catch (error) {
      console.error('[PdfExport] Gagal membuat PDF:', error);
      UI.toast(
        'Ekspor PDF gagal. Periksa kembali preview surat lalu coba lagi.',
        'error',
        5000
      );
      return false;
    } finally {
      pages.forEach((page, index) => {
        const snapshot = pageStyleSnapshots[index];
        page.style.boxShadow = snapshot?.boxShadow || '';
        page.style.transition = snapshot?.transition || '';
      });

      if (wrapper) {
        wrapper.style.transition = previousWrapperTransition;
        wrapper.style.transform = previousWrapperTransform;
      }

      _setExportState(false);
      _exporting = false;
    }
  }

  return {
    exportDocument,
  };

})();
