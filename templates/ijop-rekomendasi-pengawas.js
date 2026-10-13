/* =============================================================
   templates/ijop-rekomendasi-pengawas.js — Rekomendasi dari Pengawas Madrasah
   =============================================================
   Berdasarkan dokumen: "IJOP - SURAT REKOMENDASI PERPANJANGAN IZIN OPERASIONAL
   DARI PENGAWAS"
   Instansi: Kantor Kementerian Agama Kab. Musi Rawas
   Ukuran kertas: A4 Portrait
*/

const TemplateIjopRekomendasiPengawas = (() => {

  const TEMPLATE_ID = 'ijop-rekomendasi-pengawas';

  const meta = {
    id: TEMPLATE_ID,
    name: 'IJOP: Rekomendasi Pengawas',
    description: 'Rekomendasi perpanjangan izin operasional RA/Madrasah dari Pengawas Madrasah.',
    icon: '✅',
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
      pengawas: {
        nama: 'Muhamad Salim, S.Ag.,M.Pd.',
        nip: '197003072000031001',
        pangkatGolongan: 'Pembina / IV.a',
        jabatan: 'Pengawas Madrasah',
      },
      lembaga: {
        namaLembaga: 'MTs Nurul Falah',
        nsm: '121216050060',
        npsn: '69963460',
        alamatLembaga: 'Jl. Jambi Lama RT. 004 Kelurahan Terawas',
        namaKepala: '',
        namaYayasan: 'Yayasan Pendidikan Islam Terawas Darussalam',
      },
      penandatangan: {
        kasiPenmad: {
          nama: 'Dr. H. Taslim, S.Pd.,M.Si.',
          nip: '',
        },
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
      id: 'pengawas',
      title: 'Data Pengawas Madrasah',
      icon: '👤',
      fields: [
        {
          key: 'pengawas.nama',
          label: 'Nama Pengawas',
          type: 'text',
          placeholder: 'Nama lengkap dan gelar',
          required: true,
        },
        {
          key: 'pengawas.nip',
          label: 'NIP Pengawas',
          type: 'text',
          placeholder: 'Contoh: 197003072000031001',
          required: false,
        },
        {
          key: 'pengawas.pangkatGolongan',
          label: 'Pangkat/Golongan',
          type: 'text',
          placeholder: 'Contoh: Pembina / IV.a',
          required: false,
        },
        {
          key: 'pengawas.jabatan',
          label: 'Jabatan',
          type: 'text',
          placeholder: 'Contoh: Pengawas Madrasah',
          required: false,
        },
      ],
    },
    {
      id: 'lembaga',
      title: 'Data RA/Madrasah yang Direkomendasikan',
      icon: '🏫',
      fields: [
        {
          key: 'lembaga.namaLembaga',
          label: 'Nama Lembaga',
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
          key: 'lembaga.alamatLembaga',
          label: 'Alamat Lembaga',
          type: 'text',
          placeholder: 'Alamat lengkap',
          required: false,
        },
        {
          key: 'lembaga.namaKepala',
          label: 'Nama Kepala RA/Madrasah',
          type: 'text',
          placeholder: 'Nama lengkap dan gelar',
          required: false,
        },
        {
          key: 'lembaga.namaYayasan',
          label: 'Nama Yayasan Penyelenggara',
          type: 'text',
          placeholder: 'Contoh: Yayasan Pendidikan Islam Terawas Darussalam',
          required: false,
        },
      ],
    },
    {
      id: 'penandatangan',
      title: 'Penandatangan (Kasi Penmad)',
      icon: '✍️',
      fields: [
        {
          key: 'penandatangan.kasiPenmad.nama',
          label: 'Nama Kasi Penmad',
          type: 'text',
          placeholder: 'Contoh: Dr. H. Taslim, S.Pd.,M.Si.',
          required: false,
        },
        {
          key: 'penandatangan.kasiPenmad.nip',
          label: 'NIP Kasi Penmad',
          type: 'text',
          placeholder: 'NIP',
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
