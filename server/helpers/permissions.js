'use strict';

const ALL_PERMISSIONS = [
  // ── Dasbor ───────────────────────────────────────────────────────────────────
  { key: 'dashboard.manage',          label: 'Akses Penuh Dasbor',                         group: 'Dasbor',                  isParent: true,  desc: 'Aktifkan semua fitur dasbor sekaligus' },
  { key: 'dashboard.view_stock',      label: 'Lihat Data Stok',                            group: 'Dasbor',                  parent: 'dashboard.manage',       desc: 'Widget ringkasan jumlah & kondisi stok' },
  { key: 'dashboard.view_value',      label: 'Lihat Nilai Inventaris',                     group: 'Dasbor',                  parent: 'dashboard.manage',       desc: 'Nilai rupiah total inventaris di dasbor' },
  { key: 'dashboard.view_analytics',  label: 'Lihat Grafik & Breakdown',                   group: 'Dasbor',                  parent: 'dashboard.manage',       desc: 'Grafik tren, breakdown per kategori/gudang' },
  { key: 'dashboard.view_movements',  label: 'Lihat Pergerakan Terbaru',                   group: 'Dasbor',                  parent: 'dashboard.manage',       desc: 'Feed aktivitas masuk/keluar stok terbaru' },

  // ── Produk & Katalog ─────────────────────────────────────────────────────────
  { key: 'inventory.manage',          label: 'Akses Penuh Produk & Katalog',               group: 'Produk & Katalog',        isParent: true,  desc: 'Aktifkan semua akses produk sekaligus' },
  { key: 'inventory.view',            label: 'Lihat Produk & Katalog',                     group: 'Produk & Katalog',        parent: 'inventory.manage',       desc: 'Lihat daftar produk, varian, SKU, & katalog' },
  { key: 'inventory.view_value',      label: 'Lihat Harga & Nilai Stok',                   group: 'Produk & Katalog',        parent: 'inventory.manage',       desc: 'Tampilkan harga HPP & nilai stok di seluruh sistem' },
  { key: 'inventory.product.create',  label: 'Tambah Produk Baru',                         group: 'Produk & Katalog',        parent: 'inventory.manage',       desc: 'Buat produk baru beserta varian & SKU' },
  { key: 'inventory.product.edit',    label: 'Edit Produk, Variant & SKU',                 group: 'Produk & Katalog',        parent: 'inventory.manage',       desc: 'Ubah nama, deskripsi, varian, dan atribut SKU' },
  { key: 'inventory.product.delete',  label: 'Hapus Produk',                               group: 'Produk & Katalog',        parent: 'inventory.manage',       desc: 'Hapus permanen produk dari sistem' },

  // ── Stok ─────────────────────────────────────────────────────────────────────
  { key: 'stock.manage',              label: 'Akses Penuh Stok',                           group: 'Stok',                    isParent: true,  desc: 'Aktifkan semua fitur transaksi stok sekaligus' },
  { key: 'stock.view',                label: 'Lihat Stok & Pergerakan',                    group: 'Stok',                    parent: 'stock.manage',           desc: 'Lihat saldo stok per gudang & riwayat pergerakan' },

  { key: 'stock.in.view',             label: 'Lihat Penerimaan Stok',                      group: 'Stok',                    parent: 'stock.manage',           desc: 'Lihat daftar & detail transaksi penerimaan stok' },
  { key: 'stock.in.create',           label: 'Buat Penerimaan Stok',                       group: 'Stok',                    parent: 'stock.manage',           desc: 'Buat transaksi penerimaan stok baru' },
  { key: 'stock.in.scan',             label: 'Penerimaan Stok: Scan Barcode',              group: 'Stok',                    parent: 'stock.manage',           desc: 'Input item via scan barcode di penerimaan stok' },
  { key: 'stock.in.manual_input',     label: 'Penerimaan Stok: Input Manual',              group: 'Stok',                    parent: 'stock.manage',           desc: 'Input item secara manual di penerimaan stok' },
  { key: 'stock.in.delete',           label: 'Hapus Penerimaan Stok',                      group: 'Stok',                    parent: 'stock.manage',           desc: 'Hapus seluruh transaksi penerimaan stok' },
  { key: 'stock.in.delete_item',      label: 'Hapus Item Penerimaan Tersimpan',            group: 'Stok',                    parent: 'stock.manage',           desc: 'Hapus item individual dari transaksi yang sudah ada' },

  { key: 'stock.out.view',            label: 'Lihat Pengeluaran Stok',                     group: 'Stok',                    parent: 'stock.manage',           desc: 'Lihat daftar & detail transaksi pengeluaran stok' },
  { key: 'stock.out.create',          label: 'Buat Pengeluaran Stok',                      group: 'Stok',                    parent: 'stock.manage',           desc: 'Buat transaksi pengeluaran stok baru' },
  { key: 'stock.out.scan',            label: 'Pengeluaran Stok: Scan Barcode',             group: 'Stok',                    parent: 'stock.manage',           desc: 'Input item via scan barcode di pengeluaran stok' },
  { key: 'stock.out.manual_input',    label: 'Pengeluaran Stok: Input Manual',             group: 'Stok',                    parent: 'stock.manage',           desc: 'Input item secara manual di pengeluaran stok' },
  { key: 'stock.out.delete',          label: 'Hapus Pengeluaran Stok',                     group: 'Stok',                    parent: 'stock.manage',           desc: 'Hapus seluruh transaksi pengeluaran stok' },
  { key: 'stock.out.delete_item',     label: 'Hapus Item Pengeluaran Tersimpan',           group: 'Stok',                    parent: 'stock.manage',           desc: 'Hapus item individual dari transaksi yang sudah ada' },

  { key: 'stock.opname.view',         label: 'Lihat Stok Opname',                          group: 'Stok',                    parent: 'stock.manage',           desc: 'Lihat sesi & hasil stok opname' },
  { key: 'stock.opname.create',       label: 'Buat & Kelola Stok Opname',                  group: 'Stok',                    parent: 'stock.manage',           desc: 'Buat sesi opname baru & kelola item hitungan' },
  { key: 'stock.opname.scan',         label: 'Stok Opname: Scan Barcode',                  group: 'Stok',                    parent: 'stock.manage',           desc: 'Hitung stok via scan barcode saat opname' },
  { key: 'stock.opname.manual_input', label: 'Stok Opname: Input Manual',                  group: 'Stok',                    parent: 'stock.manage',           desc: 'Input hitungan stok secara manual saat opname' },
  { key: 'stock.opname.delete',       label: 'Hapus / Batalkan Stok Opname',               group: 'Stok',                    parent: 'stock.manage',           desc: 'Hapus atau batalkan sesi stok opname' },

  // ── Handover ─────────────────────────────────────────────────────────────────
  { key: 'handover.manage',           label: 'Akses Penuh Handover',                       group: 'Handover Pengiriman',     isParent: true,  desc: 'Aktifkan semua fitur handover pengiriman' },
  { key: 'handover.view',             label: 'Lihat Dokumen Handover',                     group: 'Handover Pengiriman',     parent: 'handover.manage',        desc: 'Lihat daftar & detail dokumen handover ke kurir' },
  { key: 'handover.create',           label: 'Buat & Kelola Handover',                     group: 'Handover Pengiriman',     parent: 'handover.manage',        desc: 'Buat handover baru, scan resi, & edit data' },
  { key: 'handover.delete',           label: 'Hapus Dokumen Handover',                     group: 'Handover Pengiriman',     parent: 'handover.manage',        desc: 'Hapus permanen dokumen handover dari sistem' },

  // ── Penerimaan & Packing ─────────────────────────────────────────────────────
  { key: 'packing.manage',            label: 'Akses Penuh Penerimaan & Packing',           group: 'Penerimaan & Packing',    isParent: true,  desc: 'Aktifkan semua fitur penerimaan barang & packing' },
  { key: 'packing.view',              label: 'Lihat Modul Packing',                        group: 'Penerimaan & Packing',    parent: 'packing.manage',         desc: 'Lihat halaman packing (read-only)' },
  { key: 'packing.incoming',          label: 'Kelola Barang Masuk & Surat Jalan',          group: 'Penerimaan & Packing',    parent: 'packing.manage',         desc: 'Catat barang masuk, input qty, upload foto SJ' },
  { key: 'packing.incoming.close',    label: 'Tutup / Buka Kembali Barang Masuk',          group: 'Penerimaan & Packing',    parent: 'packing.manage',         desc: 'Kunci data barang masuk agar tidak bisa diedit (aksi supervisor)' },
  { key: 'packing.jobs',              label: 'Buat & Kelola Packing Job',                  group: 'Penerimaan & Packing',    parent: 'packing.manage',         desc: 'Buat, assign, dan monitor packing job' },
  { key: 'packing.verify',            label: 'Verifikasi Packing & Buat FAP',              group: 'Penerimaan & Packing',    parent: 'packing.manage',         desc: 'Verifikasi hasil packing & terbitkan FAP' },

  // ── Shipping Manual ───────────────────────────────────────────────────────────
  { key: 'shipping.manual.manage',          label: 'Akses Penuh Shipping Manual',              group: 'Shipping Manual',         isParent: true,  desc: 'Aktifkan semua fitur shipping manual' },
  { key: 'shipping.manual.view',            label: 'Lihat Shipping Manual',                    group: 'Shipping Manual',         parent: 'shipping.manual.manage',  desc: 'Lihat daftar & detail transaksi shipping manual' },
  { key: 'shipping.manual.create',          label: 'Buat Shipping Manual',                     group: 'Shipping Manual',         parent: 'shipping.manual.manage',  desc: 'Buat transaksi shipping sales atau non-sales baru' },
  { key: 'shipping.manual.edit',            label: 'Edit Shipping Manual',                     group: 'Shipping Manual',         parent: 'shipping.manual.manage',  desc: 'Edit transaksi yang masih in_progress' },
  { key: 'shipping.manual.cancel',          label: 'Batalkan Shipping Manual',                 group: 'Shipping Manual',         parent: 'shipping.manual.manage',  desc: 'Batalkan transaksi shipping yang belum selesai' },
  { key: 'shipping.manual.approve_payment', label: 'Konfirmasi Bukti Transfer',                group: 'Shipping Manual',         parent: 'shipping.manual.manage',  desc: 'Verifikasi bukti transfer dan ubah status ke transferred' },
  { key: 'shipping.manual.upload_resi',     label: 'Upload Resi Kurir',                        group: 'Shipping Manual',         parent: 'shipping.manual.manage',  desc: 'Upload nomor & foto resi dari kurir ekspedisi' },
  { key: 'shipping.manual.delete',          label: 'Hapus Shipping Manual',                    group: 'Shipping Manual',         parent: 'shipping.manual.manage',  desc: 'Hapus permanen transaksi shipping' },
  { key: 'shipping.manual.category.manage', label: 'Kelola Kategori Non-Sales',                group: 'Shipping Manual',         parent: 'shipping.manual.manage',  desc: 'Tambah, edit, hapus kategori pengiriman non-sales' },

  // ── Transfer Stok ────────────────────────────────────────────────────────────
  { key: 'stock.transfer.manage',     label: 'Akses Penuh Transfer Stok',                  group: 'Transfer Stok',           isParent: true,  desc: 'Aktifkan semua fitur transfer antar gudang' },
  { key: 'stock.transfer.view',       label: 'Lihat Transfer Stok',                        group: 'Transfer Stok',           parent: 'stock.transfer.manage',  desc: 'Lihat daftar & detail transfer stok antar gudang' },
  { key: 'stock.transfer.create',     label: 'Buat Transfer Stok',                         group: 'Transfer Stok',           parent: 'stock.transfer.manage',  desc: 'Buat request transfer stok ke gudang lain' },
  { key: 'stock.transfer.delete',     label: 'Hapus Transfer Stok',                        group: 'Transfer Stok',           parent: 'stock.transfer.manage',  desc: 'Hapus transfer stok yang belum diproses' },

  // ── Laporan ──────────────────────────────────────────────────────────────────
  { key: 'reports.manage',            label: 'Akses Penuh Laporan',                        group: 'Laporan',                 isParent: true,  desc: 'Akses semua laporan dan fitur export data' },
  { key: 'reports.dashboard',         label: 'Lihat Laporan & Dasbor',                     group: 'Laporan',                 parent: 'reports.manage',         desc: 'Lihat halaman laporan & ringkasan analitik' },

  // ── Database Links ────────────────────────────────────────────────────────────
  { key: 'db_link.manage',            label: 'Akses Penuh Database Links',                 group: 'Database Links',          isParent: true,  desc: 'Kelola semua folder & link database' },
  { key: 'db_link.view',              label: 'Lihat Database Links',                       group: 'Database Links',          parent: 'db_link.manage',         desc: 'Lihat folder & link database (read-only)' },
  { key: 'db_link.add_link',          label: 'Tambah Link ke Folder',                      group: 'Database Links',          parent: 'db_link.manage',         desc: 'Tambah atau edit link dalam folder database' },

  // ── Administrasi ─────────────────────────────────────────────────────────────
  { key: 'admin.manage',              label: 'Akses Penuh Administrasi',                   group: 'Administrasi',            isParent: true,  desc: 'Kelola user, role, dan pengaturan sistem' },
  { key: 'admin.users',               label: 'Kelola Pengguna',                            group: 'Administrasi',            parent: 'admin.manage',           desc: 'Tambah, edit, nonaktifkan user & atur role' },
];

const ALL_KEYS = ALL_PERMISSIONS.map(p => p.key);

const DEFAULT_PERMISSIONS = {
  SUPER_ADMIN:   ALL_KEYS,
  COMPANY_ADMIN: ALL_KEYS,

  OPERASIONAL: [
    'dashboard.manage',
    'inventory.manage', 'inventory.view_value',
    'stock.manage',
    'stock.in.view', 'stock.in.create', 'stock.in.scan', 'stock.in.manual_input', 'stock.in.delete', 'stock.in.delete_item',
    'stock.out.view', 'stock.out.create', 'stock.out.scan', 'stock.out.manual_input', 'stock.out.delete', 'stock.out.delete_item',
    'stock.opname.view', 'stock.opname.create', 'stock.opname.scan', 'stock.opname.delete',
    'handover.manage', 'handover.delete',
    'packing.manage', 'packing.incoming', 'packing.incoming.close',
    'shipping.manual.manage', 'shipping.manual.view', 'shipping.manual.create', 'shipping.manual.edit',
    'shipping.manual.cancel', 'shipping.manual.approve_payment', 'shipping.manual.upload_resi',
    'shipping.manual.delete', 'shipping.manual.category.manage',
    'reports.manage',
    'db_link.manage',
  ],

  HEAD_PACKING: [
    'dashboard.manage',
    'inventory.view', 'inventory.view_value',
    'stock.view',
    'stock.in.view', 'stock.out.view', 'stock.opname.view',
    'packing.manage', 'packing.incoming', 'packing.incoming.close',
    'reports.manage',
    'db_link.view',
  ],

  TIM_PACKING: ['packing.view', 'packing.incoming', 'packing.jobs'],

  HR: ['admin.manage', 'admin.users', 'reports.manage', 'db_link.view'],

  CEO: [
    'dashboard.manage',
    'inventory.view', 'inventory.view_value',
    'stock.view',
    'stock.in.view', 'stock.out.view', 'stock.opname.view',
    'handover.view',
    'packing.view',
    'reports.manage',
    'db_link.view',
  ],

  STAFF: ['inventory.view', 'db_link.view'],
};

const EDITABLE_ROLES = ['COMPANY_ADMIN', 'OPERASIONAL', 'TIM_PACKING', 'STAFF'];
const SYSTEM_ROLES   = ['SUPER_ADMIN'];

module.exports = { ALL_PERMISSIONS, DEFAULT_PERMISSIONS, EDITABLE_ROLES, SYSTEM_ROLES };
