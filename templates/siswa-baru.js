/* =============================================================
   templates/siswa-baru.js — Daftar Pengesahan Siswa Baru
   =============================================================
   Berdasarkan dokumen: "Surat Registrasi Siswa Baru"
   Judul: DAFTAR PENGESAHAN SISWA BARU TAHUN [TAHUN]
   Perbedaan dengan Mutasi Masuk:
   - Tidak ada kolom "Kelas" per-baris (kelas tercantum di header madrasah)
   - Umumnya untuk kelas VII (Tujuh) / siswa baru
   Ukuran kertas: A4 Landscape
*/

const TemplateSiswaBaru = (() => {

  const TEMPLATE_ID = 'siswa-baru';

  const meta = {
    id: TEMPLATE_ID,
    name: 'Daftar Pengesahan Siswa Baru',
    description: 'Daftar pengesahan siswa baru tahun ajaran, umumnya untuk kelas VII. Kelas tercantum di header.',
    icon: '🎓',
    orientation: 'landscape',
    paperSize: 'a4',
    category: 'registrasi',
  };

  function createDefaultData() {
    return {
      meta: {
        namaMadrasah: 'MADRASAH TSANAWIYAH NURUL FALAH',
        nsm: '121216050060',
        npsn: '69963460',
        status: 'Swasta',
        kelas: 'VII (Tujuh)',
        terakreditasi: 'C',
        tahun: '2026',
        tahunAjaran: '2026 - 2027',
      },
      siswa: [
        _createSiswa(),
      ],
      tandaTangan: {
        kotaMadrasah: 'Musi Rawas',
        tahun: '2026',
        kasiPenmad: {
          label: 'Mengetahui',
          jabatan: 'Kasi Penmad / Pendis',
          nama: '',
          nip: '',
        },
        pengawas: {
          label: 'Mengetahui',
          jabatan: 'Pengawas',
          nama: '',
          nip: '',
        },
        indukKkm: {
          label: 'Mengetahui,',
          jabatan: 'Induk KKM',
          nama: '',
          nip: '',
        },
        kepalaMadrasah: {
          label: '',
          jabatan: 'Kepala Madrasah',
          nama: '',
          nip: '',
        },
        // Pengesahan Palembang
        kotaPalembang: 'Palembang',
        katimKesiswaan: {
          label: 'Mengesahkan,',
          jabatan: 'Katim Kesiswaan,',
          nama: '',
          nip: '',
        },
        kepBidMapenda: {
          label: 'Mengesahkan',
          jabatan: 'Kepala Bidang Mapenda',
          subJabatan: 'Kasi MTs/MA',
          nama: '',
          nip: '',
        },
      },
      catatan: {
        tampilkan: true,
        items: [
          'Bid Mapenda (seksi MTs/MA) : 1 set',
          'Arsip sekolah : 1 set',
          'Sekolah Induk : 1 set',
          'Kandepag : 1 set',
        ],
      },
    };
  }

  function _createSiswa(no = 1) {
    return {
      id: Utils.generateId('siswa'),
      nis: '',
      nisn: '',
      namaSiswa: '',
      jenisKelamin: 'L',
      tempatLahir: '',
      tanggalLahir: '',       // ISO: YYYY-MM-DD
      namaOrangTua: '',
      sekolahAsal: '',
      // Tidak ada kolom kelas per-baris (kelas ada di header)
      noIjazah: '',
      kkrps: '',
      noPengesahan: '',
    };
  }

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
          placeholder: 'Contoh: MADRASAH TSANAWIYAH NURUL FALAH',
          required: true,
        },
        {
          key: 'meta.nsm',
          label: 'NSM',
          type: 'text',
          placeholder: 'Contoh: 121216050060',
          required: false,
        },
        {
          key: 'meta.npsn',
          label: 'NPSN',
          type: 'text',
          placeholder: 'Contoh: 69963460',
          required: false,
        },
        {
          key: 'meta.status',
          label: 'Status',
          type: 'select',
          options: ['Swasta', 'Negeri'],
          required: true,
        },
        {
          key: 'meta.kelas',
          label: 'Kelas',
          type: 'select',
          options: [
            { value: 'VII (Tujuh)', label: 'VII (Tujuh)' },
            { value: 'VIII (Delapan)', label: 'VIII (Delapan)' },
            { value: 'IX (Sembilan)', label: 'IX (Sembilan)' },
          ],
          required: true,
        },
        {
          key: 'meta.terakreditasi',
          label: 'Terakreditasi',
          type: 'select',
          options: ['A', 'B', 'C', 'Belum Terakreditasi'],
          required: false,
        },
        {
          key: 'meta.tahun',
          label: 'Tahun',
          type: 'text',
          placeholder: 'Contoh: 2026',
          required: true,
        },
        {
          key: 'meta.tahunAjaran',
          label: 'Tahun Ajaran',
          type: 'text',
          placeholder: 'Contoh: 2026 - 2027',
          required: false,
        },
      ],
    },
    {
      id: 'siswa',
      title: 'Daftar Siswa Baru',
      icon: '👥',
      type: 'repeatable',
      itemLabel: 'Siswa',
      itemFactory: _createSiswa,
      fields: [
        {
          key: 'nis',
          label: 'NIS',
          type: 'text',
          placeholder: 'Contoh: 0168',
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
          key: 'namaSiswa',
          label: 'Nama Siswa',
          type: 'text',
          placeholder: 'Nama lengkap',
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
          placeholder: 'Contoh: Musi Rawas',
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
          key: 'sekolahAsal',
          label: 'Sekolah Asal',
          type: 'text',
          placeholder: 'Contoh: MI Nurul Falah',
          required: false,
        },
        {
          key: 'noIjazah',
          label: 'No. Ijazah',
          type: 'text',
          placeholder: 'Nomor ijazah asal',
          required: false,
        },
        {
          key: 'kkrps',
          label: 'K.K.R.P.S',
          type: 'text',
          placeholder: 'Nomor K.K.R.P.S',
          required: false,
        },
        {
          key: 'noPengesahan',
          label: 'No. Pengesahan/Registrasi',
          type: 'text',
          placeholder: 'Nomor pengesahan',
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
          key: 'tandaTangan.kotaMadrasah',
          label: 'Kota (Madrasah)',
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
        {
          key: 'tandaTangan.kasiPenmad.jabatan',
          label: 'Jabatan Kasi Penmad',
          type: 'text',
          placeholder: 'Contoh: Kasi Penmad / Pendis',
          required: false,
        },
        {
          key: 'tandaTangan.kasiPenmad.nama',
          label: 'Nama Kasi Penmad',
          type: 'text',
          placeholder: 'Nama lengkap dan gelar',
          required: false,
        },
        {
          key: 'tandaTangan.kasiPenmad.nip',
          label: 'NIP Kasi Penmad',
          type: 'text',
          placeholder: 'NIP',
          required: false,
        },
        {
          key: 'tandaTangan.pengawas.nama',
          label: 'Nama Pengawas',
          type: 'text',
          placeholder: 'Nama lengkap dan gelar',
          required: false,
        },
        {
          key: 'tandaTangan.pengawas.nip',
          label: 'NIP Pengawas',
          type: 'text',
          placeholder: 'NIP',
          required: false,
        },
        {
          key: 'tandaTangan.indukKkm.nama',
          label: 'Nama Induk KKM',
          type: 'text',
          placeholder: 'Nama lengkap dan gelar',
          required: false,
        },
        {
          key: 'tandaTangan.indukKkm.nip',
          label: 'NIP Induk KKM',
          type: 'text',
          placeholder: 'NIP',
          required: false,
        },
        {
          key: 'tandaTangan.kepalaMadrasah.jabatan',
          label: 'Jabatan Kepala Madrasah',
          type: 'text',
          placeholder: 'Contoh: Kepala Madrasah',
          required: false,
        },
        {
          key: 'tandaTangan.kepalaMadrasah.nama',
          label: 'Nama Kepala Madrasah',
          type: 'text',
          placeholder: 'Nama lengkap dan gelar',
          required: false,
        },
        {
          key: 'tandaTangan.kepalaMadrasah.nip',
          label: 'NIP Kepala Madrasah',
          type: 'text',
          placeholder: 'NIP atau - jika tidak ada',
          required: false,
        },
        {
          key: 'tandaTangan.kepBidMapenda.nama',
          label: 'Nama Kepala Bid. Mapenda',
          type: 'text',
          placeholder: 'Nama lengkap dan gelar',
          required: false,
        },
        {
          key: 'tandaTangan.kepBidMapenda.nip',
          label: 'NIP Kepala Bid. Mapenda',
          type: 'text',
          placeholder: 'NIP',
          required: false,
        },
      ],
    },
  ];

  /* ── Kolom tabel (tanpa kolom Kelas) ── */
  const tableColumns = [
    { key: 'no',            header: 'No',                        width: '6mm',  align: 'center' },
    { key: 'nis',           header: 'NIS',                       width: '10mm', align: 'center' },
    { key: 'nisn',          header: 'NISN',                      width: '18mm', align: 'center' },
    { key: 'namaSiswa',     header: 'Nama Siswa',                width: '35mm', align: 'left'   },
    { key: 'jenisKelamin',  header: 'L/P',                       width: '6mm',  align: 'center' },
    { key: 'tempatLahir',   header: 'Tempat Lahir',              width: '18mm', align: 'left'   },
    { key: 'tanggalLahir',  header: 'Tanggal Lahir',             width: '16mm', align: 'center' },
    { key: 'namaOrangTua',  header: 'Nama Orang Tua',            width: '22mm', align: 'left'   },
    { key: 'sekolahAsal',   header: 'Sekolah Asal',              width: '28mm', align: 'left'   },
    { key: 'noIjazah',      header: 'NO IJAZAH',                 width: '20mm', align: 'left'   },
    { key: 'kkrps',         header: 'K.K.R.P.S',                 width: '16mm', align: 'center' },
    { key: 'noPengesahan',  header: 'No. Pengesahan/Registrasi', width: '22mm', align: 'left'   },
  ];

  return {
    TEMPLATE_ID,
    meta,
    createDefaultData,
    createItem: _createSiswa,
    formSections,
    tableColumns,
  };

})();
