/* =============================================================
   templates/ijop-rekomendasi-kankemenag.js — Rekomendasi dari Kakankemenag
   =============================================================
   Berdasarkan dokumen: "IJOP - SURAT REKOMENDASI PERPANJANGAN IZIN OPERASIONAL
   DARI KAKANKEMENAG"
   Instansi: Kantor Kementerian Agama Kab. Musi Rawas
   Ukuran kertas: A4 Portrait
*/

const TemplateIjopRekomendasiKankemenag = (() => {

  const TEMPLATE_ID = 'ijop-rekomendasi-kankemenag';

  const meta = {
    id: TEMPLATE_ID,
    name: 'IJOP: Rekomendasi Kakankemenag',
    description: 'Rekomendasi perpanjangan izin pendirian RA/Madrasah dari Kepala Kantor Kemenag Kab. Musi Rawas.',
    icon: '🏛️',
    orientation: 'portrait',
    paperSize: 'a4',
    category: 'ijop',
  };

  function createDefaultData() {
    return {
      surat: {
        nomor: '',
        tanggal: '',          // ISO: YYYY-MM-DD
      },
      kakankemenag: {
        nama: 'H. Syarip, S.Ag.,M.Pd.I',
        nip: '197001151997031005',
        pangkatGolongan: 'Pembina Tk.1 / IV.b',
        jabatan: 'Kepala',
      },
      lembaga: {
        namaRaMadrasah: 'MTs Nurul Falah',
        nsm: '121216050060',
        npsn: '69963460',
        alamatRaMadrasah: 'Jl. Jambi Lama RT. 004 Kelurahan Terawas',
        namaPenyelenggara: 'Yayasan Pendidikan Islam Terawas Darussalam',
        akteNotaris: '',
        pengesahanAkteNotaris: '',
        peringkatAkreditasi: 'C',
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
          placeholder: 'Contoh: B-     /KK.06.03.02/KP.00.4/10/2026',
          required: false,
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
      id: 'kakankemenag',
      title: 'Data Kakankemenag',
      icon: '👤',
      fields: [
        {
          key: 'kakankemenag.nama',
          label: 'Nama',
          type: 'text',
          placeholder: 'Contoh: H. Syarip, S.Ag.,M.Pd.I',
          required: true,
        },
        {
          key: 'kakankemenag.nip',
          label: 'NIP',
          type: 'text',
          placeholder: 'Contoh: 197001151997031005',
          required: false,
        },
        {
          key: 'kakankemenag.pangkatGolongan',
          label: 'Pangkat/Golongan',
          type: 'text',
          placeholder: 'Contoh: Pembina Tk.1 / IV.b',
          required: false,
        },
        {
          key: 'kakankemenag.jabatan',
          label: 'Jabatan',
          type: 'text',
          placeholder: 'Contoh: Kepala',
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
          key: 'lembaga.alamatRaMadrasah',
          label: 'Alamat RA/Madrasah',
          type: 'text',
          placeholder: 'Alamat lengkap',
          required: false,
        },
        {
          key: 'lembaga.namaPenyelenggara',
          label: 'Nama Penyelenggara',
          type: 'text',
          placeholder: 'Nama yayasan/penyelenggara',
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
  ];

  const tableColumns = [];

  return {
    TEMPLATE_ID,
    meta,
    createDefaultData,
    formSections,
    tableColumns,
  };

})();
