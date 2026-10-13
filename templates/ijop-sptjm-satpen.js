/* =============================================================
   templates/ijop-sptjm-satpen.js — SPTJM dari Kepala Satuan Pendidikan
   =============================================================
   Berdasarkan dokumen: "IJOP - SPTJM DARI KEPALA SATPEN"
   Surat Pernyataan Tanggung Jawab Mutlak dari Kepala Madrasah
   Ukuran kertas: A4 Portrait
*/

const TemplateIjopSptjmSatpen = (() => {

  const TEMPLATE_ID = 'ijop-sptjm-satpen';

  const meta = {
    id: TEMPLATE_ID,
    name: 'IJOP: SPTJM dari Kepala Satpen',
    description: 'Surat Pernyataan Tanggung Jawab Mutlak (SPTJM) dari Kepala Satuan Pendidikan (bermeterai Rp 10.000).',
    icon: '🖊️',
    orientation: 'portrait',
    paperSize: 'a4',
    category: 'ijop',
  };

  function createDefaultData() {
    return {
      surat: {
        nomor: '',
        namaDesa: 'Terawas',
        tanggal: '',          // ISO: YYYY-MM-DD
      },
      kepala: {
        nama: '',
        jabatan: '',          // mis. "Kepala MTs Nurul Falah"
        tempatTanggalLahir: '',
        pekerjaan: '',
        nik: '',
        alamatDomisili: '',
        telepon: '',
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
          placeholder: 'Contoh: 02/MTs-NF/X/2026',
          required: false,
        },
        {
          key: 'surat.namaDesa',
          label: 'Nama Desa/Kota',
          type: 'text',
          placeholder: 'Contoh: Terawas',
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
      id: 'kepala',
      title: 'Data Kepala Satuan Pendidikan',
      icon: '👤',
      fields: [
        {
          key: 'kepala.nama',
          label: 'Nama',
          type: 'text',
          placeholder: 'Nama lengkap dan gelar',
          required: true,
        },
        {
          key: 'kepala.jabatan',
          label: 'Jabatan',
          type: 'text',
          placeholder: 'Contoh: Kepala MTs Nurul Falah',
          required: false,
        },
        {
          key: 'kepala.tempatTanggalLahir',
          label: 'Tempat dan Tanggal Lahir',
          type: 'text',
          placeholder: 'Contoh: Terawas, 1 Januari 1980',
          required: false,
        },
        {
          key: 'kepala.pekerjaan',
          label: 'Pekerjaan',
          type: 'text',
          placeholder: 'Contoh: Guru / PNS',
          required: false,
        },
        {
          key: 'kepala.nik',
          label: 'NIK',
          type: 'text',
          placeholder: '16 digit angka',
          required: false,
          maxLength: 16,
        },
        {
          key: 'kepala.alamatDomisili',
          label: 'Alamat Domisili',
          type: 'text',
          placeholder: 'Alamat lengkap',
          required: false,
        },
        {
          key: 'kepala.telepon',
          label: 'Telepon',
          type: 'text',
          placeholder: 'Contoh: 0831-xxxx-xxxx',
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
