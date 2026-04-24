# Tutorial Penggunaan SaaS Inventory System

## Daftar Isi

1. [Login](#1-login)
2. [Dashboard](#2-dashboard)
3. [Manajemen Kategori](#3-manajemen-kategori)
4. [Manajemen Produk](#4-manajemen-produk)
5. [Manajemen Gudang](#5-manajemen-gudang)
6. [Manajemen Supplier](#6-manajemen-supplier)
7. [Stock In — Barang Masuk dari Supplier](#7-stock-in--barang-masuk-dari-supplier)
8. [Stock Out — Barang Keluar](#8-stock-out--barang-keluar)
9. [Melihat Level Stok](#9-melihat-level-stok)
10. [Riwayat Pergerakan Stok](#10-riwayat-pergerakan-stok)
11. [Stock Opname](#11-stock-opname)
12. [Modul Packing — Alur Lengkap](#12-modul-packing--alur-lengkap)
    - [12.1 Setup Vendor](#121-setup-vendor)
    - [12.2 Buat Incoming Goods](#122-buat-incoming-goods)
    - [12.3 Konfirmasi Vendor & Surat Jalan Otomatis](#123-konfirmasi-vendor--surat-jalan-otomatis)
    - [12.4 Cetak Surat Jalan](#124-cetak-surat-jalan)
    - [12.5 Notify Production](#125-notify-production)
    - [12.6 Buat Packing Job](#126-buat-packing-job)
    - [12.7 Mulai Packing](#127-mulai-packing)
    - [12.8 Submit Hasil Packing](#128-submit-hasil-packing)
    - [12.9 Verifikasi Hasil Packing](#129-verifikasi-hasil-packing)
    - [12.10 Selesaikan Incoming Goods](#1210-selesaikan-incoming-goods)
    - [12.11 Lihat Form Anak Packing](#1211-lihat-form-anak-packing)
13. [Manajemen User](#13-manajemen-user)
14. [Manajemen Perusahaan](#14-manajemen-perusahaan-super_admin)
15. [Scan QR & Barcode](#15-scan-qr--barcode)

---

## 1. Login

**Siapa:** Semua user

1. Buka browser, akses URL aplikasi (contoh: `http://localhost:5173`)
2. Masukkan **Email** dan **Password**
3. Klik tombol **Login**

Jika berhasil, Anda akan diarahkan ke halaman Dashboard.

**Kemungkinan error saat login:**

| Pesan Error | Penyebab |
|---|---|
| Email atau password salah | Kredensial tidak sesuai |
| Akun tidak aktif | Admin menonaktifkan akun Anda |
| Perusahaan tidak aktif | Status perusahaan suspended/inactive |
| Langganan expired | Masa berlaku berakhir, hubungi SUPER_ADMIN |

**Logout:** Klik ikon/tombol **Logout** di navbar atau sidebar.

---

## 2. Dashboard

**Siapa:** Semua role

Dashboard menampilkan ringkasan kondisi inventaris secara real-time:

- **Total Produk** — Jumlah produk yang terdaftar
- **Total Gudang** — Jumlah gudang aktif
- **Total Transaksi Hari Ini** — Stock In dan Stock Out hari ini
- **Grafik Pergerakan Stok** — Visualisasi stok masuk vs keluar per periode
- **Produk Stok Rendah** — Produk yang mendekati batas minimum

---

## 3. Manajemen Kategori

**Siapa:** ADMIN, OPERASIONAL

Kategori digunakan untuk mengelompokkan produk.

### Membuat Kategori Baru

1. Klik menu **Kategori** di sidebar
2. Klik tombol **+ Tambah Kategori**
3. Isi **Nama Kategori** (contoh: `Bahan Baku`, `Produk Jadi`, `Kemasan`)
4. Klik **Simpan**

### Mengubah Kategori

1. Klik ikon **Edit** (pensil) pada baris kategori
2. Ubah nama kategori
3. Klik **Simpan**

### Menghapus Kategori

1. Klik ikon **Hapus** (tempat sampah) pada baris kategori
2. Konfirmasi penghapusan

> **Perhatian:** Kategori yang masih digunakan oleh produk tidak dapat dihapus.

---

## 4. Manajemen Produk

**Siapa:** ADMIN, OPERASIONAL

### Membuat Produk Baru

1. Klik menu **Produk** di sidebar
2. Klik tombol **+ Tambah Produk**
3. Isi form produk:

   | Field | Keterangan | Contoh |
   |---|---|---|
   | Nama Produk | Nama lengkap produk | `Karton Box 30x40` |
   | SKU | Kode unik produk | `KB-3040-001` |
   | Barcode | Nomor barcode (opsional) | `8991234567890` |
   | Kategori | Pilih dari daftar kategori | `Kemasan` |
   | Satuan | Unit pengukuran | `pcs`, `kg`, `liter` |

4. Klik **Simpan**

Setelah disimpan, sistem otomatis membuat **QR Code** unik untuk produk ini.

### Mengubah Produk

1. Klik ikon **Edit** pada baris produk
2. Ubah data yang diperlukan
3. Klik **Simpan**

### Mencetak Label QR Produk

1. Di halaman Produk, klik ikon **QR** pada baris produk
2. Modal label QR akan terbuka
3. Klik **Print** — browser akan membuka dialog cetak
4. Pilih printer dan klik **Cetak**

Label ini bisa ditempel pada produk fisik untuk keperluan scan saat stock opname atau packing.

---

## 5. Manajemen Gudang

**Siapa:** ADMIN, OPERASIONAL

### Membuat Gudang Baru

1. Klik menu **Gudang** di sidebar
2. Klik **+ Tambah Gudang**
3. Isi data:
   - **Nama Gudang** (contoh: `Gudang Utama`, `Gudang B`)
   - **Lokasi** (contoh: `Lantai 1, Blok A`)
4. Klik **Simpan**

---

## 6. Manajemen Supplier

**Siapa:** ADMIN, OPERASIONAL

Supplier adalah pihak yang mengirimkan barang ke gudang melalui transaksi **Stock In**.

### Menambah Supplier

1. Klik menu **Supplier** di sidebar
2. Klik **+ Tambah Supplier**
3. Isi nama dan informasi kontak supplier
4. Klik **Simpan**

---

## 7. Stock In — Barang Masuk dari Supplier

**Siapa:** ADMIN, OPERASIONAL

Gunakan fitur ini untuk mencatat penerimaan barang dari supplier ke gudang.

### Membuat Transaksi Stock In

1. Klik menu **Stock In** di sidebar
2. Klik **+ Tambah Stock In**
3. Isi header transaksi:
   - **Tanggal**: Tanggal barang diterima
   - **Supplier**: Pilih supplier pengirim
   - **Catatan**: Keterangan tambahan (opsional)
4. Tambahkan item barang dengan klik **+ Tambah Item**:
   - **Produk**: Cari dan pilih produk
   - **Gudang**: Gudang tujuan penerimaan
   - **Jumlah**: Kuantitas yang diterima
5. Ulangi langkah 4 untuk setiap produk yang diterima
6. Klik **Simpan**

**Hasil otomatis setelah simpan:**
- Stok produk di gudang tujuan **bertambah** sesuai jumlah yang dimasukkan
- Record **Stock Movement** tipe `IN` dicatat sebagai audit trail

---

## 8. Stock Out — Barang Keluar

**Siapa:** ADMIN, OPERASIONAL

Gunakan fitur ini untuk mencatat pengeluaran barang dari gudang.

### Membuat Transaksi Stock Out

1. Klik menu **Stock Out** di sidebar
2. Klik **+ Tambah Stock Out**
3. Isi header transaksi:
   - **Tanggal**: Tanggal pengeluaran
   - **Tujuan**: Ke mana barang dikirim (contoh: `Toko A`, `Produksi`)
   - **Catatan**: Keterangan tambahan
4. Tambahkan item barang:
   - **Produk**: Pilih produk
   - **Gudang**: Gudang sumber barang
   - **Jumlah**: Kuantitas yang dikeluarkan
5. Klik **Simpan**

> **Catatan:** Sistem akan memvalidasi bahwa stok mencukupi sebelum menyimpan.

**Hasil otomatis setelah simpan:**
- Stok produk di gudang asal **berkurang**
- Record **Stock Movement** tipe `OUT` dicatat

---

## 9. Melihat Level Stok

**Siapa:** ADMIN, OPERASIONAL, CEO

1. Klik menu **Stok** di sidebar
2. Halaman menampilkan tabel stok per produk per gudang
3. Gunakan filter untuk mempersempit tampilan:
   - Filter berdasarkan **Gudang**
   - Cari berdasarkan **Nama Produk** atau **SKU**

---

## 10. Riwayat Pergerakan Stok

**Siapa:** ADMIN, OPERASIONAL, CEO

1. Klik menu **Movements** di sidebar
2. Tampil seluruh riwayat pergerakan stok (masuk dan keluar)
3. Setiap baris berisi:
   - Tanggal transaksi
   - Produk & gudang terkait
   - Tipe (IN / OUT / ADJUSTMENT)
   - Kuantitas
   - Referensi dokumen asal

---

## 11. Stock Opname

**Siapa:** ADMIN, OPERASIONAL

Stock Opname adalah proses menghitung stok fisik di gudang dan mencocokkannya dengan data sistem.

### Langkah-Langkah Stock Opname

#### A. Buat Sesi Opname

1. Klik menu **Opname** di sidebar
2. Klik **+ Buat Sesi Baru**
3. Pilih **Gudang** yang akan di-opname
4. Tambahkan catatan (opsional, contoh: `Opname bulanan April 2026`)
5. Klik **Mulai Opname**

#### B. Hitung Fisik

1. Di dalam sesi opname, Anda akan melihat daftar produk di gudang tersebut
2. Untuk setiap produk, masukkan **jumlah fisik** hasil hitungan
   - Bisa diisi manual
   - Atau scan QR/barcode produk menggunakan kamera
3. Sistem menampilkan perbandingan:
   - **Qty Sistem** — Stok menurut database
   - **Qty Fisik** — Jumlah yang Anda hitung
   - **Selisih** — Perbedaan (positif = lebih, negatif = kurang)
4. Ulangi untuk semua produk dalam gudang

#### C. Selesaikan Opname

1. Setelah semua produk dihitung, klik **Selesaikan Opname**
2. Sistem menyimpan semua hasil hitungan beserta selisihnya
3. Laporan opname dapat dilihat dan dicetak

> **Catatan:** Penyesuaian stok berdasarkan hasil opname perlu dilakukan secara manual oleh ADMIN/OPERASIONAL setelah sesi selesai.

---

## 12. Modul Packing — Alur Lengkap

Modul packing melibatkan beberapa role dengan urutan tugas yang jelas. Berikut gambaran alurnya:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ALUR MODUL PACKING                           │
│                                                                 │
│  OPERASIONAL          HEAD_PACKING           TIM_PACKING        │
│       │                    │                     │              │
│  [12.1] Setup Vendor       │                     │              │
│       │                    │                     │              │
│  [12.2] Buat              │                     │              │
│    Incoming Goods          │                     │              │
│       │                    │                     │              │
│  [12.3] Konfirmasi         │                     │              │
│    Vendor                  │                     │              │
│    (SJ dibuat otomatis)    │                     │              │
│       │                    │                     │              │
│  [12.4] Cetak SJ           │                     │              │
│       │                    │                     │              │
│  [12.5] Notify ───────────►│                     │              │
│    Production              │                     │              │
│       │                    │                     │              │
│       │             [12.6] Buat ────────────────►│              │
│       │              Packing Job                 │              │
│       │                    │                     │              │
│       │                    │              [12.7] Mulai          │
│       │                    │               Packing              │
│       │                    │                     │              │
│       │                    │              [12.8] Submit         │
│       │                    │               Hasil                │
│       │                    │                     │              │
│       │             [12.9] Verifikasi ◄───────────              │
│       │              Hasil                       │              │
│       │                    │                     │              │
│  [12.10] Selesaikan        │                     │              │
│    Incoming Goods          │                     │              │
│    [COMPLETED] ✅          │                     │              │
│                                                                 │
│  HR: Bisa melihat Form Anak Packing [12.11] kapan saja         │
└─────────────────────────────────────────────────────────────────┘
```

---

### 12.1 Setup Vendor

**Siapa:** OPERASIONAL, ADMIN

Vendor adalah pemasok barang yang akan diproses dalam modul packing. Berbeda dengan Supplier di modul inventaris biasa.

1. Klik menu **Vendor** di sidebar
2. Klik **+ Tambah Vendor**
3. Isi data vendor:

   | Field | Keterangan | Contoh |
   |---|---|---|
   | Nama Vendor | Nama lengkap perusahaan vendor | `PT Sumber Makmur` |
   | Kode Vendor | Kode unik vendor | `VND-001` |
   | Kontak / PIC | Nama penanggung jawab | `Budi Santoso` |
   | Nomor Telepon | Nomor HP/telepon | `08123456789` |
   | Email | Alamat email | `budi@sumbermakmur.com` |
   | Alamat | Alamat lengkap vendor | `Jl. Industri No. 10` |

4. Klik **Simpan**

---

### 12.2 Buat Incoming Goods

**Siapa:** OPERASIONAL, ADMIN

Dilakukan saat barang dari vendor tiba di gudang.

1. Klik menu **Incoming Goods** di sidebar
2. Klik **+ Tambah Incoming Goods**
3. Isi header dokumen:

   | Field | Keterangan |
   |---|---|
   | Vendor | Pilih vendor pengirim |
   | Tanggal Terima | Tanggal fisik barang tiba |
   | No. SJ Vendor | Nomor surat jalan dari vendor |
   | Diterima Oleh | User yang menerima barang |
   | Catatan | Keterangan tambahan |

4. Tambahkan item barang dengan klik **+ Tambah Item**:

   | Field | Keterangan |
   |---|---|
   | Produk | Pilih produk yang diterima |
   | Qty Dipesan | Jumlah yang seharusnya dikirim |
   | Qty Diterima | Jumlah aktual yang datang |
   | Qty Siap | Jumlah yang layak diproses |
   | Qty Reject | Jumlah yang ditolak (rusak/tidak sesuai) |
   | Satuan | Unit barang (pcs, kg, dll) |
   | Catatan | Keterangan per item |

5. Ulangi langkah 4 untuk setiap produk
6. Klik **Simpan**

**Status dokumen:** `DRAFT`
**Nomor dokumen** dibuat otomatis oleh sistem.

---

### 12.3 Konfirmasi Vendor & Surat Jalan Otomatis

**Siapa:** OPERASIONAL, ADMIN

Langkah ini mengonfirmasi bahwa vendor sudah menyerahkan barang sesuai yang dicatat.

1. Di halaman **Incoming Goods**, buka detail dokumen yang berstatus `DRAFT`
2. Klik tombol **Konfirmasi Vendor**
3. Isi informasi konfirmasi yang diminta
4. Klik **Konfirmasi**

**Yang terjadi secara otomatis:**
- Status dokumen berubah menjadi `VENDOR_CONFIRMED`
- Sistem membuat **Surat Jalan** baru secara otomatis dengan:
  - Nomor otomatis (format: `SJ-0001`)
  - Snapshot daftar item dari Incoming Goods
  - Tanggal pembuatan dicatat

---

### 12.4 Cetak Surat Jalan

**Siapa:** OPERASIONAL, PRODUKSI, ADMIN

1. Klik menu **Surat Jalan** di sidebar
2. Cari surat jalan berdasarkan nomor atau tanggal
3. Klik **Detail** untuk membuka surat jalan
4. Klik tombol **Cetak / Print**
5. Browser membuka dialog cetak — pilih printer dan klik **Cetak**

Setelah dicetak, sistem mencatat **waktu pencetakan** (`printedAt`) pada dokumen.

---

### 12.5 Notify Production

**Siapa:** OPERASIONAL, ADMIN

Langkah ini memberitahu tim produksi bahwa barang siap diproses lebih lanjut.

1. Buka detail Incoming Goods yang berstatus `VENDOR_CONFIRMED`
2. Klik tombol **Notify Production**
3. Konfirmasi aksi

**Status dokumen berubah menjadi:** `PRODUCTION_NOTIFIED`

Setelah status ini, HEAD_PACKING dapat mulai membuat Packing Job.

---

### 12.6 Buat Packing Job

**Siapa:** HEAD_PACKING, ADMIN

Packing job adalah penugasan kerja packing kepada anggota tim.

1. Klik menu **Packing Jobs** di sidebar
2. Klik **+ Buat Packing Job**
3. Isi detail penugasan:

   | Field | Keterangan |
   |---|---|
   | Incoming Goods | Pilih dokumen incoming goods yang akan dipacking |
   | Ditugaskan Ke | Pilih worker (role: TIM_PACKING) |
   | Catatan | Instruksi khusus untuk worker |

4. Klik **Simpan**

**Status packing job:** `PENDING`

Worker yang ditugaskan akan dapat melihat packing job ini di akun mereka.

---

### 12.7 Mulai Packing

**Siapa:** TIM_PACKING, ADMIN

1. Login sebagai **TIM_PACKING**
2. Klik menu **Packing Jobs**
3. Cari packing job dengan status `PENDING` yang ditugaskan ke Anda
4. Klik **Detail** untuk membuka packing job
5. Klik tombol **Mulai** / **Start**

**Status packing job berubah menjadi:** `IN_PROGRESS`

Waktu mulai (`startedAt`) dicatat otomatis.

---

### 12.8 Submit Hasil Packing

**Siapa:** TIM_PACKING, ADMIN

Setelah selesai mengerjakan packing:

1. Buka detail packing job yang sedang `IN_PROGRESS`
2. Untuk setiap item, isi hasil packing:

   | Field | Keterangan |
   |---|---|
   | Qty Ready | Jumlah item yang berhasil dipacking dengan baik |
   | Qty Reject | Jumlah item yang tidak lolos (rusak, tidak sesuai) |
   | Alasan Reject | Keterangan mengapa item di-reject |
   | Scan Barcode | Scan barcode item untuk verifikasi (opsional) |

3. Pastikan semua item sudah diisi
4. Klik tombol **Submit**

**Status packing job berubah menjadi:** `SUBMITTED`

Waktu submit (`submittedAt`) dicatat otomatis. Sistem juga membuat **Form Anak Packing** yang merangkum hasil kerja worker ini.

---

### 12.9 Verifikasi Hasil Packing

**Siapa:** HEAD_PACKING, ADMIN

1. Login sebagai **HEAD_PACKING**
2. Klik menu **Packing Jobs**
3. Filter atau cari packing job dengan status `SUBMITTED`
4. Buka detail packing job
5. Review hasil packing:
   - Periksa qty ready dan qty reject per item
   - Baca alasan reject jika ada
   - Bandingkan dengan target yang diharapkan
6. Jika hasil sudah sesuai, klik **Verifikasi**
7. Tambahkan catatan verifikasi jika perlu
8. Klik **Konfirmasi Verifikasi**

**Status packing job berubah menjadi:** `VERIFIED`

> **Catatan:** Status Incoming Goods **tidak otomatis** berubah menjadi COMPLETED. OPERASIONAL harus menjalankan langkah 12.10 secara manual setelah semua packing job diverifikasi.

---

### 12.10 Selesaikan Incoming Goods

**Siapa:** OPERASIONAL, ADMIN

Setelah **semua** Packing Job berstatus `VERIFIED`, OPERASIONAL harus menutup dokumen Incoming Goods secara manual.

1. Buka menu **Incoming Goods**
2. Buka detail dokumen yang berstatus `PACKING_IN_PROGRESS`
3. Pastikan semua Packing Job terkait sudah `VERIFIED`
4. Klik tombol **Selesaikan** / **Complete**
5. Konfirmasi aksi

**Yang terjadi secara otomatis:**
- Status Incoming Goods berubah menjadi `COMPLETED`
- Sistem mengagregasi total `qtyReady` dan `qtyReject` dari semua PackingResult ke setiap item
- Waktu selesai (`completedAt`) dicatat

> **Jika masih ada Packing Job yang belum VERIFIED**, tombol Selesaikan tidak akan bisa diklik / sistem akan menolak dengan pesan error.

---

### 12.11 Lihat Form Anak Packing

**Siapa:** HR, HEAD_PACKING, OPERASIONAL, CEO, ADMIN

Form Anak Packing adalah rekap detail hasil packing per worker. Berguna untuk:
- Perhitungan upah/bonus berdasarkan output packing
- Dokumentasi kinerja tim
- Keperluan audit/HR

1. Klik menu **Form Anak Packing** di sidebar
2. Daftar form akan tampil — bisa difilter berdasarkan:
   - Tanggal
   - Worker/karyawan
   - Packing Job
3. Klik **Detail** untuk melihat detail form satu worker
4. Data yang tampil:
   - Nama worker
   - Packing Job terkait
   - Total qty dipacking
   - Total qty ready
   - Total qty reject
   - Snapshot detail hasil per item

---

## 13. Manajemen User

**Siapa:** ADMIN, COMPANY_ADMIN, SUPER_ADMIN

### Membuat User Baru

1. Klik menu **Users** di sidebar
2. Klik **+ Tambah User**
3. Isi data user:

   | Field | Keterangan |
   |---|---|
   | Nama Lengkap | Nama user |
   | Email | Digunakan untuk login |
   | Password | Minimal 8 karakter |
   | Role | Pilih sesuai jabatan (lihat tabel role) |
   | Status Aktif | Centang untuk mengaktifkan akun |

4. Klik **Simpan**

User baru bisa langsung login dengan email dan password yang diisi.

### Mengubah Data User

1. Klik ikon **Edit** pada baris user
2. Ubah data yang diperlukan (nama, role, status)
3. Klik **Simpan**

> **Catatan:** Untuk mengubah password, gunakan fitur ubah password yang terpisah.

### Menonaktifkan User

1. Klik **Edit** pada user yang ingin dinonaktifkan
2. Matikan toggle / uncheck **Status Aktif**
3. Klik **Simpan**

User yang tidak aktif tidak bisa login meskipun password-nya benar.

### Panduan Memilih Role

| Jabatan di Perusahaan | Role yang Tepat |
|---|---|
| Staff gudang / logistik | `OPERASIONAL` |
| Kepala divisi / manajer | `CEO` atau `ADMIN` |
| Staf produksi | `PRODUKSI` |
| Kepala tim packing | `HEAD_PACKING` |
| Anggota tim packing | `TIM_PACKING` |
| Staff HRD | `HR` |
| Admin sistem perusahaan | `COMPANY_ADMIN` |

---

## 14. Manajemen Perusahaan (SUPER_ADMIN)

**Siapa:** SUPER_ADMIN saja

### Membuat Perusahaan Baru

1. Login sebagai **SUPER_ADMIN**
2. Klik menu **Companies** di sidebar
3. Klik **+ Tambah Perusahaan**
4. Isi data perusahaan:
   - **Nama Perusahaan**
   - **Slug** (identifier unik URL-friendly, contoh: `pt-maju-jaya`)
   - **Tanggal Expired Langganan**
5. Klik **Simpan**

Setelah perusahaan dibuat, buat user pertama (ADMIN) untuk perusahaan tersebut melalui menu **Users**.

### Mengubah Status Perusahaan

| Status | Efek |
|---|---|
| `active` | Perusahaan bisa menggunakan sistem |
| `inactive` | Perusahaan tidak bisa login |
| `suspended` | Akses diblokir (misal: tagihan belum dibayar) |

1. Klik **Edit** pada baris perusahaan
2. Ubah **Status** sesuai kebutuhan
3. Klik **Simpan**

Seluruh user perusahaan yang di-suspend/inactive tidak bisa login sampai status dikembalikan ke `active`.

---

## 15. Scan QR & Barcode

Fitur scan digunakan untuk mempercepat identifikasi produk tanpa mengetik manual.

### Cara Menggunakan Scanner

1. Di halaman yang mendukung scan (Opname, Packing), klik ikon **Scan QR** atau **Scan Barcode**
2. Modal kamera akan terbuka
3. Arahkan kamera ke QR code atau barcode produk
4. Sistem otomatis mengenali produk dan mengisi field yang relevan

### Mencetak Label QR Produk

1. Buka menu **Produk**
2. Klik ikon **QR** pada produk yang ingin dicetak labelnya
3. Klik **Print** di dalam modal
4. Tempel label pada produk fisik untuk mempermudah scanning

> **Tips:** Gunakan printer label (contoh: Zebra, Brother QL) untuk hasil terbaik. Label QR yang dicetak di kertas biasa juga bisa digunakan.

---

## Ringkasan Status Dokumen

### Incoming Goods

```
DRAFT
  │
  ▼ (Konfirmasi Vendor → Surat Jalan dibuat otomatis)
VENDOR_CONFIRMED
  │
  ▼ (Notify Production)
PRODUCTION_NOTIFIED
  │
  ▼ (Packing Job pertama dibuat)
PACKING_IN_PROGRESS
  │
  ▼ (Semua Packing Job verified → OPERASIONAL klik Selesaikan)
COMPLETED ✅
```

### Packing Job

```
PENDING
  │
  ▼ (Worker klik Mulai)
IN_PROGRESS
  │
  ▼ (Worker Submit Hasil)
SUBMITTED
  │
  ▼ (HEAD_PACKING Verifikasi)
VERIFIED ✅
```

---

## Tips & Trik

- **Filter dan Pencarian:** Semua halaman list mendukung filter dan pencarian. Manfaatkan untuk menemukan data lebih cepat.
- **Pagination:** Data ditampilkan per halaman. Gunakan navigasi halaman di bagian bawah tabel untuk melihat data lebih banyak.
- **Notifikasi Toast:** Setiap aksi berhasil atau gagal akan menampilkan notifikasi di pojok layar.
- **Data Terisolasi:** Setiap perusahaan hanya melihat datanya sendiri. Tidak ada data yang bocor antar perusahaan.
- **Audit Trail:** Setiap pergerakan stok tercatat di menu Movements. Gunakan ini jika ada selisih stok yang perlu ditelusuri.
