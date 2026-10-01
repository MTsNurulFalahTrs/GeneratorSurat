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
    const m    = State.getMarginMm();
    const ori  = s.orientation;
    const scale = Utils.clamp(s.print.scale || 100, 50, 150);

    // Tentukan @page size
    let pageSize;
    if (s.paper.size === 'Custom') {
      // Untuk custom, gunakan dimensi aktual (sudah dirotasi jika landscape)
      pageSize = `${dim.widthMm}mm ${dim.heightMm}mm`;
    } else {
      // Gunakan nama standar jika tersedia di CSS, fallback ke dimensi mm
      const cssNames = {
        A4:     'A4',
        A5:     'A5',
        Letter: 'letter',
        Legal:  'legal',
        F4:     '215mm 330mm',   // F4/Folio tidak punya nama CSS standar
      };
      const cssName = cssNames[s.paper.size] || `${dim.widthMm}mm ${dim.heightMm}mm`;
      pageSize = ori === 'landscape' ? `${cssName} landscape` : `${cssName} portrait`;
    }

    // Skala cetak: browser mendukung transform pada @page terbatas.
    // Kita gunakan zoom pada .doc-content saat print sebagai pendekatan terbaik.
    const scaleDecimal = scale / 100;

    const css = `
@page {
  size: ${pageSize};
  margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;
}
@media print {
  .doc-content {
    padding: 0 !important;
    transform: scale(${scaleDecimal});
    transform-origin: top left;
    /* Kompensasi shrink agar konten tidak terpotong */
    width: ${(100 / scaleDecimal).toFixed(4)}%;
  }
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
