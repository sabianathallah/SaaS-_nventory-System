# Tutorial Penggunaan SaaS Inventory System

## Daftar Isi

1. [Login](#1-login)
2. [Dashboard](#2-dashboard)
3. [Katalog — Kategori & Artikel](#3-katalog--kategori--artikel)
4. [Manajemen Produk](#4-manajemen-produk)
   - [Daftar Produk](#41-daftar-produk)
   - [Detail Produk (Read-Only)](#42-detail-produk-read-only)
   - [Buat / Edit Produk](#43-buat--edit-produk)
   - [Mencetak Label QR Thermal](#44-mencetak-label-qr-thermal)
5. [Manajemen Gudang](#5-manajemen-gudang)
   - [Lihat Produk per Gudang](#51-lihat-produk-per-gudang)
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
14. [Manajemen Perusahaan (SUPER_ADMIN)](#14-manajemen-perusahaan-super_admin)
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

- **Total Produk** — Jumlah jenis produk terdaftar
- **Total Stok** — Total unit dari semua SKU
- **Total Nilai Inventaris** — Estimasi nilai (harga × qty seluruh SKU)
- **Stock & Nilai per Artikel** — Breakdown per artikel dengan progress bar
- **Stock per Gudang** — Bar chart distribusi stok antar gudang
- **Pergerakan Terbaru** — 10 pergerakan stok terakhir

Di bagian **Pergerakan Terbaru**, badge di pojok kanan atas menampilkan:
> **"N total pergerakan barang hari ini"**
>
> Angka ini dihitung dari jumlah transaksi stock in/out yang terjadi hari ini (berdasarkan tanggal server).

---

## 3. Katalog — Kategori & Artikel

**Siapa:** ADMIN, OPERASIONAL

Halaman Katalog (`/catalog`) mengelola dua referensi data sekaligus:
- **Kategori** — pengelompokan besar produk (contoh: Bahan Baku, Produk Jadi, Kemasan)
- **Artikel** — sub-klasifikasi produk (contoh: Kotak, Plastik, Karung)

### Mencari Item

Gunakan kotak pencarian di bagian atas setiap section untuk menyaring berdasarkan nama.

### Menambah Item Baru

1. Klik **"+ Tambah baru"** di bawah tabel
2. Ketik nama item
3. Tekan **Enter** atau klik ikon centang untuk menyimpan

### Mengubah Nama Item

1. Klik langsung pada nama item yang ingin diubah — mode edit aktif
2. Ubah nama
3. Tekan **Enter** untuk simpan, atau **Escape** untuk batal

### Menghapus Item

1. Klik ikon **tempat sampah** pada baris item (muncul saat hover)
2. Konfirmasi penghapusan di dialog

> **Perhatian:** Item yang masih digunakan oleh produk tidak dapat dihapus.

Navigasi halaman menggunakan **pagination** di bagian bawah setiap tabel (15 item per halaman).

---

## 4. Manajemen Produk

**Siapa:** ADMIN, OPERASIONAL

### 4.1 Daftar Produk

Buka menu **Produk** di sidebar. Tabel menampilkan:

| Kolom | Keterangan |
|---|---|
| Produk | Foto + nama + satuan |
| Kategori | Badge kategori |
| Variant | Tipe variant + opsi-opsinya sebagai pills |
| SKU | Jumlah SKU terdaftar |
| Harga | Range harga (min–max dari semua SKU) |
| Stok | Total stok semua SKU (merah jika 0, kuning jika < 10) |
| Nilai Stok | Total nilai (harga × stok) semua SKU |

**Filter tersedia:**
- Search nama produk
- Dropdown kategori
- Dropdown artikel
- Dropdown gudang — menampilkan hanya produk yang ada stoknya di gudang tersebut
- Tombol **Reset filter** muncul jika ada filter aktif

**Sorting:** Klik header kolom **Produk** atau **Stok** untuk sort ascending/descending.

**Pagination** di bagian bawah tabel menampilkan "Showing X–Y of Z results".

Klik baris produk mana saja → masuk ke halaman **Detail Produk**.

### 4.2 Detail Produk (Read-Only)

Halaman `/products/:id` adalah halaman **hanya lihat**. Tidak ada field yang bisa diedit langsung dari sini.

Yang ditampilkan:
- Foto, nama, satuan
- Kategori, artikel, total stok keseluruhan
- **Variant Produk** — tipe variant dan opsi-opsinya (pills violet)
- **Tabel SKU** — variant, SKU code, harga, stok, nilai stok, tombol QR

Tombol di header:
- **Ubah** → navigasi ke halaman edit (`/products/:id/edit`)
- **Hapus** → konfirmasi lalu hapus produk beserta semua variantnya

### 4.3 Buat / Edit Produk

**Buat baru:** Klik tombol **"+ Tambah Produk"** di halaman daftar → masuk ke `/products/new`

**Edit:** Klik tombol **Ubah** di halaman detail → masuk ke `/products/:id/edit`

Form berisi:

**Informasi Dasar**
- Foto produk (upload ke Cloudinary, max 5 MB)
- Nama produk
- Satuan (bisa ketik baru / pilih yang ada)
- Kategori (wajib)
- Artikel (opsional)

**Variant Produk**
- Tambah tipe variant (contoh: Ukuran, Warna)
- Per tipe: tambah opsi (contoh: S, M, L, XL)
- Hapus tipe atau opsi dengan ikon tempat sampah

**SKU & Harga**

Ada dua cara mengisi SKU:

| Cara | Kapan Dipakai |
|---|---|
| **Generate dari Variant** | Produk punya variant — sistem buat SKU untuk setiap kombinasi (S/Merah, S/Biru, dst.) |
| **Tambah Manual** | Produk tanpa variant, atau perlu SKU tambahan khusus |

Di tabel SKU:
- Edit **harga** dan **stok (qty)** langsung di sel — tersimpan otomatis saat pindah kolom (blur)
- Tombol **QR** per baris untuk print label
- Tombol **hapus** (muncul saat hover) untuk hapus SKU

Tombol **Simpan** di header → simpan semua perubahan form dan navigasi kembali ke halaman detail.

### 4.4 Mencetak Label QR Thermal

Tombol QR (ikon kode QR) ada di setiap baris SKU — selalu terlihat, tidak perlu hover.

1. Klik tombol **QR** pada SKU yang ingin dicetak
2. Modal terbuka dengan preview label
3. Pilih **ukuran label** yang sesuai:

   | Ukuran | Cocok Untuk |
   |---|---|
   | 30×20 mm | Label produk kecil / stiker mini |
   | 40×30 mm | Stiker penggunaan umum |
   | 50×40 mm | Produk ukuran sedang |
   | 58×40 mm | Printer thermal lebar 58mm |
   | 80×50 mm | Label karton / box besar |

4. Isi **Jumlah Copy** — ketik langsung angka yang diinginkan (1–999)
5. Klik **Print N lembar**
6. Browser membuka jendela print — pilih printer thermal Anda dan klik Cetak

Label berisi: **QR code + nama produk + SKU code**

> **Tips:** Atur printer thermal ke ukuran kertas yang sama dengan pilihan di atas agar label tercetak presisi tanpa pemotongan.

---

## 5. Manajemen Gudang

**Siapa:** ADMIN, OPERASIONAL

### Membuat Gudang Baru

1. Klik menu **Gudang** di sidebar
2. Klik **+ Add Warehouse**
3. Isi **Nama Gudang** dan **Lokasi**
4. Klik **Save**

### Mengubah / Menghapus Gudang

Gunakan ikon **pensil** (edit) atau **tempat sampah** (hapus) pada baris gudang.

### 5.1 Lihat Produk per Gudang

1. Di tabel gudang, klik tombol **Produk** (ikon kotak) pada baris gudang yang ingin dilihat
2. Masuk ke halaman `/warehouses/:id/products`

Halaman ini menampilkan:
- **Tiga stat card**: Total Produk (jenis), Total Stok (unit), Total Nilai Stok
- Tabel produk yang ada di gudang tersebut dengan kolom lengkap (variant, SKU, harga, stok)
- Search nama produk
- Sort kolom Produk dan Stok
- Pagination

Klik baris produk → navigasi ke detail produk.

---

## 6. Manajemen Supplier

**Siapa:** ADMIN, OPERASIONAL

Supplier adalah pihak yang mengirimkan barang melalui transaksi **Stock In**.

### Menambah Supplier

1. Klik menu **Supplier** di sidebar
2. Klik **+ Add Supplier**
3. Isi nama dan informasi kontak
4. Klik **Save**

Edit dan hapus supplier menggunakan ikon pada baris tabel.

---

## 7. Stock In — Barang Masuk dari Supplier

**Siapa:** ADMIN, OPERASIONAL

### Membuat Transaksi Stock In

1. Klik menu **Stock In** di sidebar
2. Klik **+ Tambah** atau buka halaman baru
3. Isi header transaksi:
   - **Tanggal**: Tanggal barang diterima
   - **Supplier**: Pilih supplier pengirim
   - **Catatan**: Keterangan tambahan (opsional)
4. Tambahkan item barang:
   - **Produk**: Pilih produk
   - **Gudang**: Gudang tujuan penerimaan
   - **Jumlah**: Kuantitas diterima
5. Klik **Simpan**

**Hasil otomatis setelah simpan:**
- Stok produk di gudang yang dipilih **bertambah**
- Record **Stock Movement** tipe `IN` dicatat sebagai audit trail

---

## 8. Stock Out — Barang Keluar

**Siapa:** ADMIN, OPERASIONAL

### Membuat Transaksi Stock Out

1. Klik menu **Stock Out** di sidebar
2. Klik **+ Tambah**
3. Isi header transaksi:
   - **Tanggal**: Tanggal pengeluaran
   - **Tujuan**: Ke mana barang dikirim
   - **Catatan**: Keterangan tambahan
4. Tambahkan item barang (produk, gudang, jumlah)
5. Klik **Simpan**

> **Validasi:** Sistem menolak jika stok tidak mencukupi.

**Hasil otomatis:**
- Stok **berkurang**
- Record **Stock Movement** tipe `OUT` dicatat

---

## 9. Melihat Level Stok

**Siapa:** ADMIN, OPERASIONAL, CEO

1. Klik menu **Stok** di sidebar
2. Tabel menampilkan stok per produk per gudang
3. Gunakan filter gudang atau search nama produk

---

## 10. Riwayat Pergerakan Stok

**Siapa:** ADMIN, OPERASIONAL, CEO

1. Klik menu **Movements** di sidebar
2. Tampil seluruh riwayat pergerakan stok
3. Filter berdasarkan **tipe** (IN/OUT/ADJUSTMENT) dan **gudang**
4. Pagination di bagian bawah

Setiap baris berisi: tanggal, produk, gudang, tipe, kuantitas, referensi dokumen asal.

---

## 11. Stock Opname

**Siapa:** ADMIN, OPERASIONAL

Stock Opname adalah proses menghitung stok fisik di gudang dan mencocokkannya dengan data sistem.

### A. Buat Sesi Opname

1. Klik menu **Opname** di sidebar
2. Klik **+ Buat Sesi Baru**
3. Pilih **Gudang** yang akan di-opname
4. Tambahkan catatan opsional
5. Klik **Mulai Opname**

### B. Hitung Fisik

1. Di dalam sesi opname, daftar produk di gudang ditampilkan
2. Untuk setiap produk, masukkan **jumlah fisik** hasil hitungan:
   - Isi manual, atau
   - Scan QR/barcode produk menggunakan kamera
3. Sistem menampilkan perbandingan:
   - **Qty Sistem** — Stok menurut database
   - **Qty Fisik** — Jumlah yang Anda hitung
   - **Selisih** — Perbedaan (positif = lebih, negatif = kurang)
4. Ulangi untuk semua produk

### C. Selesaikan Opname

1. Klik **Selesaikan Opname**
2. Sistem menyimpan semua hasil hitungan beserta selisihnya

> **Catatan:** Penyesuaian stok berdasarkan hasil opname perlu dilakukan secara manual oleh ADMIN/OPERASIONAL setelah sesi selesai.

---

## 12. Modul Packing — Alur Lengkap

Modul packing melibatkan beberapa role dengan urutan tugas yang jelas:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ALUR MODUL PACKING                           │
│                                                                 │
│  OPERASIONAL          HEAD_PACKING           TIM_PACKING        │
│       │                    │                     │              │
│  [12.1] Setup Vendor       │                     │              │
│       │                    │                     │              │
│  [12.2] Buat               │                     │              │
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
│       │              Hasil                                      │
│       │                    │                                    │
│  [12.10] Selesaikan        │                                    │
│    Incoming Goods          │                                    │
│    [COMPLETED] ✅          │                                    │
│                                                                 │
│  HR: Bisa melihat Form Anak Packing [12.11] kapan saja         │
└─────────────────────────────────────────────────────────────────┘
```

---

### 12.1 Setup Vendor

**Siapa:** OPERASIONAL, ADMIN

Vendor adalah pemasok barang untuk modul packing (berbeda dengan Supplier di modul inventaris biasa).

1. Klik menu **Vendor** di sidebar
2. Klik **+ Tambah Vendor**
3. Isi data vendor:

   | Field | Contoh |
   |---|---|
   | Nama Vendor | `PT Sumber Makmur` |
   | Kode Vendor | `VND-001` |
   | Kontak / PIC | `Budi Santoso` |
   | Nomor Telepon | `08123456789` |
   | Email | `budi@sumbermakmur.com` |
   | Alamat | `Jl. Industri No. 10` |

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
   | Satuan | Unit barang |
   | Catatan | Keterangan per item |

5. Klik **Simpan**

**Status dokumen:** `DRAFT` — Nomor dokumen dibuat otomatis oleh sistem.

---

### 12.3 Konfirmasi Vendor & Surat Jalan Otomatis

**Siapa:** OPERASIONAL, ADMIN

1. Di halaman **Incoming Goods**, buka detail dokumen berstatus `DRAFT`
2. Klik tombol **Konfirmasi Vendor**
3. Isi informasi konfirmasi yang diminta
4. Klik **Konfirmasi**

**Yang terjadi otomatis:**
- Status dokumen → `VENDOR_CONFIRMED`
- Sistem membuat **Surat Jalan** baru dengan nomor otomatis (format: `SJ-0001`)
- Snapshot daftar item disimpan ke dalam surat jalan

---

### 12.4 Cetak Surat Jalan

**Siapa:** OPERASIONAL, PRODUKSI, ADMIN

1. Klik menu **Surat Jalan** di sidebar
2. Cari surat jalan berdasarkan nomor atau tanggal
3. Buka detail surat jalan
4. Klik **Cetak / Print**
5. Browser membuka dialog cetak — pilih printer dan klik Cetak

Sistem mencatat **waktu pencetakan** (`printedAt`) pada dokumen setelah dicetak.

---

### 12.5 Notify Production

**Siapa:** OPERASIONAL, ADMIN

1. Buka detail Incoming Goods yang berstatus `VENDOR_CONFIRMED`
2. Klik tombol **Notify Production**
3. Konfirmasi aksi

**Status dokumen → `PRODUCTION_NOTIFIED`**

Setelah ini, HEAD_PACKING dapat membuat Packing Job.

---

### 12.6 Buat Packing Job

**Siapa:** HEAD_PACKING, ADMIN

1. Klik menu **Packing Jobs** di sidebar
2. Klik **+ Buat Packing Job**
3. Isi detail penugasan:

   | Field | Keterangan |
   |---|---|
   | Incoming Goods | Pilih dokumen incoming goods yang akan dipacking |
   | Ditugaskan Ke | Pilih worker (role: TIM_PACKING) |
   | Catatan | Instruksi khusus untuk worker |

4. Klik **Simpan**

**Status packing job:** `PENDING` — Worker yang ditugaskan langsung bisa melihatnya.

---

### 12.7 Mulai Packing

**Siapa:** TIM_PACKING, ADMIN

1. Login sebagai **TIM_PACKING**
2. Klik menu **Packing Jobs**
3. Cari packing job dengan status `PENDING` yang ditugaskan ke Anda
4. Buka detail packing job
5. Klik **Mulai / Start**

**Status → `IN_PROGRESS`** — Waktu mulai (`startedAt`) dicatat otomatis.

---

### 12.8 Submit Hasil Packing

**Siapa:** TIM_PACKING, ADMIN

1. Buka detail packing job yang sedang `IN_PROGRESS`
2. Untuk setiap item, isi hasil packing:

   | Field | Keterangan |
   |---|---|
   | Qty Ready | Jumlah item yang berhasil dipacking |
   | Qty Reject | Jumlah item yang tidak lolos |
   | Alasan Reject | Keterangan penolakan (jika ada) |
   | Scan Barcode | Scan barcode item untuk verifikasi (opsional) |

3. Pastikan semua item sudah diisi
4. Klik **Submit**

**Status → `SUBMITTED`** — Sistem membuat **Form Anak Packing** yang merangkum hasil kerja worker ini.

---

### 12.9 Verifikasi Hasil Packing

**Siapa:** HEAD_PACKING, ADMIN

1. Klik menu **Packing Jobs**
2. Filter atau cari packing job dengan status `SUBMITTED`
3. Buka detail packing job
4. Review hasil: qty ready, qty reject, alasan reject
5. Jika sudah sesuai, klik **Verifikasi**
6. Tambahkan catatan verifikasi jika perlu

**Status → `VERIFIED`**

> **Catatan:** Status Incoming Goods **tidak otomatis** berubah. OPERASIONAL harus menjalankan langkah 12.10 secara manual.

---

### 12.10 Selesaikan Incoming Goods

**Siapa:** OPERASIONAL, ADMIN

1. Buka menu **Incoming Goods**
2. Buka detail dokumen berstatus `PACKING_IN_PROGRESS`
3. Pastikan **semua** Packing Job terkait sudah `VERIFIED`
4. Klik **Selesaikan / Complete**
5. Konfirmasi aksi

**Yang terjadi otomatis:**
- Status → `COMPLETED`
- Sistem mengagregasi total `qtyReady` dan `qtyReject` dari semua PackingResult ke setiap item
- Waktu selesai (`completedAt`) dicatat

> Jika masih ada Packing Job yang belum `VERIFIED`, tombol tidak akan bisa diklik.

---

### 12.11 Lihat Form Anak Packing

**Siapa:** HR, HEAD_PACKING, OPERASIONAL, CEO, ADMIN

Form Anak Packing adalah rekap detail hasil packing per worker. Berguna untuk:
- Perhitungan upah/bonus berdasarkan output packing
- Dokumentasi kinerja tim
- Keperluan audit/HR

1. Klik menu **Form Anak Packing** di sidebar
2. Daftar form tampil — bisa difilter berdasarkan tanggal, worker, atau packing job
3. Klik **Detail** untuk melihat detail form satu worker:
   - Nama worker
   - Packing Job terkait
   - Total qty dipacking, total ready, total reject
   - Snapshot detail hasil per item

---

## 13. Manajemen User

**Siapa:** ADMIN, COMPANY_ADMIN, SUPER_ADMIN

### Membuat User Baru

1. Klik menu **Users** di sidebar
2. Klik **+ Tambah User**
3. Isi data:

   | Field | Keterangan |
   |---|---|
   | Nama Lengkap | Nama tampilan user |
   | Email | Digunakan untuk login |
   | Password | Minimal 8 karakter |
   | Role | Pilih sesuai jabatan |
   | Status Aktif | Aktifkan agar bisa login |

4. Klik **Simpan**

### Mengubah / Menonaktifkan User

1. Klik ikon **Edit** pada baris user
2. Ubah data yang diperlukan
3. Untuk menonaktifkan: matikan toggle **Status Aktif**
4. Klik **Simpan**

User yang tidak aktif tidak bisa login meskipun password benar.

### Panduan Memilih Role

| Jabatan | Role yang Tepat |
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
4. Isi: nama perusahaan, slug (contoh: `pt-maju-jaya`), tanggal expired langganan
5. Klik **Simpan**

Setelah perusahaan dibuat, buat user pertama (ADMIN) melalui menu **Users**.

### Status Perusahaan

| Status | Efek |
|---|---|
| `active` | Perusahaan bisa menggunakan sistem |
| `inactive` | Semua user perusahaan tidak bisa login |
| `suspended` | Akses diblokir (contoh: tagihan belum dibayar) |

Edit status melalui ikon Edit pada baris perusahaan.

---

## 15. Scan QR & Barcode

Fitur scan digunakan untuk mempercepat identifikasi produk tanpa mengetik manual.

### Menggunakan Scanner

1. Di halaman yang mendukung scan (Opname, Packing), klik ikon **Scan QR**
2. Modal kamera terbuka
3. Arahkan kamera ke QR code atau barcode produk
4. Sistem otomatis mengenali produk dan mengisi field yang relevan

### Mencetak Label QR untuk Scan

Agar produk fisik bisa di-scan, tempelkan label QR yang dicetak dari sistem:

1. Masuk ke halaman **Detail Produk** atau **Edit Produk**
2. Di tabel SKU, klik ikon **QR** pada SKU yang ingin dicetak
3. Pilih ukuran label dan jumlah copy
4. Klik **Print**

Lihat detail lengkap di bagian [4.4 Mencetak Label QR Thermal](#44-mencetak-label-qr-thermal).

> **Tips:** Gunakan printer thermal (contoh: Zebra, Xprinter, Brother QL) untuk hasil terbaik dan paling ekonomis. Label yang dicetak di kertas biasa juga bisa digunakan.

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
  ▼ (Semua Packing Job VERIFIED → OPERASIONAL klik Selesaikan)
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

- **Pagination:** Semua halaman list menampilkan info "Showing X–Y of Z results" di bagian bawah tabel. Navigasi halaman muncul otomatis saat data lebih dari satu halaman.
- **Filter & Search:** Gunakan kombinasi filter + search untuk menemukan data lebih cepat. Tombol Reset Filter muncul saat ada filter aktif.
- **Sort Kolom:** Di halaman Produk, klik header kolom **Produk** atau **Stok** untuk mengurutkan.
- **QR Selalu Terlihat:** Tombol QR di tabel SKU tidak perlu di-hover — langsung klik kapan saja.
- **Label Thermal Presisi:** Gunakan `@page` CSS bawaan sistem — ukuran label yang dicetak persis sesuai pilihan (30×20 sampai 80×50 mm).
- **Notifikasi Toast:** Setiap aksi berhasil atau gagal menampilkan notifikasi di pojok layar.
- **Data Terisolasi:** Setiap perusahaan hanya melihat datanya sendiri — tidak ada kebocoran data antar tenant.
- **Audit Trail:** Setiap pergerakan stok tercatat di menu Movements. Gunakan ini untuk menelusuri selisih stok.
- **Dashboard Hari Ini:** Badge "N total pergerakan barang hari ini" di Dashboard diperbarui setiap kali halaman dimuat.
