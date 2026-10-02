/* =============================================================
   print.js — Logika cetak dokumen
   =============================================================
   Mengambil konfigurasi kertas, margin, dan skala dari
   State.getSettings() agar sinkron dengan tab Pengaturan.
   Print TIDAK menggunakan transform scale dari preview —
   preview zoom dan print scale adalah dua hal yang terpisah.
*/

const Print = (() => {

  /* ── ID style element yang diinjeksi ── */
  const STYLE_ID = 'print-page-style';

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

    // Terapkan @page style dari settings
    _applyPageStyle();

    // Beri browser waktu untuk apply style, lalu cetak
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
        // Cleanup setelah dialog cetak ditutup
        setTimeout(_cleanupPageStyle, 1500);
      }, 150);
    });
  }

  /* ── Bangun dan injeksi @page style dari State.settings ── */
  function _applyPageStyle() {
    _cleanupPageStyle();

    const s    = State.getSettings();
    const dim  = State.getPaperDimensions(); // sudah memperhitungkan orientasi

    // Gunakan dimensi fisik aktual dari State, setelah orientasi diterapkan.
    // Ini menghindari perbedaan antara nama ukuran CSS (mis. F4/Legal) dan
    // dimensi halaman yang dipakai PreviewRenderer.
    const pageSize = `${dim.widthMm}mm ${dim.heightMm}mm`;

    // Skala cetak bukan bagian dari layout Preview. Jangan menerapkan transform
    // di sini karena transform dapat mengubah clipping, tinggi efektif, dan
    // pagination. Browser print dialog tetap menjadi kontrol akhir skala fisik.

    const css = `
@page {
  size: ${pageSize};
  margin: 0;
}
@media print {
  /* Typography, margin, table style, KOP, dan seluruh style isi
     dipertahankan dari DOM Preview/current State. */
  .surat-preview {
    box-shadow: none !important;
  }
}`;

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  /* ── Hapus injected style ── */
  function _cleanupPageStyle() {
    document.getElementById(STYLE_ID)?.remove();
  }

  /* ── Public API ── */
  return {
    printDocument,
    applyPageStyle:   _applyPageStyle,
    cleanupPageStyle: _cleanupPageStyle,
  };

})();
