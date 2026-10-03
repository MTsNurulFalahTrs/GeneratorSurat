/* =============================================================
   validation.js — Validasi input form dan data state
   ============================================================= */

const Validation = (() => {

  /* ── Konstanta ── */
  const FONT_SIZE_MIN = 7;
  const FONT_SIZE_MAX = 22;
  const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;  // 2 MB
  const KOP_ROWS_MIN = 1;
  const KOP_ROWS_MAX = 10;
  const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];

  /* ── Hasil validasi standar ── */
  function result(valid, message = '') {
    return { valid, message };
  }

  /* ── 1. Validasi string tidak kosong ── */
  function required(value, fieldName = 'Field ini') {
    const trimmed = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    if (!trimmed) {
      return result(false, `${fieldName} wajib diisi.`);
    }
    return result(true);
  }

  /* ── 3. Validasi font size KOP (7–22 pt) ── */
  function fontSize(value, fieldName = 'Ukuran font') {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return result(false, `${fieldName} harus berupa angka.`);
    }
    if (num < FONT_SIZE_MIN || num > FONT_SIZE_MAX) {
      return result(false, `${fieldName} harus antara ${FONT_SIZE_MIN}–${FONT_SIZE_MAX} pt.`);
    }
    return result(true);
  }

  /* ── 4. Validasi jumlah baris KOP ── */
  function kopRowCount(value) {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return result(false, `Jumlah baris harus berupa angka.`);
    }
    if (num < KOP_ROWS_MIN || num > KOP_ROWS_MAX) {
      return result(false, `Jumlah baris KOP harus antara ${KOP_ROWS_MIN}–${KOP_ROWS_MAX}.`);
    }
    return result(true);
  }

  /* ── 5. Validasi file gambar (logo) ── */
  function imageFile(file, options = {}) {
    const { required: isRequired = true, maxSize = MAX_LOGO_SIZE_BYTES } = options;

    if (!file) {
      if (isRequired) return result(false, 'Logo wajib dipilih.');
      return result(true);
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return result(false, `Format file tidak valid. Gunakan: PNG, JPG, GIF, WebP, atau SVG.`);
    }

    if (file.size > maxSize) {
      return result(false, `Ukuran file terlalu besar. Maksimum: ${Utils.formatBytes(maxSize)}.`);
    }

    return result(true);
  }

  /* ── 9. Validasi format NISN (10 digit angka) ── */
  function nisn(value) {
    if (!value) return result(true); // optional field
    const clean = value.toString().trim();
    if (!/^\d{10}$/.test(clean)) {
      return result(false, 'NISN harus 10 digit angka.');
    }
    return result(true);
  }

  /* ── 10. Validasi NIK (16 digit angka) ── */
  function nik(value) {
    if (!value) return result(true); // optional field
    const clean = value.toString().trim();
    if (!/^\d{16}$/.test(clean)) {
      return result(false, 'NIK harus 16 digit angka.');
    }
    return result(true);
  }

  /* ── 11. Validasi tanggal ISO ── */
  function isoDate(value, fieldName = 'Tanggal') {
    if (!value) return result(true); // optional
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return result(false, `${fieldName} harus dalam format YYYY-MM-DD.`);
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day) ||
      month < 1 || month > 12 ||
      day < 1 || day > 31 ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return result(false, `${fieldName} tidak valid.`);
    }

    return result(true);
  }

  /* ── 13. Validasi KOP config secara menyeluruh ── */
  function kopConfig(kop) {
    const errors = [];

    // Logo kiri wajib ada
    if (!kop.logoLeft || !kop.logoLeft.dataUrl) {
      errors.push({ field: 'logoLeft', message: 'Logo kiri KOP wajib diunggah.' });
    }

    // Cek row count
    const rowCountCheck = kopRowCount(kop.rows ? kop.rows.length : 0);
    if (!rowCountCheck.valid) {
      errors.push({ field: 'rows', message: rowCountCheck.message });
    }

    // Cek tiap baris
    if (Array.isArray(kop.rows)) {
      kop.rows.forEach((row, idx) => {
        const fsCheck = fontSize(row.fontSize);
        if (!fsCheck.valid) {
          errors.push({ field: `rows[${idx}].fontSize`, message: `Baris ${idx + 1}: ${fsCheck.message}` });
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /* ── 14. Validasi form DPU ── */
  function formDpu(formData) {
    const errors = [];

    if (!formData) return { valid: false, errors: [{ field: 'form', message: 'Data form kosong.' }] };

    const { meta, peserta } = formData;

    // Meta
    const checkMeta = (field, label) => {
      const v = meta?.[field];
      const r = required(v, label);
      if (!r.valid) errors.push({ field: `meta.${field}`, message: r.message });
    };

    checkMeta('namaMadrasah', 'Nama Madrasah');
    checkMeta('status', 'Status');
    if (meta?.status && !['Swasta', 'Negeri'].includes(String(meta.status))) {
      errors.push({ field: 'meta.status', message: 'Status harus Swasta atau Negeri.' });
    }
    checkMeta('tahunPelajaran', 'Tahun Pelajaran');

    // Peserta minimal 1
    if (!peserta || peserta.length === 0) {
      errors.push({ field: 'peserta', message: 'Minimal satu peserta harus ditambahkan.' });
    } else {
      peserta.forEach((p, idx) => {
        const urt = Number(p.urt);
        if (!Number.isInteger(urt) || urt < 1) {
          errors.push({ field: `peserta[${idx}].urt`, message: `No. URT #${idx + 1} harus berupa bilangan bulat minimal 1.` });
        }

        const rNama = required(p.namaSiswa, `Nama siswa #${idx + 1}`);
        if (!rNama.valid) errors.push({ field: `peserta[${idx}].namaSiswa`, message: rNama.message });

        const rJenisKelamin = required(p.jenisKelamin, `Jenis kelamin siswa #${idx + 1}`);
        if (!rJenisKelamin.valid || !['L', 'P'].includes(String(p.jenisKelamin))) {
          errors.push({ field: `peserta[${idx}].jenisKelamin`, message: rJenisKelamin.valid
            ? `Jenis kelamin siswa #${idx + 1} harus L atau P.`
            : rJenisKelamin.message });
        }

        if (p.nik) {
          const rNik = nik(p.nik);
          if (!rNik.valid) errors.push({ field: `peserta[${idx}].nik`, message: `Peserta #${idx + 1}: ${rNik.message}` });
        }
        if (p.nisn) {
          const rNisn = nisn(p.nisn);
          if (!rNisn.valid) errors.push({ field: `peserta[${idx}].nisn`, message: `Peserta #${idx + 1}: ${rNisn.message}` });
        }

        if (p.tanggalLahir) {
          const rDate = isoDate(p.tanggalLahir, `Tanggal lahir siswa #${idx + 1}`);
          if (!rDate.valid) errors.push({ field: `peserta[${idx}].tanggalLahir`, message: rDate.message });
        }
      });
    }

    return { valid: errors.length === 0, errors };
  }

  /* ── 15. Validasi form Mutasi Masuk / Siswa Baru ── */
  function formSiswa(formData, templateId) {
    const errors = [];

    if (!formData) return { valid: false, errors: [{ field: 'form', message: 'Data form kosong.' }] };

    const { meta, siswa } = formData;

    // Meta
    const checkMeta = (field, label) => {
      const v = meta?.[field];
      const r = required(v, label);
      if (!r.valid) errors.push({ field: `meta.${field}`, message: r.message });
    };

    checkMeta('namaMadrasah', 'Nama Madrasah');
    checkMeta('status', 'Status');
    if (meta?.status && !['Swasta', 'Negeri'].includes(String(meta.status))) {
      errors.push({ field: 'meta.status', message: 'Status harus Swasta atau Negeri.' });
    }
    checkMeta('tahun', 'Tahun');

    if (templateId === 'siswa-baru') {
      checkMeta('kelas', 'Kelas');
      const allowedKelas = ['VII (Tujuh)', 'VIII (Delapan)', 'IX (Sembilan)'];
      if (meta?.kelas && !allowedKelas.includes(String(meta.kelas))) {
        errors.push({ field: 'meta.kelas', message: 'Kelas siswa baru tidak valid.' });
      }
    }

    // Siswa minimal 1
    if (!siswa || siswa.length === 0) {
      errors.push({ field: 'siswa', message: 'Minimal satu siswa harus ditambahkan.' });
    } else {
      siswa.forEach((s, idx) => {
        const rNama = required(s.namaSiswa, `Nama siswa #${idx + 1}`);
        if (!rNama.valid) errors.push({ field: `siswa[${idx}].namaSiswa`, message: rNama.message });

        const rJenisKelamin = required(s.jenisKelamin, `Jenis kelamin siswa #${idx + 1}`);
        if (!rJenisKelamin.valid || !['L', 'P'].includes(String(s.jenisKelamin))) {
          errors.push({ field: `siswa[${idx}].jenisKelamin`, message: rJenisKelamin.valid
            ? `Jenis kelamin siswa #${idx + 1} harus L atau P.`
            : rJenisKelamin.message });
        }

        if (s.nisn) {
          const rNisn = nisn(s.nisn);
          if (!rNisn.valid) errors.push({ field: `siswa[${idx}].nisn`, message: `Siswa #${idx + 1}: ${rNisn.message}` });
        }

        if (templateId === 'mutasi-masuk' && s.kelas && ![
          'I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'
        ].includes(String(s.kelas))) {
          errors.push({ field: `siswa[${idx}].kelas`, message: `Kelas tujuan siswa #${idx + 1} tidak valid.` });
        }

        if (s.tanggalLahir) {
          const rDate = isoDate(s.tanggalLahir, `Tanggal lahir siswa #${idx + 1}`);
          if (!rDate.valid) errors.push({ field: `siswa[${idx}].tanggalLahir`, message: rDate.message });
        }
      });
    }

    return { valid: errors.length === 0, errors };
  }

  /* ── Public API ── */
  return {
    // Validators
    required,
    fontSize,
    kopRowCount,
    imageFile,
    nisn,
    nik,
    isoDate,
    kopConfig,
    formDpu,
    formSiswa,

    // Constants
    FONT_SIZE_MIN,
    FONT_SIZE_MAX,
    KOP_ROWS_MIN,
    KOP_ROWS_MAX,
    MAX_LOGO_SIZE_BYTES,
    ALLOWED_IMAGE_TYPES,
  };

})();
