'use strict';

const ALL_PERMISSIONS = [
  // Inventory
  { key: 'inventory.view',          label: 'Lihat Produk & Katalog',                     group: 'Inventory' },
  { key: 'inventory.manage',        label: 'Kelola Produk (Tambah/Edit/Hapus)',           group: 'Inventory' },
  // Stok
  { key: 'stock.view',              label: 'Lihat Stok & Pergerakan Stok',                group: 'Stok' },
  { key: 'stock.manage',            label: 'Kelola Stock In / Out / Opname',              group: 'Stok' },
  { key: 'stock.in.scan',           label: 'Stock In: Input via Scan Barcode',            group: 'Stok' },
  { key: 'stock.in.manual_input',   label: 'Stock In: Input Manual (tanpa barcode)',      group: 'Stok' },
  { key: 'stock.in.delete_item',    label: 'Stock In: Hapus Item yang Sudah Tersimpan',   group: 'Stok' },
  { key: 'stock.out.scan',           label: 'Stock Out: Input via Scan Barcode',          group: 'Stok' },
  { key: 'stock.out.manual_input',  label: 'Stock Out: Input Manual (tanpa barcode)',     group: 'Stok' },
  { key: 'stock.opname.scan',        label: 'Stock Opname: Hitung via Scan Barcode',      group: 'Stok' },
  { key: 'stock.opname.manual_input',label: 'Stock Opname: Input Manual (tanpa barcode)',group: 'Stok' },
  // Penerimaan Barang Vendor
  { key: 'packing.view',            label: 'Lihat Modul Penerimaan & Packing',            group: 'Penerimaan Barang Vendor' },
  { key: 'packing.incoming',        label: 'Kelola Barang Masuk & Surat Jalan',           group: 'Penerimaan Barang Vendor' },
  // Packing
  { key: 'packing.jobs',            label: 'Buat & Kelola Packing Job',                   group: 'Packing' },
  { key: 'packing.verify',          label: 'Verifikasi Packing & Buat FAP',               group: 'Packing' },
  // Laporan
  { key: 'reports.dashboard',       label: 'Lihat Dashboard & Laporan',                   group: 'Laporan' },
  // Administrasi
  { key: 'admin.users',             label: 'Kelola Users (CRUD)',                         group: 'Administrasi' },
];

const ALL_KEYS = ALL_PERMISSIONS.map(p => p.key);

const DEFAULT_PERMISSIONS = {
  SUPER_ADMIN:   ALL_KEYS,
  ADMIN:         ALL_KEYS,
  COMPANY_ADMIN: ALL_KEYS,
  OPERASIONAL:   [
    'inventory.view', 'inventory.manage',
    'stock.view', 'stock.manage',
    'stock.in.scan', 'stock.out.scan', 'stock.opname.scan',
    'packing.view', 'packing.incoming',
    'reports.dashboard',
  ],
  HEAD_PACKING:  ['packing.view', 'packing.incoming', 'packing.jobs', 'packing.verify', 'reports.dashboard'],
  TIM_PACKING:   ['packing.view', 'packing.jobs'],
  HR:            ['admin.users', 'reports.dashboard'],
  CEO:           ['inventory.view', 'stock.view', 'packing.view', 'reports.dashboard'],
};

// Roles whose permissions can be edited by admin
const EDITABLE_ROLES = ['COMPANY_ADMIN', 'OPERASIONAL', 'TIM_PACKING'];

// Roles that are fully protected — cannot be created, edited, or deleted
const SYSTEM_ROLES = ['SUPER_ADMIN', 'ADMIN'];

module.exports = { ALL_PERMISSIONS, DEFAULT_PERMISSIONS, EDITABLE_ROLES, SYSTEM_ROLES };
