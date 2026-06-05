'use strict';

const ALL_PERMISSIONS = [
  // ── Dasbor ───────────────────────────────────────────────────────────────────
  { key: 'dashboard.manage',          label: 'Akses Penuh Dasbor',                         group: 'Dasbor',                  isParent: true },
  { key: 'dashboard.view_stock',      label: 'Lihat Data Stok',                            group: 'Dasbor',                  parent: 'dashboard.manage' },
  { key: 'dashboard.view_value',      label: 'Lihat Nilai Inventaris di Dasbor',           group: 'Dasbor',                  parent: 'dashboard.manage' },
  { key: 'dashboard.view_analytics',  label: 'Lihat Grafik & Breakdown',                   group: 'Dasbor',                  parent: 'dashboard.manage' },
  { key: 'dashboard.view_movements',  label: 'Lihat Pergerakan Terbaru',                   group: 'Dasbor',                  parent: 'dashboard.manage' },

  // ── Produk & Katalog ─────────────────────────────────────────────────────────
  { key: 'inventory.manage',          label: 'Akses Penuh Produk & Katalog',               group: 'Produk & Katalog',        isParent: true },
  { key: 'inventory.view',            label: 'Lihat Produk & Katalog',                     group: 'Produk & Katalog',        parent: 'inventory.manage' },
  { key: 'inventory.view_value',      label: 'Lihat Harga & Nilai Stok (seluruh sistem)',  group: 'Produk & Katalog',        parent: 'inventory.manage' },
  { key: 'inventory.product.create',  label: 'Tambah Produk Baru',                         group: 'Produk & Katalog',        parent: 'inventory.manage' },
  { key: 'inventory.product.edit',    label: 'Edit Produk, Variant & SKU',                 group: 'Produk & Katalog',        parent: 'inventory.manage' },
  { key: 'inventory.product.delete',  label: 'Hapus Produk',                               group: 'Produk & Katalog',        parent: 'inventory.manage' },

  // ── Stok ─────────────────────────────────────────────────────────────────────
  { key: 'stock.manage',              label: 'Akses Penuh Stok',                           group: 'Stok',                    isParent: true },
  { key: 'stock.view',                label: 'Lihat Stok & Pergerakan',                    group: 'Stok',                    parent: 'stock.manage' },

  // Penerimaan Stok (Stock In)
  { key: 'stock.in.view',             label: 'Lihat Daftar Penerimaan Stok',               group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.in.create',           label: 'Buat Transaksi Penerimaan Stok',             group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.in.scan',             label: 'Penerimaan Stok: Input via Scan Barcode',    group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.in.manual_input',     label: 'Penerimaan Stok: Input Manual',              group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.in.delete',           label: 'Hapus Transaksi Penerimaan Stok',            group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.in.delete_item',      label: 'Penerimaan Stok: Hapus Item Tersimpan',      group: 'Stok',                    parent: 'stock.manage' },

  // Pengeluaran Stok (Stock Out)
  { key: 'stock.out.view',            label: 'Lihat Daftar Pengeluaran Stok',              group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.out.create',          label: 'Buat Transaksi Pengeluaran Stok',            group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.out.scan',            label: 'Pengeluaran Stok: Input via Scan Barcode',   group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.out.manual_input',    label: 'Pengeluaran Stok: Input Manual',             group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.out.delete',          label: 'Hapus Transaksi Pengeluaran Stok',           group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.out.delete_item',     label: 'Pengeluaran Stok: Hapus Item Tersimpan',     group: 'Stok',                    parent: 'stock.manage' },

  // Stok Opname
  { key: 'stock.opname.view',         label: 'Lihat Sesi Stok Opname',                     group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.opname.create',       label: 'Buat & Kelola Sesi Stok Opname',             group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.opname.scan',         label: 'Stok Opname: Hitung via Scan Barcode',       group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.opname.manual_input', label: 'Stok Opname: Input Manual',                  group: 'Stok',                    parent: 'stock.manage' },
  { key: 'stock.opname.delete',       label: 'Hapus / Batalkan Sesi Stok Opname',          group: 'Stok',                    parent: 'stock.manage' },

  // ── Handover ─────────────────────────────────────────────────────────────────
  { key: 'handover.manage',           label: 'Akses Penuh Handover Pengiriman',            group: 'Handover Pengiriman',     isParent: true },
  { key: 'handover.view',             label: 'Lihat Dokumen Handover',                     group: 'Handover Pengiriman',     parent: 'handover.manage' },
  { key: 'handover.create',           label: 'Buat & Kelola Handover (scan resi)',         group: 'Handover Pengiriman',     parent: 'handover.manage' },

  // ── Penerimaan & Packing ─────────────────────────────────────────────────────
  { key: 'packing.manage',            label: 'Akses Penuh Penerimaan & Packing',           group: 'Penerimaan & Packing',    isParent: true },
  { key: 'packing.view',              label: 'Lihat Modul Penerimaan & Packing',           group: 'Penerimaan & Packing',    parent: 'packing.manage' },
  { key: 'packing.incoming',          label: 'Kelola Barang Masuk & Surat Jalan',          group: 'Penerimaan & Packing',    parent: 'packing.manage' },
  { key: 'packing.jobs',              label: 'Buat & Kelola Packing Job',                  group: 'Penerimaan & Packing',    parent: 'packing.manage' },
  { key: 'packing.verify',            label: 'Verifikasi Packing & Buat FAP',              group: 'Penerimaan & Packing',    parent: 'packing.manage' },

  // ── Laporan ──────────────────────────────────────────────────────────────────
  { key: 'reports.manage',            label: 'Akses Penuh Laporan',                        group: 'Laporan',                 isParent: true },
  { key: 'reports.dashboard',         label: 'Lihat Dasbor & Laporan',                     group: 'Laporan',                 parent: 'reports.manage' },

  // ── Administrasi ─────────────────────────────────────────────────────────────
  { key: 'admin.manage',              label: 'Akses Penuh Administrasi',                   group: 'Administrasi',            isParent: true },
  { key: 'admin.users',               label: 'Kelola Pengguna',                            group: 'Administrasi',            parent: 'admin.manage' },
];

const ALL_KEYS = ALL_PERMISSIONS.map(p => p.key);

const DEFAULT_PERMISSIONS = {
  SUPER_ADMIN:   ALL_KEYS,
  ADMIN:         ALL_KEYS,
  COMPANY_ADMIN: ALL_KEYS,

  OPERASIONAL: [
    'dashboard.manage',
    'inventory.manage',
    'inventory.view_value',
    'stock.manage',
    'stock.in.view', 'stock.in.create', 'stock.in.scan', 'stock.in.manual_input', 'stock.in.delete', 'stock.in.delete_item',
    'stock.out.view', 'stock.out.create', 'stock.out.scan', 'stock.out.manual_input', 'stock.out.delete', 'stock.out.delete_item',
    'stock.opname.view', 'stock.opname.create', 'stock.opname.scan', 'stock.opname.delete',
    'handover.manage',
    'packing.manage',
    'reports.manage',
  ],

  HEAD_PACKING: [
    'dashboard.manage',
    'inventory.view',
    'inventory.view_value',
    'stock.view',
    'stock.in.view', 'stock.out.view', 'stock.opname.view',
    'packing.manage',
    'reports.manage',
  ],

  TIM_PACKING: ['packing.view', 'packing.jobs'],

  HR: ['admin.manage', 'reports.manage'],

  CEO: [
    'dashboard.manage',
    'inventory.view',
    'inventory.view_value',
    'stock.view',
    'stock.in.view', 'stock.out.view', 'stock.opname.view',
    'handover.view',
    'packing.view',
    'reports.manage',
  ],

  STAFF: ['inventory.view'],
};

const EDITABLE_ROLES = ['COMPANY_ADMIN', 'OPERASIONAL', 'TIM_PACKING', 'STAFF'];
const SYSTEM_ROLES   = ['SUPER_ADMIN', 'ADMIN'];

module.exports = { ALL_PERMISSIONS, DEFAULT_PERMISSIONS, EDITABLE_ROLES, SYSTEM_ROLES };
