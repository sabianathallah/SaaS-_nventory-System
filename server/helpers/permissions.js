'use strict';

const ALL_PERMISSIONS = [
  // ── Dashboard ────────────────────────────────────────────────────────────────
  { key: 'dashboard.manage',          label: 'Akses Penuh Dashboard',                      group: 'Dashboard',               isParent: true },
  { key: 'dashboard.view_stock',      label: 'Lihat Data Stok',                            group: 'Dashboard',               parent: 'dashboard.manage' },
  { key: 'dashboard.view_value',      label: 'Lihat Nilai Inventaris',                     group: 'Dashboard',               parent: 'dashboard.manage' },
  { key: 'dashboard.view_analytics',  label: 'Lihat Grafik & Breakdown',                   group: 'Dashboard',               parent: 'dashboard.manage' },
  { key: 'dashboard.view_movements',  label: 'Lihat Pergerakan Terbaru',                   group: 'Dashboard',               parent: 'dashboard.manage' },

  // ── Inventory ────────────────────────────────────────────────────────────────
  { key: 'inventory.manage',          label: 'Akses Penuh Inventory',                      group: 'Inventory',               isParent: true },
  { key: 'inventory.view',            label: 'Lihat Produk & Katalog',                     group: 'Inventory',               parent: 'inventory.manage' },

  // ── Stok ─────────────────────────────────────────────────────────────────────
  { key: 'stock.manage',              label: 'Akses Penuh Stok',                           group: 'Stok',                    isParent: true },
  { key: 'stock.view',                label: 'Lihat Stok & Pergerakan Stok',               group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.in.scan',             label: 'Stock In: Input via Scan Barcode',           group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.in.manual_input',     label: 'Stock In: Input Manual (tanpa barcode)',     group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.in.delete_item',      label: 'Stock In: Hapus Item yang Sudah Tersimpan',  group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.out.scan',            label: 'Stock Out: Input via Scan Barcode',          group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.out.manual_input',    label: 'Stock Out: Input Manual (tanpa barcode)',    group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.out.delete_item',     label: 'Stock Out: Hapus Item yang Sudah Tersimpan', group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.opname.scan',         label: 'Stock Opname: Hitung via Scan Barcode',      group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.opname.manual_input', label: 'Stock Opname: Input Manual (tanpa barcode)', group: 'Stok',                    parent: 'stock.manage' },

  // ── Handover ─────────────────────────────────────────────────────────────────
  { key: 'handover.manage',           label: 'Akses Penuh Handover Pengiriman',            group: 'Handover',                isParent: true },
  { key: 'handover.view',             label: 'Lihat Dokumen Handover',                     group: 'Handover',                parent: 'handover.manage' },
  { key: 'handover.create',           label: 'Buat & Kelola Handover (scan resi)',         group: 'Handover',                parent: 'handover.manage' },

  // ── Penerimaan & Packing ─────────────────────────────────────────────────────
  { key: 'packing.manage',            label: 'Akses Penuh Penerimaan & Packing',           group: 'Penerimaan & Packing',    isParent: true },
  { key: 'packing.view',              label: 'Lihat Modul Penerimaan & Packing',           group: 'Penerimaan & Packing',    parent: 'packing.manage' },
  { key: 'packing.incoming',          label: 'Kelola Barang Masuk & Surat Jalan',          group: 'Penerimaan & Packing',    parent: 'packing.manage' },
  { key: 'packing.jobs',              label: 'Buat & Kelola Packing Job',                  group: 'Penerimaan & Packing',    parent: 'packing.manage' },
  { key: 'packing.verify',            label: 'Verifikasi Packing & Buat FAP',              group: 'Penerimaan & Packing',    parent: 'packing.manage' },

  // ── Laporan ──────────────────────────────────────────────────────────────────
  { key: 'reports.manage',            label: 'Akses Penuh Laporan',                        group: 'Laporan',                 isParent: true },
  { key: 'reports.dashboard',         label: 'Lihat Dashboard & Laporan',                  group: 'Laporan',                 parent: 'reports.manage' },

  // ── Administrasi ─────────────────────────────────────────────────────────────
  { key: 'admin.manage',              label: 'Akses Penuh Administrasi',                   group: 'Administrasi',            isParent: true },
  { key: 'admin.users',               label: 'Kelola Users (CRUD)',                        group: 'Administrasi',            parent: 'admin.manage' },
];

const ALL_KEYS = ALL_PERMISSIONS.map(p => p.key);

const DEFAULT_PERMISSIONS = {
  SUPER_ADMIN:   ALL_KEYS,
  ADMIN:         ALL_KEYS,
  COMPANY_ADMIN: ALL_KEYS,

  OPERASIONAL: [
    'dashboard.manage',
    'inventory.manage',
    'stock.manage',
    'stock.in.scan', 'stock.in.manual_input',
    'stock.out.scan', 'stock.out.manual_input',
    'stock.opname.scan',
    'handover.manage',
    'packing.manage',
    'reports.manage',
  ],

  HEAD_PACKING: [
    'dashboard.manage',
    'packing.manage',
    'reports.manage',
  ],

  TIM_PACKING: ['packing.view', 'packing.jobs'],

  HR: ['admin.manage', 'reports.manage'],

  CEO: [
    'dashboard.manage',
    'inventory.view',
    'stock.view',
    'handover.view',
    'packing.view',
    'reports.manage',
  ],

  STAFF: ['inventory.view'],
};

const EDITABLE_ROLES = ['COMPANY_ADMIN', 'OPERASIONAL', 'TIM_PACKING', 'STAFF'];
const SYSTEM_ROLES   = ['SUPER_ADMIN', 'ADMIN'];

module.exports = { ALL_PERMISSIONS, DEFAULT_PERMISSIONS, EDITABLE_ROLES, SYSTEM_ROLES };
