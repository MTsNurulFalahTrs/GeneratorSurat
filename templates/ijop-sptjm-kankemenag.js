/* =============================================================
   templates/ijop-sptjm-kankemenag.js — SPTJM dari Kakankemenag
   =============================================================
   Berdasarkan dokumen: "IJOP - SPTJM DARI KAKANKEMENAG"
   Surat Pernyataan Tanggung Jawab Mutlak dari Kepala Kankemenag
   Instansi: Kantor Kementerian Agama Kab. Musi Rawas
   Ukuran kertas: A4 Portrait
*/

const TemplateIjopSptjmKankemenag = (() => {

  const TEMPLATE_ID = 'ijop-sptjm-kankemenag';

  const meta = {
    id: TEMPLATE_ID,
    name: 'IJOP: SPTJM dari Kakankemenag',
    description: 'Surat Pernyataan Tanggung Jawab Mutlak (SPTJM) dari Kepala Kantor Kemenag Kab. Musi Rawas (bermeterai Rp 10.000).',
    icon: '🖋️',
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
