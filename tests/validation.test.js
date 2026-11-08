import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../js/validation.js', import.meta.url), 'utf8');

function loadValidation() {
  const context = {
    console,
    Utils: {
      formatBytes: value => String(value),
    },
  };
  runInNewContext(`${source}\n;globalThis.Validation = Validation;`, context);
  return context.Validation;
}

describe('Validation.formTemplate', () => {
  it('accepts a complete nested form definition', () => {
    const Validation = loadValidation();
    const template = {
      formSections: [{
        id: 'surat',
        fields: [
          { key: 'surat.nomor', label: 'Nomor Surat', type: 'text', required: true },
          { key: 'surat.tanggal', label: 'Tanggal Surat', type: 'date', required: true },
          { key: 'surat.jenis', label: 'Jenis Surat', type: 'select', required: true, options: ['Permohonan', 'Pernyataan'] },
        ],
      }],
    };

    const result = Validation.formTemplate({
      surat: { nomor: '01/MTs-NF/XI/2026', tanggal: '2026-11-08', jenis: 'Permohonan' },
    }, template);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('reports missing required fields with their nested field path', () => {
    const Validation = loadValidation();
    const template = {
      formSections: [{
        id: 'lembaga',
        fields: [
          { key: 'lembaga.namaRaMadrasah', label: 'Nama RA/Madrasah', type: 'text', required: true },
        ],
      }],
    };

    const result = Validation.formTemplate({ lembaga: { namaRaMadrasah: '  ' } }, template);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      { field: 'lembaga.namaRaMadrasah', message: 'Nama RA/Madrasah wajib diisi.' },
    ]);
  });

  it('rejects an invalid date and an unsupported select value', () => {
    const Validation = loadValidation();
    const template = {
      formSections: [{
        id: 'surat',
        fields: [
          { key: 'surat.tanggal', label: 'Tanggal Surat', type: 'date' },
          { key: 'surat.jenis', label: 'Jenis Surat', type: 'select', options: ['Permohonan', 'Pernyataan'] },
        ],
      }],
    };

    const result = Validation.formTemplate({
      surat: { tanggal: '2026-02-31', jenis: 'Surat Lain' },
    }, template);

    expect(result.valid).toBe(false);
    expect(result.errors.map(error => error.field)).toEqual(['surat.tanggal', 'surat.jenis']);
  });

  it('validates repeatable sections and respects showIf conditions', () => {
    const Validation = loadValidation();
    const template = {
      formSections: [
        {
          id: 'kepala',
          fields: [
            { key: 'kepala.nama', label: 'Nama Kepala', type: 'text', required: true },
            { key: 'kepala.nik', label: 'NIK', type: 'text', required: true, showIf: data => data.tampilkanNik === true },
          ],
        },
        {
          id: 'lampiran',
          type: 'repeatable',
          itemLabel: 'Lampiran',
          fields: [
            { key: 'judul', label: 'Judul Lampiran', type: 'text', required: true },
          ],
        },
      ],
    };

    const result = Validation.formTemplate({
      tampilkanNik: false,
      kepala: { nama: 'Kepala Madrasah', nik: '' },
      lampiran: [{ judul: 'Fotokopi izin operasional' }, { judul: '' }],
    }, template);

    expect(result.valid).toBe(false);
    expect(result.errors.map(error => error.field)).toEqual(['lampiran[1].judul']);
  });
});
