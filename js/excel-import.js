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
        { key: 'jenisKelamin', header: 'L/P', type: 'gender', aliases: ['l/p', 'lp', 'jenis kelamin', 'jk', 'jenis_kelamin'] },
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
        { key: 'jenisKelamin', header: 'L/P', type: 'gender', aliases: ['l/p', 'lp', 'jenis kelamin', 'jk', 'jenis_kelamin'] },
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
        { key: 'jenisKelamin', header: 'L/P', type: 'gender', aliases: ['l/p', 'lp', 'jenis kelamin', 'jk', 'jenis_kelamin'] },
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
      <div class="excel-import-toolbar__head">
        <div class="excel-import-toolbar__identity">
          <span class="excel-import-toolbar__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/>
              <path d="M15 3v5h5M8.5 12h7M8.5 16h7"/>
            </svg>
          </span>
          <div>
            <div class="excel-import-toolbar__title">Import Data Siswa</div>
            <div class="excel-import-toolbar__desc">${Utils.escapeHtml(cfg.title)} · input massal dari Excel</div>
          </div>
        </div>
        <span class="excel-import-toolbar__badge">3 langkah mudah</span>
      </div>

      <div class="excel-import-toolbar__steps" aria-label="Alur import data">
        <div class="excel-import-step">
          <span class="excel-import-step__number">1</span>
          <span><strong>Unduh template</strong><small>Gunakan format yang tersedia.</small></span>
        </div>
        <span class="excel-import-step__line" aria-hidden="true"></span>
        <div class="excel-import-step">
          <span class="excel-import-step__number">2</span>
          <span><strong>Isi data siswa</strong><small>Jangan ubah nama kolom.</small></span>
        </div>
        <span class="excel-import-step__line" aria-hidden="true"></span>
        <div class="excel-import-step">
          <span class="excel-import-step__number">3</span>
          <span><strong>Unggah &amp; import</strong><small>Data masuk sekaligus.</small></span>
        </div>
      </div>

      <div class="excel-import-toolbar__dropzone" role="button" tabindex="0" aria-label="Pilih atau seret file Excel ke sini">
        <span class="excel-import-toolbar__dropzone-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 16V4M8 8l4-4 4 4"/>
            <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>
          </svg>
        </span>
        <span class="excel-import-toolbar__dropzone-copy">
          <strong>Seret file Excel ke sini</strong>
          <span>atau klik untuk memilih file dari perangkat</span>
        </span>
        <span class="excel-import-toolbar__formats">.XLSX · .XLS · .CSV</span>
      </div>

      <div class="excel-import-toolbar__file hidden" aria-live="polite">
        <span class="excel-import-toolbar__file-icon" aria-hidden="true">✓</span>
        <span class="excel-import-toolbar__file-meta">
          <strong class="excel-import-toolbar__file-name">Belum ada file</strong>
          <small class="excel-import-toolbar__file-size"></small>
        </span>
        <button type="button" class="btn-icon excel-import-clear" title="Ganti file" aria-label="Ganti file">↻</button>
      </div>

      <div class="excel-import-toolbar__actions">
        <button type="button" class="btn btn--sm btn--secondary excel-template-btn">
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>
            </svg>
          </span>
          Download Template
        </button>
        <button type="button" class="btn btn--sm btn--primary excel-import-btn">
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 15V3M8 7l4-4 4 4M5 13v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>
            </svg>
          </span>
          Pilih File Excel
        </button>
        <input type="file" class="excel-file-input" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" hidden />
      </div>

      <div class="excel-import-toolbar__hint">
        <span aria-hidden="true">ⓘ</span>
        <span>Pastikan header kolom tetap sesuai template agar data terbaca dengan benar.</span>
      </div>`;

    const fileInput = toolbar.querySelector('.excel-file-input');
    const dropzone = toolbar.querySelector('.excel-import-toolbar__dropzone');
    const fileBox = toolbar.querySelector('.excel-import-toolbar__file');
    const fileName = toolbar.querySelector('.excel-import-toolbar__file-name');
    const fileSize = toolbar.querySelector('.excel-import-toolbar__file-size');

    const formatSize = (bytes) => {
      if (!Number.isFinite(bytes) || bytes < 1024) return `${bytes || 0} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const showSelectedFile = (file) => {
      if (!file) return;
      fileName.textContent = file.name;
      fileSize.textContent = formatSize(file.size);
      fileBox.classList.remove('hidden');
      dropzone.classList.add('has-file');
    };

    const selectFile = (file) => {
      if (!file) return;
      showSelectedFile(file);
      importFile(file, templateId, sectionId);
    };

    dropzone.addEventListener('click', () => {
      if (typeof window.XLSX === 'undefined') {
        UI.toast('Fitur Excel belum siap. Pastikan koneksi internet tersedia lalu muat ulang halaman.', 'error');
        return;
      }
      fileInput.click();
    });

    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dropzone.click();
      }
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('is-dragging');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('is-dragging');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file) selectFile(file);
    });

    toolbar.querySelector('.excel-import-btn').addEventListener('click', () => dropzone.click());
    toolbar.querySelector('.excel-template-btn').addEventListener('click', () => downloadTemplate(templateId));

    toolbar.querySelector('.excel-import-clear').addEventListener('click', () => {
      fileInput.value = '';
      fileBox.classList.add('hidden');
      dropzone.classList.remove('has-file');
      dropzone.focus();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) selectFile(file);
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

    if (!file || typeof file.name !== 'string') {
      UI.toast('File Excel belum dipilih.', 'warning');
      return;
    }

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

        // Nilai enum yang diberikan pengguna harus dikenali. Jangan diam-diam
        // mengubah nilai invalid menjadi default yang terlihat valid.
        const rawGender = headerMap.has('jenisKelamin')
          ? row[headerMap.get('jenisKelamin')]
          : '';
        if (String(rawGender ?? '').trim() && item.jenisKelamin === '') {
          skipped.push(`baris ${rowNumber}: L/P tidak dikenali (gunakan L/P, Laki-laki, atau Perempuan)`);
          return;
        }

        item.id = Utils.generateId(templateId === 'dpu' ? 'peserta' : 'siswa');

        if (templateId === 'dpu') {
          item.urt = toNumberOr(index + 1, item.urt);
          const rawEmis = headerMap.has('terdaftarEmis')
            ? row[headerMap.get('terdaftarEmis')]
            : '';
          if (!String(rawEmis ?? '').trim()) {
            item.terdaftarEmis = true;
          } else if (item.terdaftarEmis === '') {
            skipped.push(`baris ${rowNumber}: Nilai Terdaftar di EMIS tidak dikenali`);
            return;
          }
        }

        if (templateId === 'mutasi-masuk') {
          const rawKelas = headerMap.has('kelas') ? row[headerMap.get('kelas')] : '';
          if (!String(rawKelas ?? '').trim()) {
            item.kelas = 'VIII';
          } else if (!item.kelas) {
            skipped.push(`baris ${rowNumber}: Kelas Tujuan tidak valid`);
            return;
          }
        }

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
    if (col.type === 'gender') return normalizeGender(value);
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
    return '';
  }

  function normalizeGender(value) {
    const text = normalize(value);
    if (!text) return '';
    if (['l', 'laki laki', 'male'].includes(text)) return 'L';
    if (['p', 'perempuan', 'female'].includes(text)) return 'P';
    return '';
  }

  function normalizeClass(value) {
    const text = String(value ?? '').trim().toUpperCase();
    if (!text) return '';

    const romanMap = {
      I: 'I', II: 'II', III: 'III', IV: 'IV', V: 'V', VI: 'VI',
      VII: 'VII', VIII: 'VIII', IX: 'IX', X: 'X', XI: 'XI', XII: 'XII',
    };
    if (romanMap[text]) return romanMap[text];

    if (/^\d{1,2}$/.test(text)) {
      const numeric = Number(text);
      if (numeric >= 1 && numeric <= 12) {
        return ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][numeric - 1];
      }
    }

    const roman = text.match(/^(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)(?:\s*\([^)]*\))?$/);
    if (roman) return roman[1];

    const numericWithLabel = text.match(/^([1-9]|1[0-2])(?:\s*\([^)]*\))?$/);
    if (numericWithLabel) {
      return ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][Number(numericWithLabel[1]) - 1];
    }

    return '';
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
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string' && value.trim() === '') return fallback;
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
