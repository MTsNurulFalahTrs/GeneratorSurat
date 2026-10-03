/* =============================================================
   templates/dpu.js — Definisi template Daftar Peserta Ujian (DPU)
   =============================================================
   Berdasarkan dokumen: "DPU (Daftar Peserta Ujian)"
   Instansi: MTs Nurul Falah, Kab. Musi Rawas
   Ukuran kertas: A4 Landscape (karena banyak kolom tabel)
*/

const TemplateDPU = (() => {

  /* ── ID Template ── */
  const TEMPLATE_ID = 'dpu';

  /* ── Metadata Template ── */
  const meta = {
    id: TEMPLATE_ID,
    name: 'Daftar Peserta Ujian (DPU)',
    description: 'Daftar peserta ujian madrasah dengan data registrasi, asal sekolah, dan status EMIS.',
    icon: '📋',
    orientation: 'landscape',   // A4 Landscape
    paperSize: 'a4',
    category: 'ujian',
  };

  /* ── Default form data ── */
  function createDefaultData() {
    return {
      meta: {
        namaMadrasah: 'MTs Nurul Falah',
        status: 'Swasta',
        nsmNpsn: '121216050060/69963460',
        statusAkreditasi: 'C',
        kodeSekolah: '0549',
        tahunPelajaran: '2026/2027',
      },
      peserta: [
        _createPeserta(),
      ],
      tandaTangan: {
        kota: 'Musi Rawas',
        tahun: '2026',
        pihak1: {
          label: 'Mengetahui,',
          subjudul: 'a.n. Kepala Kantor Wilayah Kemenag Prov. Sumsel',
          jabatan: 'Katim Kurikulum',
          nama: '',
          nip: '',
        },
        pihak2: {
          label: 'Mengetahui,',
          subjudul: 'a.n. Kepala Kantor Kemenag Kab. Musi Rawas',
          jabatan: 'Kasi Pendidikan Madrasah,',
          nama: '',
          nip: '',
        },
        pihak3: {
          label: '',
          subjudul: '',
          jabatan: 'Kepala MTs Nurul Falah,',
          nama: '',
          nip: '',
        },
      },
    };
  }

  /* ── Factory: buat satu baris peserta baru ── */
  function _createPeserta(urt = 1) {
    return {
      id: Utils.generateId('peserta'),
      urt: urt,
      indk: '',
      nisn: '',
      registrasi: '',
      nik: '',
      namaSiswa: '',
      jenisKelamin: 'L',       // 'L' | 'P'
      tempatLahir: '',
      tanggalLahir: '',        // ISO: YYYY-MM-DD
      namaOrangTua: '',
      asalSekolah: '',
      noIjazah: '',
      terdaftarEmis: true,     // true = sudah, false = belum
      alasanBelum: '',
    };
  }

  /* ── Field definitions untuk form renderer ── */
  const formSections = [
    {
      id: 'meta',
      title: 'Data Madrasah',
      icon: '🏫',
      fields: [
        {
          key: 'meta.namaMadrasah',
          label: 'Nama Madrasah',
          type: 'text',
          placeholder: 'Contoh: MTs Nurul Falah',
          required: true,
          maxLength: 100,
        },
        {
          key: 'meta.status',
          label: 'Status',
          type: 'select',
          options: ['Swasta', 'Negeri'],
          required: true,
        },
        {
          key: 'meta.nsmNpsn',
          label: 'NSM/NPSN',
          type: 'text',
          placeholder: 'Contoh: 121216050060/69963460',
          required: false,
        },
        {
          key: 'meta.statusAkreditasi',
          label: 'Status Akreditasi',
          type: 'select',
          options: ['A', 'B', 'C', 'Belum Terakreditasi'],
          required: false,
          inputAlign: 'left',
        },
        {
          key: 'meta.kodeSekolah',
          label: 'Kode Madrasah',
          type: 'text',
          placeholder: 'Contoh: 0549',
          required: false,
          inputAlign: 'left',
        },
        {
          key: 'meta.tahunPelajaran',
          label: 'Tahun Pelajaran',
          type: 'text',
          placeholder: 'Contoh: 2026/2027',
          required: true,
          inputAlign: 'left',
        },
      ],
    },
    {
      id: 'peserta',
      title: 'Daftar Peserta',
      icon: '👥',
      type: 'repeatable',
      itemLabel: 'Peserta',
      itemFactory: _createPeserta,
      fields: [
        {
          key: 'urt',
          label: 'No. URT',
          type: 'number',
          min: 1,
          required: true,
        },
        {
          key: 'indk',
          label: 'INDK',
          type: 'text',
          placeholder: 'Contoh: 0166',
          required: false,
        },
        {
          key: 'nisn',
          label: 'NISN',
          type: 'text',
          placeholder: '10 digit angka',
          required: false,
          maxLength: 10,
        },
        {
          key: 'registrasi',
          label: 'No. Registrasi',
          type: 'text',
          placeholder: 'Contoh: Ps/MTs/03/07/231.758/2024',
          required: false,
        },
        {
          key: 'nik',
          label: 'NIK',
          type: 'text',
          placeholder: '16 digit angka',
          required: false,
          maxLength: 16,
        },
        {
          key: 'namaSiswa',
          label: 'Nama Siswa',
          type: 'text',
          placeholder: 'Nama lengkap siswa',
          required: true,
        },
        {
          key: 'jenisKelamin',
          label: 'L/P',
          type: 'select',
          options: [
            { value: 'L', label: 'L (Laki-laki)' },
            { value: 'P', label: 'P (Perempuan)' },
          ],
          required: true,
        },
        {
          key: 'tempatLahir',
          label: 'Tempat Lahir',
          type: 'text',
          placeholder: 'Contoh: Terawas',
          required: false,
        },
        {
          key: 'tanggalLahir',
          label: 'Tanggal Lahir',
          type: 'date',
          required: false,
        },
        {
          key: 'namaOrangTua',
          label: 'Nama Orang Tua',
          type: 'text',
          placeholder: 'Nama orang tua/wali',
          required: false,
        },
        {
          key: 'asalSekolah',
          label: 'Asal Sekolah',
          type: 'text',
          placeholder: 'Contoh: MI Nurul Falah',
          required: false,
        },
        {
          key: 'noIjazah',
          label: 'No. Ijazah',
          type: 'text',
          placeholder: 'Contoh: MI-23 060002169',
          required: false,
        },
        {
          key: 'terdaftarEmis',
          label: 'Terdaftar di EMIS',
          type: 'checkbox',
          labelTrue: 'Sudah',
          labelFalse: 'Belum',
          required: false,
        },
        {
          key: 'alasanBelum',
          label: 'Alasan Jika Belum',
          type: 'text',
          placeholder: 'Isi jika belum terdaftar',
          required: false,
          showIf: (item) => item.terdaftarEmis === false,
        },
      ],
    },
    {
      id: 'tandaTangan',
      title: 'Tanda Tangan',
      icon: '✍️',
      fields: [
        {
          key: 'tandaTangan.kota',
          label: 'Kota',
          type: 'text',
          placeholder: 'Contoh: Musi Rawas',
          required: false,
        },
        {
          key: 'tandaTangan.tahun',
          label: 'Tahun',
          type: 'text',
          placeholder: 'Contoh: 2026',
          required: false,
        },
        // Pihak 1
        {
          key: 'tandaTangan.pihak1.jabatan',
          label: 'Jabatan Pihak 1',
          type: 'text',
          placeholder: 'Contoh: Katim Kurikulum',
          required: false,
        },
        {
          key: 'tandaTangan.pihak1.nama',
          label: 'Nama Pihak 1',
          type: 'text',
          placeholder: 'Nama lengkap',
          required: false,
        },
        {
          key: 'tandaTangan.pihak1.nip',
          label: 'NIP Pihak 1',
          type: 'text',
          placeholder: 'NIP atau tanda hubung jika tidak ada',
          required: false,
        },
        // Pihak 2
        {
          key: 'tandaTangan.pihak2.jabatan',
          label: 'Jabatan Pihak 2',
          type: 'text',
          placeholder: 'Contoh: Kasi Pendidikan Madrasah',
          required: false,
        },
        {
          key: 'tandaTangan.pihak2.nama',
          label: 'Nama Pihak 2',
          type: 'text',
          placeholder: 'Nama lengkap',
          required: false,
        },
        {
          key: 'tandaTangan.pihak2.nip',
          label: 'NIP Pihak 2',
          type: 'text',
          placeholder: 'NIP',
          required: false,
        },
        // Pihak 3
        {
          key: 'tandaTangan.pihak3.jabatan',
          label: 'Jabatan Pihak 3',
          type: 'text',
          placeholder: 'Contoh: Kepala MTs Nurul Falah',
          required: false,
        },
        {
          key: 'tandaTangan.pihak3.nama',
          label: 'Nama Pihak 3',
          type: 'text',
          placeholder: 'Nama lengkap',
          required: false,
        },
        {
          key: 'tandaTangan.pihak3.nip',
          label: 'NIP Pihak 3',
          type: 'text',
          placeholder: 'NIP atau - jika tidak ada',
          required: false,
        },
      ],
    },
  ];

  /* ── Kolom tabel untuk preview/print ── */
  const tableColumns = [
    { key: 'urt',           header: 'URT',          width: '5mm',  align: 'center' },
    { key: 'indk',          header: 'INDK',         width: '9mm',  align: 'center' },
    { key: 'nisn',          header: 'NISN',         width: '18mm', align: 'center' },
    { key: 'registrasi',    header: 'REGISTRASI',   width: '30mm', align: 'left'   },
    { key: 'nik',           header: 'NIK',          width: '28mm', align: 'center' },
    { key: 'namaSiswa',     header: 'NAMA SISWA',   width: '32mm', align: 'left'   },
    { key: 'jenisKelamin',  header: 'L/P',          width: '6mm',  align: 'center' },
    { key: 'tempatLahir',   header: 'TEMPAT LAHIR', width: '18mm', align: 'left'   },
    { key: 'tanggalLahir',  header: 'TGL LAHIR',    width: '16mm', align: 'center' },
    { key: 'namaOrangTua',  header: 'NAMA ORANG TUA', width: '18mm', align: 'left' },
    { key: 'asalSekolah',   header: 'ASAL SEKOLAH', width: '22mm', align: 'left'   },
    { key: 'noIjazah',      header: 'No. IJAZAH',   width: '22mm', align: 'left'   },
    { key: '_emisSudah',    header: 'SUDAH',         width: '8mm',  align: 'center' },
    { key: '_emisBelum',    header: 'BELUM',         width: '8mm',  align: 'center' },
    { key: 'alasanBelum',  header: 'ALASAN',        width: '20mm', align: 'left'   },
  ];

  /* ── Public API ── */
  return {
    TEMPLATE_ID,
    meta,
    createDefaultData,
    createItem: _createPeserta,
    formSections,
    tableColumns,
  };

})();
