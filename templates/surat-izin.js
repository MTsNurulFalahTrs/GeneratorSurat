/* =============================================================
   templates/surat-izin.js — Surat Permohonan Izin Tidak Masuk Sekolah
   =============================================================
   Berdasarkan dokumen: "Format Surat Izin"
   Pengirim : Orang Tua/Wali Murid
   Tujuan   : Guru di sekolah/madrasah
   Ukuran kertas: A4 Portrait
*/

const TemplateSuratIzin = (() => {

  /* ── ID Template ── */
  const TEMPLATE_ID = 'surat-izin';

  /* ── Metadata ── */
  const meta = {
    id: TEMPLATE_ID,
    name: 'Surat Izin Tidak Masuk',
    description: 'Surat permohonan izin tidak masuk sekolah dari orang tua/wali murid.',
    icon: '✉️',
    orientation: 'portrait',
    paperSize: 'a4',
    category: 'izin',
  };

  /* ── Default form data ── */
  function createDefaultData() {
    return {
      sekolah: {
        namaSekolahan: 'MTs Nurul Falah',
      },
      murid: {
        namaOrangTuaWali: '',
        namaMurid: '',
        kelasMurid: '',
      },
      izin: {
        hariTanggalIzin: '',   // teks bebas, mis. "Senin, 10 November 2026"
        durasiIzin: '',        // teks bebas, mis. "1 (satu) hari"
        alasanIzin: '',
      },
      pengirim: {
        namaLokasi:       'Terawas',
        tanggalKeluarSurat: '',  // ISO: YYYY-MM-DD
      },
    };
  }

  /* ── Form sections ── */
  const formSections = [
    {
      id: 'sekolah',
      title: 'Data Sekolah',
      icon: '🏫',
      fields: [
        {
          key: 'sekolah.namaSekolahan',
          label: 'Nama Sekolah/Madrasah',
          type: 'text',
          placeholder: 'Contoh: MTs Nurul Falah',
          required: true,
        },
      ],
    },
    {
      id: 'murid',
      title: 'Data Murid',
      icon: '👤',
      fields: [
        {
          key: 'murid.namaOrangTuaWali',
          label: 'Nama Orang Tua/Wali',
          type: 'text',
          placeholder: 'Nama lengkap orang tua atau wali',
          required: true,
        },
        {
          key: 'murid.namaMurid',
          label: 'Nama Murid',
          type: 'text',
          placeholder: 'Nama lengkap murid',
          required: true,
        },
        {
          key: 'murid.kelasMurid',
          label: 'Kelas',
          type: 'text',
          placeholder: 'Contoh: VII A',
          required: true,
        },
      ],
    },
    {
      id: 'izin',
      title: 'Keterangan Izin',
      icon: '📅',
      fields: [
        {
          key: 'izin.hariTanggalIzin',
          label: 'Hari, Tanggal Izin',
          type: 'text',
          placeholder: 'Contoh: Senin, 10 November 2026',
          required: true,
          hint: 'Isi dengan hari dan tanggal lengkap.',
        },
        {
          key: 'izin.durasiIzin',
          label: 'Lama Izin',
          type: 'text',
          placeholder: 'Contoh: 1 (satu) hari',
          required: true,
        },
        {
          key: 'izin.alasanIzin',
          label: 'Alasan Izin',
          type: 'text',
          placeholder: 'Contoh: Sakit / Keperluan keluarga',
          required: true,
        },
      ],
    },
    {
      id: 'pengirim',
      title: 'Tanda Tangan',
      icon: '✍️',
      fields: [
        {
          key: 'pengirim.namaLokasi',
          label: 'Nama Kota/Lokasi',
          type: 'text',
          placeholder: 'Contoh: Terawas',
          required: false,
        },
        {
          key: 'pengirim.tanggalKeluarSurat',
          label: 'Tanggal Surat',
          type: 'date',
          required: false,
        },
      ],
    },
  ];

  /* ── Tidak ada tabel ── */
  const tableColumns = [];

  return {
    TEMPLATE_ID,
    meta,
    createDefaultData,
    formSections,
    tableColumns,
  };

})();
