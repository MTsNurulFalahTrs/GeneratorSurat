/* =============================================================
   pdf-export.js — Ekspor surat langsung menjadi PDF
   =============================================================
   Mengambil halaman yang sudah dipaginasi oleh PreviewRenderer lalu
   merasterisasi setiap halaman ke PDF di browser. Tidak membuka dialog Print.
*/

const PdfExport = (() => {

  const STAGE_ID = 'pdf-export-stage';
  const BUTTON_ID = 'btn-export-pdf';
  const RENDER_SCALE = 2;

  let _exporting = false;

  function _getLibrary() {
    const html2canvasReady = typeof html2canvas === 'function';
    const jsPdfCtor = window.jspdf?.jsPDF;

    if (!html2canvasReady || typeof jsPdfCtor !== 'function') {
      return null;
    }

    return { html2canvas, jsPDF: jsPdfCtor };
  }

  function _getFilename(templateId) {
    const template = typeof TemplateRegistry !== 'undefined'
      ? TemplateRegistry.get(templateId)
      : null;
    const label = template?.meta?.name || templateId || 'Surat';
    const safeLabel = String(label)
      .replace(/[\\\\/:*?"<>|]+/g, ' ')
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

    // Fallback untuk dokumen satu halaman lama/non-multi-page.
    return [preview];
  }

  function _createStage(pageElements) {
    const oldStage = document.getElementById(STAGE_ID);
    oldStage?.remove();

    const stage = document.createElement('div');
    stage.id = STAGE_ID;
    stage.setAttribute('aria-hidden', 'true');
    Object.assign(stage.style, {
      position: 'fixed',
      left: '-100000px',
      top: '0',
      width: '1px',
      minHeight: '1px',
      overflow: 'visible',
      opacity: '0.01',
      pointerEvents: 'none',
      zIndex: '-1',
      background: '#fff',
    });

    pageElements.forEach((sourcePage, index) => {
      const page = sourcePage.cloneNode(true);
      page.classList.add('pdf-export-page');
      page.dataset.pdfPageNumber = String(index + 1);
      page.dataset.pdfPageCount = String(pageElements.length);

      // Hapus efek visual khusus preview; ukuran fisik halaman tetap sama.
      page.style.transform = 'none';
      page.style.margin = '0';
      page.style.boxShadow = 'none';
      page.style.background = '#fff';

      // Preview memakai pseudo-element untuk nomor halaman. Sembunyikan
      // pseudo-element pada clone dan buat footer nyata agar html2canvas
      // tidak bergantung pada dukungan pseudo-element/attr().
      page.style.setProperty('--page-number-display', 'none', 'important');
      _appendRealPageNumber(page, index + 1, pageElements.length);

      stage.appendChild(page);
    });

    document.body.appendChild(stage);
    void stage.offsetHeight;
    return stage;
  }

  function _appendRealPageNumber(page, pageNumber, totalPages) {
    const settings = State.getSettings().pageNumber || {};
    if (settings.enabled === false) return;

    const margin = State.getMarginMm();
    const footer = document.createElement('div');
    footer.className = 'pdf-export-page-number';
    footer.textContent = 'Halaman ' + pageNumber + ' dari ' + totalPages;

    const alignment = ['left', 'center', 'right'].includes(settings.alignment)
      ? settings.alignment
      : 'center';
    const fontSize = Number(settings.fontSize ?? 8);
    const bottom = Number(settings.bottomOffset ?? 5);
    const left = Number(margin.left ?? 25);
    const right = Number(margin.right ?? 25);
    const fontFamily = String(settings.fontFamily || 'Times New Roman')
      .replace(/[\\\\"]/g, '');

    Object.assign(footer.style, {
      position: 'absolute',
      left: left + 'mm',
      right: right + 'mm',
      bottom: bottom + 'mm',
      zIndex: '20',
      display: 'block',
      boxSizing: 'border-box',
      textAlign: alignment,
      whiteSpace: 'nowrap',
      fontFamily: "'" + fontFamily + "', serif",
      fontSize: fontSize + 'pt',
      lineHeight: '1.2',
      fontWeight: settings.bold ? '700' : '400',
      fontStyle: settings.italic ? 'italic' : 'normal',
      textDecoration: settings.underline ? 'underline' : 'none',
      color: String(settings.color || '#000000'),
      pointerEvents: 'none',
      userSelect: 'none',
    });

    page.appendChild(footer);
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

  async function exportDocument() {
    if (_exporting) return;

    if (typeof Utils.flushDebounces === 'function') {
      Utils.flushDebounces();
    }

    const templateId = State.getActiveTemplate();
    if (!templateId) {
      UI.toast('Pilih template surat terlebih dahulu.', 'warning');
      return;
    }

    const library = _getLibrary();
    if (!library) {
      UI.toast('Mesin ekspor PDF belum tersedia. Periksa koneksi internet lalu muat ulang aplikasi.', 'error', 5500);
      return;
    }

    if (typeof PreviewRenderer !== 'undefined' && typeof PreviewRenderer.waitForReady === 'function') {
      await PreviewRenderer.waitForReady();
    }

    const pages = _getPageElements();
    if (!pages.length || pages.every(page => !page || !page.children.length)) {
      UI.toast('Preview surat belum siap untuk diekspor.', 'warning');
      return;
    }

    _exporting = true;
    _setExportState(true);

    let stage = null;

    try {
      stage = _createStage(pages);
      await _waitForImages(stage);
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const dimensions = State.getPaperDimensions();
      const pageWidthMm = Number(dimensions.widthMm);
      const pageHeightMm = Number(dimensions.heightMm);

      if (!(pageWidthMm > 0) || !(pageHeightMm > 0)) {
        throw new Error('Dimensi kertas dokumen tidak valid.');
      }

      const pdf = new library.jsPDF({
        unit: 'mm',
        format: [pageWidthMm, pageHeightMm],
        orientation: pageWidthMm >= pageHeightMm ? 'landscape' : 'portrait',
        compress: true,
      });

      for (let index = 0; index < pages.length; index += 1) {
        const page = stage.children[index];
        if (!page) continue;

        const canvas = await library.html2canvas(page, {
          scale: RENDER_SCALE,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          imageTimeout: 15000,
          logging: false,
          removeContainer: true,
          scrollX: 0,
          scrollY: 0,
          windowWidth: Math.max(page.scrollWidth, page.clientWidth, 1),
          windowHeight: Math.max(page.scrollHeight, page.clientHeight, 1),
        });

        if (index > 0) {
          pdf.addPage([pageWidthMm, pageHeightMm]);
        }

        const image = canvas.toDataURL('image/jpeg', 0.96);
        pdf.addImage(
          image,
          'JPEG',
          0,
          0,
          pageWidthMm,
          pageHeightMm,
          undefined,
          'FAST'
        );
      }

      pdf.save(_getFilename(templateId));
      UI.toast('PDF berhasil dibuat: ' + pages.length + ' halaman.', 'success', 4500);
    } catch (error) {
      console.error('[PdfExport] Gagal membuat PDF:', error);
      UI.toast(
        'Ekspor PDF gagal. Periksa kembali preview surat lalu coba lagi.',
        'error',
        5000
      );
    } finally {
      stage?.remove();
      _setExportState(false);
      _exporting = false;
    }
  }

  return {
    exportDocument,
  };

})();
