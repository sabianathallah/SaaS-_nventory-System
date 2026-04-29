'use strict';

const ALL_PERMISSIONS = [
  // Inventory
  { key: 'inventory.view',         label: 'Lihat Produk & Katalog',                group: 'Inventory' },
  { key: 'inventory.manage',       label: 'Kelola Produk (Tambah/Edit/Hapus)',      group: 'Inventory' },
  // Stok
  { key: 'stock.view',             label: 'Lihat Stok & Pergerakan Stok',           group: 'Stok' },
  { key: 'stock.manage',           label: 'Kelola Stock In / Out / Opname',         group: 'Stok' },
  { key: 'stock.in.manual_input',  label: 'Stock In: Input Manual (tanpa barcode)', group: 'Stok' },
  { key: 'stock.in.delete_item',   label: 'Stock In: Hapus Item yang Sudah Tersimpan', group: 'Stok' },
  // Penerimaan Barang Vendor
  { key: 'packing.view',           label: 'Lihat Modul Penerimaan & Packing',       group: 'Penerimaan Barang Vendor' },
  { key: 'packing.incoming',       label: 'Kelola Barang Masuk & Surat Jalan',      group: 'Penerimaan Barang Vendor' },
  // Packing
  { key: 'packing.jobs',           label: 'Buat & Kelola Packing Job',              group: 'Packing' },
  { key: 'packing.verify',         label: 'Verifikasi Packing & Buat FAP',          group: 'Packing' },
  // Laporan
  { key: 'reports.dashboard',      label: 'Lihat Dashboard & Laporan',              group: 'Laporan' },
  // Administrasi
  { key: 'admin.users',            label: 'Kelola Users (CRUD)',                    group: 'Administrasi' },
];

const ALL_KEYS = ALL_PERMISSIONS.map(p => p.key);

const DEFAULT_PERMISSIONS = {
  SUPER_ADMIN:   ALL_KEYS,
  ADMIN:         ALL_KEYS,
  COMPANY_ADMIN: ALL_KEYS,
  OPERASIONAL:   [
    'inventory.view', 'inventory.manage',
    'stock.view', 'stock.manage', 'stock.in.manual_input', 'stock.in.delete_item',
    'packing.view', 'packing.incoming',
    'reports.dashboard',
  ],
  HEAD_PACKING:  ['packing.view', 'packing.incoming', 'packing.jobs', 'packing.verify', 'reports.dashboard'],
  TIM_PACKING:   ['packing.view', 'packing.jobs'],
  HR:            ['admin.users', 'reports.dashboard'],
  CEO:           ['inventory.view', 'stock.view', 'packing.view', 'reports.dashboard'],
};

// Roles whose permissions can be edited by admin
const EDITABLE_ROLES = ['COMPANY_ADMIN', 'OPERASIONAL', 'HEAD_PACKING', 'TIM_PACKING', 'HR', 'CEO'];

module.exports = { ALL_PERMISSIONS, DEFAULT_PERMISSIONS, EDITABLE_ROLES };
