/* =============================================================
   excel-import.js — Import / template Excel data siswa
   ============================================================= */

const ExcelImport = (() => {

  const CONFIGS = {
    dpu: {
      sectionId: 'peserta',
      title: 'Daftar Peserta Ujian (DPU)',
      fileName: 'Template_Import_Data_DPU.xlsx',
      columns: [
        { key: 'urt', header: 'No. URT', type: 'number', aliases: ['urt', 'no urt', 'nomor urt'] },
        { key: 'indk', header: 'INDK', aliases: ['indk'] },
        { key: 'nisn', header: 'NISN', aliases: ['nisn'] },
        { key: 'registrasi', header: 'No. Registrasi', aliases: ['no registrasi', 'nomor registrasi', 'registrasi'] },
        { key: 'nik', header: 'NIK', aliases: ['nik'] },
        { key: 'namaSiswa', header: 'Nama Siswa', required: true, aliases: ['nama siswa', 'nama', 'nama lengkap'] },
        { key: 'jenisKelamin', header: 'L/P', aliases: ['l/p', 'lp', 'jenis kelamin', 'jk', 'jenis_kelamin'] },
        { key: 'tempatLahir', header: 'Tempat Lahir', aliases: ['tempat lahir', 'tempat_lahir'] },
        { key: 'tanggalLahir', header: 'Tanggal Lahir', type: 'date', aliases: ['tanggal lahir', 'tgl lahir', 'tanggal_lahir', 'tgl_lahir'] },
        { key: 'namaOrangTua', header: 'Nama Orang Tua', aliases: ['nama orang tua', 'orang tua', 'wali', 'nama_orang_tua'] },
        { key: 'asalSekolah', header: 'Asal Sekolah', aliases: ['asal sekolah', 'sekolah asal', 'asal_sekolah'] },
        { key: 'noIjazah', header: 'No. Ijazah', aliases: ['no ijazah', 'nomor ijazah', 'no_ijazah'] },
        { key: 'terdaftarEmis', header: 'Terdaftar di EMIS', type: 'boolean', aliases: ['terdaftar di emis', 'terdaftar emis', 'emis'] },
        { key: 'alasanBelum', header: 'Alasan Jika Belum', aliases: ['alasan jika belum', 'alasan belum', 'alasan_belum'] },
      ],
    },
    'mutasi-masuk': {
      sectionId: 'siswa',
      title: 'Daftar Pengesahan Siswa Mutasi Masuk',
      fileName: 'Template_Import_Data_Mutasi_Masuk.xlsx',
      columns: [
        { key: 'nis', header: 'NIS', aliases: ['nis'] },
        { key: 'nisn', header: 'NISN', aliases: ['nisn'] },
        { key: 'namaSiswa', header: 'Nama Siswa', required: true, aliases: ['nama siswa', 'nama', 'nama lengkap'] },
        { key: 'jenisKelamin', header: 'L/P', aliases: ['l/p', 'lp', 'jenis kelamin', 'jk', 'jenis_kelamin'] },
        { key: 'tempatLahir', header: 'Tempat Lahir', aliases: ['tempat lahir', 'tempat_lahir'] },
        { key: 'tanggalLahir', header: 'Tanggal Lahir', type: 'date', aliases: ['tanggal lahir', 'tgl lahir', 'tanggal_lahir', 'tgl_lahir'] },
        { key: 'namaOrangTua', header: 'Nama Orang Tua', aliases: ['nama orang tua', 'orang tua', 'wali', 'nama_orang_tua'] },
        { key: 'sekolahAsal', header: 'Sekolah Asal', aliases: ['sekolah asal', 'asal sekolah', 'sekolah_asal', 'asal_sekolah'] },
        { key: 'kelas', header: 'Kelas Tujuan', type: 'class', aliases: ['kelas tujuan', 'kelas', 'kelas_tujuan'] },
        { key: 'noIjazah', header: 'No. Ijazah', aliases: ['no ijazah', 'nomor ijazah', 'no_ijazah'] },
        { key: 'kkrps', header: 'K.K.R.P.S', aliases: ['k.k.r.p.s', 'kkrps', 'kk rps'] },
        { key: 'noPengesahan', header: 'No. Pengesahan/Registrasi', aliases: ['no pengesahan/registrasi', 'no pengesahan', 'nomor pengesahan', 'no_pengesahan'] },
      ],
    },
    'siswa-baru': {
      sectionId: 'siswa',
      title: 'Daftar Pengesahan Siswa Baru',
      fileName: 'Template_Import_Data_Siswa_Baru.xlsx',
      columns: [
        { key: 'nis', header: 'NIS', aliases: ['nis'] },
        { key: 'nisn', header: 'NISN', aliases: ['nisn'] },
        { key: 'namaSiswa', header: 'Nama Siswa', required: true, aliases: ['nama siswa', 'nama', 'nama lengkap'] },
        { key: 'jenisKelamin', header: 'L/P', aliases: ['l/p', 'lp', 'jenis kelamin', 'jk', 'jenis_kelamin'] },
        { key: 'tempatLahir', header: 'Tempat Lahir', aliases: ['tempat lahir', 'tempat_lahir'] },
        { key: 'tanggalLahir', header: 'Tanggal Lahir', type: 'date', aliases: ['tanggal lahir', 'tgl lahir', 'tanggal_lahir', 'tgl_lahir'] },
        { key: 'namaOrangTua', header: 'Nama Orang Tua', aliases: ['nama orang tua', 'orang tua', 'wali', 'nama_orang_tua'] },
        { key: 'sekolahAsal', header: 'Sekolah Asal', aliases: ['sekolah asal', 'asal sekolah', 'sekolah_asal', 'asal_sekolah'] },
        { key: 'noIjazah', header: 'No. Ijazah', aliases: ['no ijazah', 'nomor ijazah', 'no_ijazah'] },
        { key: 'kkrps', header: 'K.K.R.P.S', aliases: ['k.k.r.p.s', 'kkrps', 'kk rps'] },
        { key: 'noPengesahan', header: 'No. Pengesahan/Registrasi', aliases: ['no pengesahan/registrasi', 'no pengesahan', 'nomor pengesahan', 'no_pengesahan'] },
      ],
    },
  };

  const MONTHS = {
    januari: 1, jan: 1,
    februari: 2, feb: 2,
    maret: 3, mar: 3,
    april: 4, apr: 4,
    mei: 5, may: 5,
    juni: 6, jun: 6,
    juli: 7, jul: 7,
    agustus: 8, agu: 8, agt: 8, aug: 8,
    september: 9, sep: 9,
    oktober: 10, okt: 10, oct: 10,
    november: 11, nov: 11,
    desember: 12, des: 12, dec: 12,
  };

  function getConfig(templateId, sectionId) {
    const cfg = CONFIGS[templateId];
    return cfg && cfg.sectionId === sectionId ? cfg : null;
  }

  function buildToolbar(templateId, sectionId) {
    const cfg = getConfig(templateId, sectionId);
    if (!cfg) return null;

    const toolbar = document.createElement('div');
    toolbar.className = 'excel-import-toolbar';
    toolbar.innerHTML = `
      <div class="excel-import-toolbar__info">
        <span class="excel-import-toolbar__icon" aria-hidden="true">📊</span>
        <div>
          <div class="excel-import-toolbar__title">Import Data dari Excel</div>
          <div class="excel-import-toolbar__desc">Isi data siswa secara massal menggunakan file Excel.</div>
        </div>
      </div>
      <div class="excel-import-toolbar__actions">
        <button type="button" class="btn btn--sm btn--secondary excel-template-btn">
          <span aria-hidden="true">⬇️</span> Download Template
        </button>
        <button type="button" class="btn btn--sm btn--primary excel-import-btn">
          <span aria-hidden="true">📥</span> Import Excel
        </button>
        <input type="file" class="excel-file-input" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" hidden />
      </div>`;

    toolbar.querySelector('.excel-template-btn').addEventListener('click', () => downloadTemplate(templateId));
    toolbar.querySelector('.excel-import-btn').addEventListener('click', () => {
      if (typeof window.XLSX === 'undefined') {
        UI.toast('Fitur Excel belum siap. Pastikan koneksi internet tersedia lalu muat ulang halaman.', 'error');
        return;
      }
      toolbar.querySelector('.excel-file-input').click();
    });
    toolbar.querySelector('.excel-file-input').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) importFile(file, templateId, sectionId);
      e.target.value = '';
    });

    return toolbar;
  }

  function downloadTemplate(templateId) {
    const cfg = CONFIGS[templateId];
    if (!cfg) return;

    if (typeof window.XLSX === 'undefined') {
      UI.toast('Fitur Excel belum siap. Pastikan koneksi internet tersedia lalu muat ulang halaman.', 'error');
      return;
    }

    try {
      const headers = cfg.columns.map(col => col.header);
      const instructionRows = [
        ['PETUNJUK IMPORT DATA SISWA'],
        ['Template', cfg.title],
        ['Petunjuk', 'Isi data siswa mulai dari baris kedua pada sheet "Data Siswa". Jangan mengubah nama header kolom.'],
        ['Tanggal Lahir', 'Gunakan format tanggal yang mudah dikenali Excel, misalnya 31/12/2012 atau 2012-12-31.'],
        ['L/P', 'Isi L untuk laki-laki atau P untuk perempuan. Variasi "Laki-laki" dan "Perempuan" juga didukung.'],
      ];
      if (templateId === 'mutasi-masuk') {
        instructionRows.push(['Kelas Tujuan', 'Gunakan angka Romawi I sampai XII. Contoh: VII, VIII, IX. Angka 7-12 juga dapat dikenali otomatis.']);
      }
      if (templateId === 'dpu') {
        instructionRows.push(['Terdaftar di EMIS', 'Isi Sudah/Belum, Ya/Tidak, TRUE/FALSE, atau 1/0. Jika dikosongkan, dianggap Sudah.']);
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      const infoWs = XLSX.utils.aoa_to_sheet(instructionRows);

      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
      ws['!autofilter'] = { ref: `A1:${columnLetter(headers.length)}1` };
      ws['!cols'] = headers.map(h => ({ wch: Math.max(14, Math.min(30, h.length + 5)) }));

      // Sediakan 50 baris kosong agar format teks untuk identitas tetap terbawa
      // ketika pengguna mulai mengetik di Excel.
      for (let row = 2; row <= 51; row++) {
        cfg.columns.forEach((col, colIdx) => {
          if (!col.type || ['date', 'boolean', 'class', 'number'].includes(col.type)) return;
          const cellRef = XLSX.utils.encode_cell({ r: row - 1, c: colIdx });
          if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
          ws[cellRef].z = '@';
        });
      }

      XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa');
      XLSX.utils.book_append_sheet(wb, infoWs, 'Petunjuk');
      XLSX.writeFile(wb, cfg.fileName, { compression: true });

      UI.toast('Template Excel berhasil diunduh.', 'success');
    } catch (err) {
      console.error('[ExcelImport] Gagal membuat template:', err);
      UI.toast('Template Excel gagal dibuat. Silakan coba lagi.', 'error');
    }
  }

  async function importFile(file, templateId, sectionId) {
    const cfg = getConfig(templateId, sectionId);
    if (!cfg) return;

    if (typeof window.XLSX === 'undefined') {
      UI.toast('Fitur Excel belum siap. Pastikan koneksi internet tersedia lalu muat ulang halaman.', 'error');
      return;
    }

    const allowed = /\.(xlsx|xls|csv)$/i.test(file.name);
    if (!allowed) {
      UI.toast('Format file tidak didukung. Gunakan file .xlsx, .xls, atau .csv.', 'error');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames.find(name => normalize(name) === 'data siswa') || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) throw new Error('Sheet data tidak ditemukan.');

      const rawRows = XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        raw: true,
        blankrows: false,
      });

      if (!rawRows.length) {
        UI.toast('File Excel tidak berisi data siswa.', 'warning');
        return;
      }

      const headerMap = buildHeaderMap(rawRows[0], cfg);
      const missingRequired = cfg.columns.filter(c => c.required && !headerMap.has(c.key));
      if (missingRequired.length) {
        throw new Error(`Kolom wajib tidak ditemukan: ${missingRequired.map(c => c.header).join(', ')}.`);
      }

      const items = [];
      const skipped = [];

      rawRows.forEach((row, index) => {
        const rowNumber = index + 2;
        if (isEmptyRow(row)) return;

        const item = {};
        cfg.columns.forEach(col => {
          const sourceHeader = headerMap.get(col.key);
          const rawValue = sourceHeader ? row[sourceHeader] : '';
          item[col.key] = normalizeValue(rawValue, col);
        });

        if (!String(item.namaSiswa || '').trim()) {
          skipped.push(`baris ${rowNumber}: Nama Siswa kosong`);
          return;
        }

        item.id = Utils.generateId(templateId === 'dpu' ? 'peserta' : 'siswa');

        if (templateId === 'dpu') {
          item.urt = toNumberOr(index + 1, item.urt);
          if (item.terdaftarEmis === '') item.terdaftarEmis = true;
        }

        if (templateId === 'mutasi-masuk' && !item.kelas) item.kelas = 'VIII';

        items.push(item);
      });

      if (!items.length) {
        UI.toast('Tidak ada baris siswa yang valid untuk diimpor.', 'warning');
        return;
      }

      const current = State.getFormData(templateId);
      const currentItems = current?.[sectionId] || [];
      const currentMeaningful = currentItems.filter(item => hasMeaningfulData(item, cfg));

      const message = currentMeaningful.length
        ? `Ditemukan ${items.length} data siswa valid. Daftar siswa yang saat ini berisi ${currentMeaningful.length} data akan diganti dengan data dari Excel. Lanjutkan?`
        : `Ditemukan ${items.length} data siswa valid. Data siswa dari Excel akan dimasukkan ke template. Lanjutkan?`;

      UI.confirm('Konfirmasi Import Excel', message, () => {
        State.setFormData(templateId, { [sectionId]: items });
        FormRenderer.render(templateId);

        const skippedText = skipped.length ? ` ${skipped.length} baris dilewati karena Nama Siswa kosong.` : '';
        UI.toast(`${items.length} data siswa berhasil diimpor.${skippedText}`, 'success', 5000);
      });
    } catch (err) {
      console.error('[ExcelImport] Gagal membaca file:', err);
      UI.toast(err?.message || 'File Excel tidak dapat diproses. Pastikan menggunakan template yang sesuai.', 'error', 6000);
    }
  }

  function buildHeaderMap(firstRow, cfg) {
    const normalizedHeaders = new Map();
    Object.keys(firstRow || {}).forEach(header => {
      normalizedHeaders.set(normalize(header), header);
    });

    const result = new Map();
    cfg.columns.forEach(col => {
      const candidates = [col.header, col.key, ...(col.aliases || [])];
      const found = candidates
        .map(normalize)
        .find(candidate => normalizedHeaders.has(candidate));
      if (found) result.set(col.key, normalizedHeaders.get(found));
    });
    return result;
  }

  function normalizeValue(value, col) {
    if (value === null || value === undefined) return '';

    if (col.type === 'date') return normalizeDate(value);
    if (col.type === 'boolean') return normalizeBoolean(value);
    if (col.type === 'class') return normalizeClass(value);
    if (col.type === 'number') return toNumberOr('', value);

    return String(value).trim();
  }

  function normalizeBoolean(value) {
    if (typeof value === 'boolean') return value;
    const text = normalize(value);
    if (!text) return '';
    if (['sudah', 'ya', 'yes', 'true', '1', 'terdaftar'].includes(text)) return true;
    if (['belum', 'tidak', 'no', 'false', '0', 'belum terdaftar'].includes(text)) return false;
    return Boolean(value);
  }

  function normalizeClass(value) {
    const text = String(value ?? '').trim().toUpperCase();
    if (!text) return '';

    const romanMap = {
      I: 'I', II: 'II', III: 'III', IV: 'IV', V: 'V', VI: 'VI',
      VII: 'VII', VIII: 'VIII', IX: 'IX', X: 'X', XI: 'XI', XII: 'XII',
    };
    if (romanMap[text]) return romanMap[text];

    const numeric = parseInt(text, 10);
    if (numeric >= 1 && numeric <= 12) {
      return ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][numeric - 1];
    }

    const match = text.match(/^(I{1,3}|IV|V?I{0,3}|IX|X{1,3}|XI|XII)\b/);
    return match ? match[1] : text;
  }

  function normalizeDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return toIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
    }

    if (typeof value === 'number' && Number.isFinite(value) && window.XLSX?.SSF?.parse_date_code) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) return toIsoDate(parsed.y, parsed.m, parsed.d);
    }

    const text = String(value ?? '').trim();
    if (!text) return '';

    // ISO / ISO datetime
    const iso = text.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
    if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

    // dd/mm/yyyy atau dd-mm-yyyy
    const dmy = text.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    if (dmy) return toIsoDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));

    // "12 Januari 2012"
    const named = text.toLowerCase().match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i);
    if (named) {
      const month = MONTHS[normalize(named[2])];
      if (month) return toIsoDate(Number(named[3]), month, Number(named[1]));
    }

    // Fallback aman: hanya terima Date yang valid dari parser browser.
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return toIsoDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
    }

    return '';
  }

  function toIsoDate(year, month, day) {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    const date = new Date(y, m - 1, d);
    if (
      !Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) ||
      date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d
    ) return '';
    return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
  }

  function toNumberOr(fallback, value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function hasMeaningfulData(item, cfg) {
    return cfg.columns.some(col => {
      const value = item?.[col.key];
      if (col.key === 'terdaftarEmis') return false;
      return value !== '' && value !== null && value !== undefined;
    });
  }

  function isEmptyRow(row) {
    return Object.values(row || {}).every(value => value === '' || value === null || value === undefined);
  }

  function normalize(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[._/\\-]+/g, ' ')
      .replace(/\s+/g, ' ');
  }

  function columnLetter(n) {
    let result = '';
    let num = n;
    while (num > 0) {
      const rem = (num - 1) % 26;
      result = String.fromCharCode(65 + rem) + result;
      num = Math.floor((num - 1) / 26);
    }
    return result;
  }

  return {
    getConfig,
    buildToolbar,
    downloadTemplate,
  };

})();
