/* =============================================================
   print.js — Logika cetak dokumen
   ============================================================= */

const Print = (() => {

  /* ── Cetak surat ── */
  function printDocument() {
    const templateId = State.getActiveTemplate();
    if (!templateId) {
      UI.toast('Pilih template surat terlebih dahulu.', 'warning');
      return;
    }

    const tpl = TemplateRegistry.get(templateId);
    if (!tpl) {
      UI.toast('Template tidak ditemukan.', 'error');
      return;
    }

    const formData = State.getFormData(templateId);
    if (!formData) {
      UI.toast('Data surat belum diisi.', 'warning');
      return;
    }

    // Set orientasi halaman via @page style dinamis
    const isLandscape = tpl.meta.orientation === 'landscape';
    _setPageOrientation(isLandscape);

    // Beri browser waktu untuk apply style, lalu cetak
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
        // Setelah dialog print ditutup, cleanup style
        setTimeout(() => _cleanupPageStyle(), 1000);
      }, 150);
    });
  }

  /* ── Set @page orientation via injected style ── */
  function _setPageOrientation(isLandscape) {
    _cleanupPageStyle(); // hapus jika sudah ada

    const styleEl = document.createElement('style');
    styleEl.id = 'print-page-style';
    styleEl.textContent = isLandscape
      ? `@page { size: A4 landscape; margin: 0; }`
      : `@page { size: A4 portrait; margin: 0; }`;
    document.head.appendChild(styleEl);
  }

  /* ── Hapus injected style ── */
  function _cleanupPageStyle() {
    const existing = document.getElementById('print-page-style');
    if (existing) existing.remove();
  }

  /* ── Public API ── */
  return {
    printDocument,
  };

})();
