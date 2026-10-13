/* =============================================================
   templates/ijop-permohonan.js — Surat Permohonan Perpanjangan Izin Operasional
   =============================================================
   Berdasarkan dokumen: "IJOP - SURAT PERMOHONAN PERPANJANGAN IZIN OPERASIONAL
   DARI LEMBAGA"
   Instansi: Madrasah, ditujukan ke Kankemenag Kab. Musi Rawas
   Ukuran kertas: A4 Portrait
*/

const TemplateIjopPermohonan = (() => {

  const TEMPLATE_ID = 'ijop-permohonan';

  const meta = {
    id: TEMPLATE_ID,
    name: 'IJOP: Surat Permohonan Lembaga',
    description: 'Surat permohonan perpanjangan izin operasional RA/Madrasah dari lembaga ke Kankemenag.',
    icon: '📝',
    orientation: 'portrait',
    paperSize: 'a4',
    category: 'ijop',
  };

  function createDefaultData() {
    return {
      surat: {
        nomor: '',
        namaKabupatenKota: 'Musi Rawas',
        tanggal: '',          // ISO: YYYY-MM-DD
      },
      lembaga: {
        namaRaMadrasah: 'MTs Nurul Falah',
        nsm: '121216050060',
        npsn: '69963460',
        alamat: 'Jl. Jambi Lama RT. 004 Kelurahan Terawas Kecamatan STL. Ulu Terawas',
        akteNotaris: '',
        pengesahanAkteNotaris: '',
        peringkatAkreditasi: 'C',
      },
      kepala: {
        namaKepala: '',
        jabatan: '',          // mis. "Kepala MTs Nurul Falah"
      },
    };
  }

  const formSections = [
    {
      id: 'surat',
      title: 'Identitas Surat',
      icon: '📋',
      fields: [
        {
          key: 'surat.nomor',
          label: 'Nomor Surat',
          type: 'text',
          placeholder: 'Contoh: 01/MTs-NF/X/2026',
          required: false,
        },
        {
          key: 'surat.namaKabupatenKota',
          label: 'Nama Kabupaten/Kota',
          type: 'text',
          placeholder: 'Contoh: Musi Rawas',
          required: true,
        },
        {
          key: 'surat.tanggal',
          label: 'Tanggal Surat',
          type: 'date',
          required: false,
        },
      ],
    },
    {
      id: 'lembaga',
      title: 'Data RA/Madrasah',
      icon: '🏫',
      fields: [
        {
          key: 'lembaga.namaRaMadrasah',
          label: 'Nama RA/Madrasah',
          type: 'text',
          placeholder: 'Contoh: MTs Nurul Falah',
          required: true,
        },
        {
          key: 'lembaga.nsm',
          label: 'NSM',
          type: 'text',
          placeholder: 'Contoh: 121216050060',
          required: false,
        },
        {
          key: 'lembaga.npsn',
          label: 'NPSN',
          type: 'text',
          placeholder: 'Contoh: 69963460',
          required: false,
        },
        {
          key: 'lembaga.alamat',
          label: 'Alamat',
          type: 'text',
          placeholder: 'Alamat lengkap madrasah',
          required: false,
        },
        {
          key: 'lembaga.akteNotaris',
          label: 'Akte Notaris',
          type: 'text',
          placeholder: 'Nomor dan nama notaris',
          required: false,
        },
        {
          key: 'lembaga.pengesahanAkteNotaris',
          label: 'Pengesahan Akte Notaris',
          type: 'text',
          placeholder: 'Contoh: AHU-XXXXX.AH.01.04.Tahun XXXX',
          required: false,
        },
        {
          key: 'lembaga.peringkatAkreditasi',
          label: 'Peringkat Akreditasi',
          type: 'select',
          options: ['A', 'B', 'C', 'Belum Terakreditasi'],
          required: false,
        },
      ],
    },
    {
      id: 'kepala',
      title: 'Kepala RA/Madrasah',
      icon: '✍️',
      fields: [
        {
          key: 'kepala.jabatan',
          label: 'Jabatan',
          type: 'text',
          placeholder: 'Contoh: Kepala MTs Nurul Falah',
          required: false,
        },
        {
          key: 'kepala.namaKepala',
          label: 'Nama Kepala',
          type: 'text',
          placeholder: 'Nama lengkap dan gelar',
          required: true,
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
