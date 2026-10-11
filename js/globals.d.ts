/* =============================================================
   globals.d.ts — Deklarasi global untuk semua IIFE module
   =============================================================
   Setiap file JS di proyek ini menggunakan pola IIFE dan di-load
   sebagai <script> klasik di index.html, sehingga variabelnya
   bersifat global di runtime. File ini memberitahu TypeScript
   tentang keberadaan variabel-variabel tersebut.
*/

declare var XLSX: any;
declare var About: any;
declare var App: any;
declare var DataIO: any;
declare var DataManager: any;
declare var DocumentViewer: any;
declare var ExcelImport: any;
declare var FormRenderer: any;
declare var KopEditor: any;
declare var PdfExport: any;
declare var Platform: any;
declare var PreviewRenderer: any;
declare var Print: any;
declare var Settings: any;
declare var State: any;
declare var Storage: {
  init(options?: { onExpired?: (record: unknown) => void }): { available: boolean; hasData: boolean; expired: boolean; record?: unknown };
  load(): Record<string, unknown> | null;
  save(data: unknown): { success: boolean; reason?: string; lastSavedAt?: number; expiresAt?: number };
  clear(): boolean;
  getMeta(): { lastSavedAt: number; expiresAt: number; version: string; remaining: unknown; expired: boolean } | null;
  isAvailable(): boolean;
  checkExpiry(): boolean;
  TTL_DURATION_MS: number;
};
declare var TableConfigManager: any;
declare var TableConfigUI: any;
declare var TableRenderer: any;
declare var TemplateRegistry: any;
declare var Theme: any;
declare var UI: any;
declare var Utils: any;
declare var Validation: any;
declare var Workflow: any;
