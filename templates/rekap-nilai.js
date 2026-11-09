/* =============================================================
   templates/rekap-nilai.js — Rekapitulasi Nilai Guru
   =============================================================
   Berdasarkan dokumen: "Format Rekap Nilai"
   Instansi: MTs Nurul Falah, Kab. Musi Rawas
   Ukuran kertas: A4 Landscape (banyak kolom nilai)

   Fitur:
   - Mode "Lengkap"  : tabel diisi penuh (nama murid + semua nilai)
   - Mode "Format"   : hanya kolom nama murid yang wajib diisi,
                       kolom nilai dikosongkan (siap cetak lalu isi manual)
*/

const TemplateRekapNilai = (() => {

  /* ── ID Template ── */
  const TEMPLATE_ID = 'rekap-nilai';

  /* ── Metadata Template ── */
  const meta = {
    id: TEMPLATE_ID,
    name: 'Rekapitulasi Nilai',
    description: 'Rekap nilai guru: formatif (per-BAB), sumatif lingkup materi, STS, SAS, dan praktik.',
    icon: '📝',
    orientation: 'landscape',
    paperSize: 'a4',
    category: 'nilai',
  };

  /* ── Factory: satu baris murid ── */
  function _createMurid(no = 1) {
    return {
      id: Utils.generateId('murid'),
      no,
      namaMurid: '',
      /* Formatif per-BAB (BAB 1–3 default, bisa ditambah) */
      bab1_tp1: '', bab1_tp2: '', bab1_tp3: '',
      bab2_tp1: '', bab2_tp2: '', bab2_tp3: '',
      bab3_tp1: '', bab3_tp2: '', bab3_tp3: '',
      /* Sumatif Lingkup Materi — satu nilai per LM (tidak ada sub-TP) */
      lm1: '', lm2: '', lm3: '', lm4: '',
      /* Sumatif Tengah Semester, Sumatif Akhir Semester, Praktik */
      sts: '',
      sas: '',
      praktik: '',
      /* Nilai Akhir (bisa diisi manual atau dihitung otomatis) */
      nilaiAkhir: '',
    };
  }

  /* ── Default form data ── */
  function createDefaultData() {
    return {
      header: {
        namaGuru:        '',
        semester:        'Ganjil',
        mataPelajaran:   '',
        tahunPelajaran:  '2025/2026',
        namaKelas:       '',
        /* Pilihan mode: 'lengkap' | 'format' */
        modePengisian:   'lengkap',
        /* Konfigurasi kolom dinamis */
        jumlahBab:       3,   // 1–5
        jumlahLm:        2,   // 1–4
        jumlahTpBab:     3,   // TP per BAB, 1–4
      },
      tandaTangan: {
        namaKabupaten:     'Musi Rawas',
        tanggalTerbit:     '',
        namaSekolahan:     'MTs Nurul Falah',
        namaKepalaSekolah: '',
        nipKepalaSekolah:  '',
        namaGuru:          '',
        nipGuru:           '',
      },
      murid: [
        _createMurid(1),
      ],
    };
  }

  /* ── Section form (editor kiri) ── */
  const formSections = [
    {
      id: 'header',
      title: 'Informasi Dokumen',
      icon: '📋',
      fields: [
        {
          key: 'header.modePengisian',
          label: 'Mode Pengisian',
          type: 'select',
          options: [
            { value: 'lengkap', label: '📊 Lengkap — isi nama murid & semua nilai' },
            { value: 'format',  label: '🖨️ Format saja — hanya isi nama murid (nilai dikosongkan)' },
          ],
          required: true,
          hint: 'Mode "Format saja" menghasilkan tabel kosong siap cetak. Kolom nama murid tetap wajib diisi.',
        },
        {
          key: 'header.namaGuru',
          label: 'Nama Guru',
          type: 'text',
          placeholder: 'Nama lengkap guru',
          required: true,
        },
        {
          key: 'header.mataPelajaran',
          label: 'Mata Pelajaran',
          type: 'text',
          placeholder: 'Contoh: Matematika',
          required: true,
        },
        {
          key: 'header.semester',
          label: 'Semester',
          type: 'select',
          options: ['Ganjil', 'Genap'],
          required: true,
        },
        {
          key: 'header.tahunPelajaran',
          label: 'Tahun Pelajaran',
          type: 'text',
          placeholder: 'Contoh: 2025/2026',
          required: true,
        },
        {
          key: 'header.namaKelas',
          label: 'Kelas',
          type: 'text',
          placeholder: 'Contoh: VII A',
          required: true,
        },
        {
          key: 'header.jumlahBab',
          label: 'Jumlah BAB',
          type: 'number',
          min: 1, max: 5,
          required: true,
          hint: 'Jumlah BAB (kolom Formatif)',
        },
        {
          key: 'header.jumlahTpBab',
          label: 'Jumlah TP per BAB',
          type: 'number',
          min: 1, max: 4,
          required: true,
          hint: 'Jumlah Tujuan Pembelajaran per BAB',
        },
        {
          key: 'header.jumlahLm',
          label: 'Jumlah LM (Sumatif)',
          type: 'number',
          min: 1, max: 4,
          required: true,
          hint: 'Jumlah Lingkup Materi sumatif — setiap LM adalah satu kolom nilai',
        },
      ],
    },
    {
      id: 'murid',
      title: 'Daftar Murid',
      icon: '👤',
      type: 'repeatable',
      itemLabel: 'Murid',
      itemFactory: _createMurid,
      fields: [
        {
          key: 'no',
          label: 'No.',
          type: 'number',
          min: 1,
          required: true,
        },
        {
          key: 'namaMurid',
          label: 'Nama Murid',
          type: 'text',
          placeholder: 'Nama lengkap murid',
          required: true,
        },
        /* Nilai-nilai berikut ditampilkan hanya saat mode = 'lengkap'.
           form-renderer.js mendukung showIf berbasis root-data via konteks,
           namun untuk kesederhanaan kita render selalu dan sembunyikan via CSS
           yang dikontrol class di form-container berdasar modePengisian.
           Alternatifnya: label "(otomatis dikosongkan di mode Format)" pada label. */
        {
          key: 'bab1_tp1',
          label: 'BAB 1 – TP1',
          type: 'number',
          min: 0, max: 100,
          required: false,
          hint: 'Nilai Formatif BAB 1, TP 1',
        },
        {
          key: 'bab1_tp2',
          label: 'BAB 1 – TP2',
          type: 'number',
          min: 0, max: 100,
          required: false,
        },
        {
          key: 'bab1_tp3',
          label: 'BAB 1 – TP3',
          type: 'number',
          min: 0, max: 100,
          required: false,
        },
        {
          key: 'bab2_tp1',
          label: 'BAB 2 – TP1',
          type: 'number',
          min: 0, max: 100,
          required: false,
        },
        {
          key: 'bab2_tp2',
          label: 'BAB 2 – TP2',
          type: 'number',
          min: 0, max: 100,
          required: false,
        },
        {
          key: 'bab2_tp3',
          label: 'BAB 2 – TP3',
          type: 'number',
          min: 0, max: 100,
          required: false,
        },
        {
          key: 'bab3_tp1',
          label: 'BAB 3 – TP1',
          type: 'number',
          min: 0, max: 100,
          required: false,
        },
        {
          key: 'bab3_tp2',
          label: 'BAB 3 – TP2',
          type: 'number',
          min: 0, max: 100,
          required: false,
        },
        {
          key: 'bab3_tp3',
          label: 'BAB 3 – TP3',
          type: 'number',
          min: 0, max: 100,
          required: false,
        },
        {
          key: 'lm1',
          label: 'LM1',
          type: 'number',
          min: 0, max: 100,
          required: false,
          hint: 'Sumatif Lingkup Materi 1',
        },
        {
          key: 'lm2',
          label: 'LM2',
          type: 'number',
          min: 0, max: 100,
          required: false,
          hint: 'Sumatif Lingkup Materi 2',
        },
        {
          key: 'lm3',
          label: 'LM3',
          type: 'number',
          min: 0, max: 100,
          required: false,
          hint: 'Sumatif Lingkup Materi 3',
        },
        {
          key: 'lm4',
          label: 'LM4',
          type: 'number',
          min: 0, max: 100,
          required: false,
          hint: 'Sumatif Lingkup Materi 4',
        },
        {
          key: 'sts',
          label: 'STS (Sumatif Tengah Semester)',
          type: 'number',
          min: 0, max: 100,
          required: false,
        },
        {
          key: 'sas',
          label: 'SAS (Sumatif Akhir Semester)',
          type: 'number',
          min: 0, max: 100,
          required: false,
        },
        {
          key: 'praktik',
          label: 'Praktik',
          type: 'number',
          min: 0, max: 100,
          required: false,
        },
        {
          key: 'nilaiAkhir',
          label: 'Nilai Akhir',
          type: 'number',
          min: 0, max: 100,
          required: false,
        },
      ],
    },
    {
      id: 'tandaTangan',
      title: 'Tanda Tangan',
      icon: '✍️',
      fields: [
        {
          key: 'tandaTangan.namaKabupaten',
          label: 'Nama Kabupaten/Kota',
          type: 'text',
          placeholder: 'Contoh: Musi Rawas',
          required: false,
        },
        {
          key: 'tandaTangan.tanggalTerbit',
          label: 'Tanggal Terbit',
          type: 'date',
          required: false,
        },
        {
          key: 'tandaTangan.namaSekolahan',
          label: 'Nama Sekolah',
          type: 'text',
          placeholder: 'Contoh: MTs Nurul Falah',
          required: false,
        },
        {
          key: 'tandaTangan.namaKepalaSekolah',
          label: 'Nama Kepala Sekolah',
          type: 'text',
          placeholder: 'Nama lengkap kepala sekolah',
          required: false,
        },
        {
          key: 'tandaTangan.nipKepalaSekolah',
          label: 'NIP Kepala Sekolah',
          type: 'text',
          placeholder: 'NIP kepala sekolah',
          required: false,
        },
        {
          key: 'tandaTangan.namaGuru',
          label: 'Nama Guru (TTD)',
          type: 'text',
          placeholder: 'Nama guru untuk blok tanda tangan',
          required: false,
          hint: 'Boleh sama dengan Nama Guru di atas.',
        },
        {
          key: 'tandaTangan.nipGuru',
          label: 'NIP Guru',
          type: 'text',
          placeholder: 'NIP guru',
          required: false,
        },
      ],
    },
  ];

  /* ── Definisi kolom tabel (untuk Pengaturan Tabel & TableConfigManager) ──
     Kolom bersifat "flat" — header multi-row dibangun dinamis di renderer.
     Key kolom ini dipakai sebagai identifier stabil di TableConfigManager.
     Kolom dinamis (BAB, LM) didefinisikan sampai batas maksimal (5 BAB × 4 TP,
     4 LM) sehingga pengguna dapat mengatur lebar/styling sebelum kolom tampil.
  */
  function _buildTableColumns() {
    const cols = [
      { key: 'no',        header: 'No.',        align: 'center', width: '8mm'  },
      { key: 'namaMurid', header: 'Nama Murid', align: 'left',   width: '28mm' },
    ];
    // Formatif: BAB 1–5, TP 1–4
    for (let b = 1; b <= 5; b++) {
      for (let tp = 1; tp <= 4; tp++) {
        cols.push({ key: `bab${b}_tp${tp}`, header: `BAB ${b} TP${tp}`, align: 'center', width: '6mm' });
      }
    }
    // Sumatif LM: 1–4
    for (let l = 1; l <= 4; l++) {
      cols.push({ key: `lm${l}`, header: `LM${l}`, align: 'center', width: '9mm' });
    }
    cols.push({ key: 'sts',        header: 'STS',        align: 'center', width: '10mm' });
    cols.push({ key: 'sas',        header: 'SAS',        align: 'center', width: '10mm' });
    cols.push({ key: 'praktik',    header: 'Praktik',    align: 'center', width: '10mm' });
    cols.push({ key: 'nilaiAkhir', header: 'Nilai Akhir',align: 'center', width: '10mm' });
    return cols;
  }

  const tableColumns = _buildTableColumns();

  /**
   * Satu-satunya sumber urutan kolom aktif untuk panel Pengaturan Tabel
   * dan preview. configIndex selalu merujuk posisi dalam 30 kolom kanonis,
   * sehingga preferensi lama tidak bergeser saat jumlah BAB/TP/LM berubah.
   *
   * @param {object} [formData]
   */
  function getTableLayout(formData = {}) {
    const hdr = formData?.header || {};
    const count = (value, fallback, max) =>
      Math.min(max, Math.max(1, parseInt(value, 10) || fallback));
    const jumlahBab = count(hdr.jumlahBab, 3, 5);
    const jumlahTpBab = count(hdr.jumlahTpBab, 3, 4);
    const jumlahLm = count(hdr.jumlahLm, 2, 4);

    const visibleKeys = new Set(['no', 'namaMurid', 'sts', 'sas', 'praktik', 'nilaiAkhir']);
    for (let b = 1; b <= jumlahBab; b++) {
      for (let tp = 1; tp <= jumlahTpBab; tp++) {
        visibleKeys.add(`bab${b}_tp${tp}`);
      }
    }
    for (let l = 1; l <= jumlahLm; l++) visibleKeys.add(`lm${l}`);

    const columns = tableColumns.flatMap((column, configIndex) =>
      visibleKeys.has(column.key) ? [{ ...column, configIndex }] : []
    );
    return { jumlahBab, jumlahTpBab, jumlahLm, columns };
  }

  /* ── Public API ── */
  return {
    TEMPLATE_ID,
    meta,
    createDefaultData,
    createItem: _createMurid,
    formSections,
    tableColumns,
    getTableLayout,
  };

})();
