/* =============================================================
   data-io.js — Export & Import data surat ke/dari file JSON
   =============================================================
   Saran 7: Memberikan pengguna backup permanen di luar localStorage.
   Data dapat diekspor sebagai .json lalu diimpor kembali kapan saja,
   bahkan setelah TTL 2 jam habis atau browser dibersihkan.

   Ekspor  : State.serialize() → Blob JSON → download
   Impor   : File JSON → validasi schema → State.restore() → re-render
*/

const DataIO = (() => {

  /* ── Konstanta ── */
  const EXPORT_BUTTON_ID = 'btn-export-data';
  const IMPORT_BUTTON_ID = 'btn-import-data';
  const IMPORT_INPUT_ID  = 'input-import-data';
  const SCHEMA_VERSION   = '1.0';           // versi metadata ekspor (bukan validasi schema)
  const MAX_FILE_SIZE    = 10 * 1024 * 1024; // 10 MB

  /* ── Validasi schema JSON yang diimpor ── */
  function _validateSchema(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false, message: 'Format file tidak valid. Pastikan file adalah ekspor dari aplikasi ini.' };
    }

    // Cek apakah ini file ekspor DataIO (punya wrapper export_version)
    // atau langsung serialized state (dari Storage lama)
    const data = parsed.data ?? parsed;

    if (typeof data !== 'object' || Array.isArray(data)) {
      return { valid: false, message: 'Struktur data tidak dikenali.' };
    }

    // Minimal harus punya salah satu dari field ini
    const hasKnownField = 'activeTemplate' in data || 'kop' in data || 'forms' in data;
    if (!hasKnownField) {
      return { valid: false, message: 'File tidak berisi data surat yang valid.' };
    }

    return { valid: true, data };
  }

  /* ── Generate nama file ekspor ── */
  function _getExportFilename() {
    const templateId = State.getActiveTemplate();
    const template   = typeof TemplateRegistry !== 'undefined'
      ? TemplateRegistry.get(templateId)
      : null;
    const label = template?.meta?.name || 'Data Surat';

    const now  = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');

    const time = [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
    ].join('');

    const safeLabel = String(label)
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return `Backup - ${safeLabel} - ${date} ${time}.json`;
  }

  /* ── Ekspor data ke file JSON ── */
  function exportData() {
    try {
      const serialized = State.serialize();

      // Bungkus dengan metadata ekspor
      const exportPayload = {
        export_version: SCHEMA_VERSION,
        exported_at:    new Date().toISOString(),
        app:            'Generator Surat Madrasah',
        data:           serialized,
      };

      const json = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url  = URL.createObjectURL(blob);

      const anchor       = document.createElement('a');
      anchor.href        = url;
      anchor.download    = _getExportFilename();
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setTimeout(() => URL.revokeObjectURL(url), 30000);

      UI.toast('Data berhasil diekspor ke file JSON.', 'success');
      return true;
    } catch (err) {
      console.error('[DataIO] Gagal ekspor:', err);
      UI.toast('Gagal mengekspor data. Coba lagi.', 'error');
      return false;
    }
  }

  /* ── Impor data dari file JSON ── */
  async function importData(file) {
    if (!file) return false;

    // Validasi tipe file
    const validTypes = ['application/json', 'text/json', 'text/plain'];
    const validExt   = file.name?.toLowerCase().endsWith('.json');
    if (!validTypes.includes(file.type) && !validExt) {
      UI.toast('File harus berformat .json', 'warning');
      return false;
    }

    // Validasi ukuran
    if (file.size > MAX_FILE_SIZE) {
      UI.toast('File terlalu besar. Maksimum 10 MB.', 'warning');
      return false;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        let parsed;
        try {
          parsed = JSON.parse(/** @type {string} */ (e.target.result));
        } catch {
          UI.toast('File tidak dapat dibaca. Pastikan file adalah JSON yang valid.', 'error');
          resolve(false);
          return;
        }

        const { valid, message, data } = _validateSchema(parsed);
        if (!valid) {
          UI.toast(message, 'error');
          resolve(false);
          return;
        }

        // Konfirmasi impor (akan menimpa data saat ini)
        UI.confirm(
          'Impor Data',
          'Data saat ini akan diganti dengan data dari file yang dipilih. Lanjutkan?',
          () => {
            try {
              State.restore(data);

              // Re-render semua komponen
              const activeId = State.getActiveTemplate();

              if (typeof TemplateRegistry !== 'undefined') {
                TemplateRegistry.renderTemplateList(
                  document.getElementById('template-list'),
                  activeId,
                  window.App?.selectTemplate
                );
              }

              if (activeId) {
                if (typeof TemplateRegistry !== 'undefined') {
                  TemplateRegistry.updateActiveCard(
                    document.getElementById('template-list'),
                    activeId
                  );
                }
                if (typeof FormRenderer !== 'undefined') {
                  FormRenderer.render(activeId);
                }
                UI.switchTab('form');
              } else {
                UI.switchTab('template');
              }

              UI.toast('Data berhasil diimpor.', 'success');
              resolve(true);
            } catch (err) {
              console.error('[DataIO] Gagal restore state:', err);
              UI.toast('Gagal memuat data dari file.', 'error');
              resolve(false);
            }
          },
          // onCancel: user membatalkan — selesaikan Promise agar tidak hang
          () => resolve(false)
        );
      };

      reader.onerror = () => {
        UI.toast('Gagal membaca file. Coba pilih file lain.', 'error');
        resolve(false);
      };

      reader.readAsText(file, 'utf-8');
    });
  }

  /* ── Bind event ke tombol header ── */
  function init() {
    // Tombol Ekspor
    const btnExport = document.getElementById(EXPORT_BUTTON_ID);
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const templateId = State.getActiveTemplate();
        if (!templateId) {
          UI.toast('Pilih template surat terlebih dahulu sebelum mengekspor.', 'warning');
          return;
        }
        exportData();
      });
    }

    // Tombol Impor — membuka input file tersembunyi
    const btnImport  = document.getElementById(IMPORT_BUTTON_ID);
    const inputImport = /** @type {HTMLInputElement|null} */ (document.getElementById(IMPORT_INPUT_ID));

    if (btnImport && inputImport) {
      btnImport.addEventListener('click', () => {
        inputImport.value = ''; // reset agar onChange tetap terpicu meski file sama
        inputImport.click();
      });

      inputImport.addEventListener('change', async (e) => {
        const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
        if (file) await importData(file);
        inputImport.value = '';
      });
    }
  }

  return { init, exportData, importData };

})();
