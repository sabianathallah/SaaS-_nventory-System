# Dokumentasi SaaS Inventory System

## Daftar Isi

1. [Gambaran Umum](#1-gambaran-umum)
2. [Teknologi yang Digunakan](#2-teknologi-yang-digunakan)
3. [Struktur Project](#3-struktur-project)
4. [Sistem Role & Hak Akses](#4-sistem-role--hak-akses)
5. [Panduan Instalasi](#5-panduan-instalasi)
6. [Tutorial Penggunaan](#6-tutorial-penggunaan)
   - [Login](#61-login)
   - [Manajemen Produk & Kategori](#62-manajemen-produk--kategori)
   - [Manajemen Gudang & Stok](#63-manajemen-gudang--stok)
   - [Stock In (Barang Masuk)](#64-stock-in-barang-masuk)
   - [Stock Out (Barang Keluar)](#65-stock-out-barang-keluar)
   - [Stock Opname](#66-stock-opname)
   - [Modul Packing (Alur Lengkap)](#67-modul-packing-alur-lengkap)
   - [Manajemen User & Perusahaan](#68-manajemen-user--perusahaan)
7. [API Reference](#7-api-reference)
8. [Struktur Database](#8-struktur-database)

---

## 1. Gambaran Umum

**SaaS Inventory System** adalah sistem manajemen inventaris berbasis web yang dirancang untuk perusahaan manufaktur/distribusi. Sistem ini bersifat **multi-tenant** (satu aplikasi dapat digunakan oleh banyak perusahaan secara bersamaan, dengan data yang terpisah).

### Fitur Utama

| Modul | Deskripsi |
|---|---|
| **Inventaris** | Kelola produk, kategori, gudang, dan level stok |
| **Transaksi Stok** | Pencatatan barang masuk (Stock In) dan keluar (Stock Out) |
| **Stock Opname** | Hitung fisik stok dan rekonsiliasi selisih |
| **Packing** | Alur kerja packing dari penerimaan barang vendor hingga selesai |
| **Surat Jalan** | Pembuatan dan pencetakan surat jalan otomatis |
| **Multi-Tenant** | Satu sistem untuk banyak perusahaan, data terisolasi per perusahaan |
| **QR/Barcode** | Scan QR code dan barcode untuk verifikasi produk |
| **Dashboard** | Statistik dan laporan real-time |

---

## 2. Teknologi yang Digunakan

### Backend (Server)
- **Runtime**: Node.js
- **Framework**: Express.js 5.x
- **Database**: PostgreSQL
- **ORM**: Sequelize 6.x
- **Autentikasi**: JWT (JSON Web Token)
- **Enkripsi Password**: bcryptjs

### Frontend (Client)
- **Framework**: React 19 + Vite
- **Routing**: React Router DOM 6
- **HTTP Client**: Axios
- **Styling**: TailwindCSS
- **Icons**: Lucide React
- **Notifikasi**: React Hot Toast
- **Chart**: Recharts
- **QR Scan**: ZXing
- **State Management**: React Context + TanStack React Query

---

## 3. Struktur Project

```
SaaS-_nventory-System/
├── client/                        # Frontend (React)
│   └── src/
│       ├── api/                   # Konfigurasi Axios + API calls
│       ├── components/            # Komponen reusable (Layout, Modal, QRScanner, dll)
│       ├── context/               # AuthContext (state user login)
│       └── pages/                 # Halaman-halaman utama aplikasi
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── Products.jsx
│           ├── Categories.jsx
│           ├── Warehouses.jsx
│           ├── Suppliers.jsx
│           ├── Stocks.jsx
│           ├── StockIn.jsx
│           ├── StockOut.jsx
│           ├── Movements.jsx
│           ├── Opname.jsx
│           ├── Vendors.jsx
│           ├── IncomingGoods.jsx
│           ├── SuratJalan.jsx
│           ├── PackingJobs.jsx
│           ├── FormAnakPacking.jsx
│           ├── Users.jsx
│           └── Companies.jsx
│
└── server/                        # Backend (Express)
    ├── app.js                     # Konfigurasi Express
    ├── bin/www.js                 # Entry point server
    ├── config/config.json         # Konfigurasi database
    ├── controllers/               # Business logic per modul
    ├── helpers/                   # Utility (JWT, bcrypt, tenancy, docNumber)
    ├── middlewares/               # Auth, authorization, role checks
    ├── migrations/                # Migrasi database
    ├── models/                    # Model Sequelize
    ├── routes/                    # Definisi endpoint API
    └── seeders/                   # Data awal untuk development
```

---

## 4. Sistem Role & Hak Akses

Sistem menggunakan **Role-Based Access Control (RBAC)**. Setiap user memiliki satu role yang menentukan apa yang bisa mereka akses.

### Daftar Role

| Role | Level | Deskripsi |
|---|---|---|
| `SUPER_ADMIN` | Global | Admin sistem, mengelola semua perusahaan dan user |
| `ADMIN` | Perusahaan | Admin perusahaan, mengelola semua fitur dan user dalam perusahaan |
| `COMPANY_ADMIN` | Perusahaan | Sama dengan ADMIN |
| `CEO` | Perusahaan | Akses view-only ke semua modul |
| `OPERASIONAL` | Perusahaan | Mengelola stok, barang masuk vendor, dan transaksi gudang |
| `PRODUKSI` | Perusahaan | Melihat barang masuk dan packing, mencetak surat jalan |
| `HEAD_PACKING` | Perusahaan | Memimpin tim packing, membuat & memverifikasi packing job |
| `TIM_PACKING` | Perusahaan | Melaksanakan packing job, submit hasil packing |
| `HR` | Perusahaan | Melihat form anak packing (untuk keperluan penggajian/absensi) |

### Matriks Akses per Modul

| Modul | SUPER_ADMIN | ADMIN | CEO | OPERASIONAL | PRODUKSI | HEAD_PACKING | TIM_PACKING | HR |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Produk & Kategori | ✅ | ✅ | 👁️ | ✅ | 👁️ | 👁️ | - | - |
| Gudang & Stok | ✅ | ✅ | 👁️ | ✅ | - | - | - | - |
| Stock In / Out | ✅ | ✅ | 👁️ | ✅ | - | - | - | - |
| Stock Opname | ✅ | ✅ | 👁️ | ✅ | - | - | - | - |
| Vendor | ✅ | ✅ | 👁️ | ✅ | - | 👁️ | - | - |
| Incoming Goods | ✅ | ✅ | 👁️ | ✅ | 👁️ | 👁️ | - | - |
| Surat Jalan | ✅ | ✅ | 👁️ | ✅ | 🖨️ | 👁️ | - | - |
| Packing Jobs | ✅ | ✅ | 👁️ | 👁️ | - | ✅ | ✅ | - |
| Form Anak Packing | ✅ | ✅ | 👁️ | 👁️ | - | 👁️ | 👁️ | 👁️ |
| Manajemen User | ✅ | ✅ | - | - | - | - | - | - |
| Manajemen Perusahaan | ✅ | - | - | - | - | - | - | - |

> **Keterangan:** ✅ = Akses penuh, 👁️ = View only, 🖨️ = Bisa cetak, - = Tidak ada akses

---

## 5. Panduan Instalasi

### Prasyarat

Pastikan sudah terinstall:
- Node.js (v18 atau lebih baru)
- PostgreSQL (v14 atau lebih baru)
- npm atau yarn

### Langkah Instalasi

#### 1. Clone / Download Project

```bash
cd /path/ke/project
```

#### 2. Setup Database

Buat database PostgreSQL:
```sql
CREATE DATABASE "SaaS_Inventory_System";
```

Edit konfigurasi database di `server/config/config.json`:
```json
{
  "development": {
    "username": "postgres",
    "password": "your_password",
    "database": "SaaS_Inventory_System",
    "host": "127.0.0.1",
    "dialect": "postgresql"
  }
}
```

#### 3. Setup Backend (Server)

```bash
cd server
npm install

# Jalankan semua migrasi database
npx sequelize-cli db:migrate

# (Opsional) Isi data awal untuk development
npx sequelize-cli db:seed:all
```

#### 4. Setup Frontend (Client)

```bash
cd client
npm install
```

#### 5. Jalankan Aplikasi

Buka dua terminal:

**Terminal 1 - Backend:**
```bash
cd server
npm start
# Server berjalan di http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
# Frontend berjalan di http://localhost:5173
```

#### 6. Akun Default (setelah seeding)

Setelah menjalankan seeder, gunakan kredensial berikut:

| Role | Email | Password |
|---|---|---|
| SUPER_ADMIN | admin@system.com | (lihat seeder) |
| ADMIN (Demo Company) | admin@demo.com | (lihat seeder) |

---

## 6. Tutorial Penggunaan

### 6.1 Login

1. Buka browser, akses `http://localhost:5173`
2. Masukkan **Email** dan **Password**
3. Klik tombol **Login**

Sistem akan melakukan validasi:
- Email dan password harus benar
- Akun user harus aktif (`isActive = true`)
- Perusahaan user harus berstatus `active`
- Langganan perusahaan belum expired

Setelah berhasil login, Anda akan diarahkan ke halaman **Dashboard**.

> **Catatan:** Token login tersimpan di `localStorage`. Jika ingin logout, klik tombol Logout di navbar/sidebar.

---

### 6.2 Manajemen Produk & Kategori

#### Membuat Kategori Baru

1. Buka menu **Kategori** di sidebar
2. Klik tombol **Tambah Kategori**
3. Isi nama kategori
4. Klik **Simpan**

#### Membuat Produk Baru

1. Buka menu **Produk** di sidebar
2. Klik tombol **Tambah Produk**
3. Isi detail produk:
   - **Nama Produk**: Nama lengkap produk
   - **SKU**: Kode unik produk (contoh: `PRD-001`)
   - **Barcode**: Nomor barcode produk (opsional)
   - **Kategori**: Pilih kategori yang sesuai
   - **Satuan**: Unit pengukuran (pcs, kg, liter, dll)
4. Klik **Simpan**

Setiap produk otomatis mendapatkan **QR Code** yang bisa dicetak sebagai label.

#### Mencetak Label QR

1. Di halaman Produk, klik ikon **QR** pada baris produk
2. Label QR akan tampil di modal
3. Klik **Print** untuk mencetak

---

### 6.3 Manajemen Gudang & Stok

#### Membuat Gudang Baru

1. Buka menu **Gudang** di sidebar
2. Klik **Tambah Gudang**
3. Isi nama dan lokasi gudang
4. Klik **Simpan**

#### Melihat Level Stok

1. Buka menu **Stok** di sidebar
2. Anda dapat melihat stok setiap produk per gudang
3. Gunakan filter untuk mencari produk atau gudang tertentu

---

### 6.4 Stock In (Barang Masuk)

Digunakan untuk mencatat penerimaan barang dari supplier ke gudang.

1. Buka menu **Stock In** di sidebar
2. Klik **Tambah Stock In**
3. Isi header transaksi:
   - **Tanggal**: Tanggal penerimaan
   - **Supplier**: Pilih supplier
   - **Catatan**: Keterangan tambahan (opsional)
4. Tambahkan detail barang:
   - **Produk**: Pilih produk
   - **Gudang**: Pilih gudang tujuan
   - **Jumlah**: Kuantitas yang diterima
5. Klik **Simpan**

Setelah disimpan, stok produk di gudang yang dipilih akan **bertambah** secara otomatis, dan sebuah record `Stock Movement` dengan tipe **IN** akan dicatat sebagai audit trail.

---

### 6.5 Stock Out (Barang Keluar)

Digunakan untuk mencatat pengiriman/pengeluaran barang dari gudang.

1. Buka menu **Stock Out** di sidebar
2. Klik **Tambah Stock Out**
3. Isi header transaksi:
   - **Tanggal**: Tanggal pengeluaran
   - **Tujuan**: Ke mana barang dikirim
   - **Catatan**: Keterangan tambahan
4. Tambahkan detail barang:
   - **Produk**: Pilih produk
   - **Gudang**: Pilih gudang asal
   - **Jumlah**: Kuantitas yang dikeluarkan
5. Klik **Simpan**

Stok produk akan **berkurang** dan record `Stock Movement` dengan tipe **OUT** akan dicatat.

---

### 6.6 Stock Opname

Stock Opname adalah proses menghitung stok fisik di gudang dan membandingkannya dengan data sistem.

#### Membuat Sesi Opname

1. Buka menu **Opname** di sidebar
2. Klik **Buat Sesi Opname Baru**
3. Pilih **Gudang** yang akan di-opname
4. Tambahkan catatan (opsional)
5. Klik **Mulai Opname**

#### Melakukan Perhitungan

1. Di dalam sesi opname, scan QR/barcode produk atau cari manual
2. Masukkan **jumlah fisik** yang dihitung
3. Sistem akan menampilkan:
   - **Qty Sistem**: Stok menurut data sistem
   - **Qty Scan**: Jumlah yang Anda hitung
   - **Selisih**: Perbedaan antara sistem dan fisik
4. Ulangi untuk semua produk

#### Menyelesaikan Opname

1. Setelah semua produk dihitung, klik **Selesaikan Opname**
2. Sistem akan menyimpan hasil dan mencatat selisih
3. Penyesuaian stok dapat dilakukan berdasarkan hasil opname

---

### 6.7 Modul Packing (Alur Lengkap)

Modul packing memiliki alur kerja yang melibatkan beberapa peran. Berikut alur lengkapnya:

```
OPERASIONAL                HEAD_PACKING               TIM_PACKING
     |                          |                          |
     ▼                          |                          |
[1] Buat Incoming Goods         |                          |
     |                          |                          |
     ▼                          |                          |
[2] Konfirmasi Vendor           |                          |
     (Surat Jalan dibuat otomatis)                         |
     |                          |                          |
     ▼                          |                          |
[3] Notify Production ──────────►                          |
                                |                          |
                                ▼                          |
                       [4] Buat Packing Job ──────────────►|
                                                           |
                                                           ▼
                                                  [5] Mulai Packing
                                                           |
                                                           ▼
                                                  [6] Submit Hasil
                                                           |
                                HEAD_PACKING ◄─────────────┘
                                     |
                                     ▼
                              [7] Verifikasi Hasil
                                     |
                                     ▼
                              [COMPLETED] ✅
```

---

#### Step 1: Setup Vendor (OPERASIONAL)

Sebelum mencatat barang masuk, pastikan vendor sudah terdaftar.

1. Buka menu **Vendor** di sidebar
2. Klik **Tambah Vendor**
3. Isi data vendor:
   - **Nama Vendor**
   - **Kode Vendor** (contoh: `VND-001`)
   - **Kontak / PIC**
   - **Nomor Telepon**
   - **Email**
   - **Alamat**
4. Klik **Simpan**

---

#### Step 2: Buat Incoming Goods (OPERASIONAL)

Ketika barang dari vendor tiba:

1. Buka menu **Incoming Goods** di sidebar
2. Klik **Tambah Incoming Goods**
3. Isi data penerimaan:
   - **Vendor**: Pilih vendor pengirim
   - **Tanggal Terima**: Tanggal barang diterima
   - **No. Surat Jalan Vendor**: Nomor SJ dari vendor
   - **Diterima Oleh**: User yang menerima
4. Tambahkan item barang:
   - **Produk**: Pilih produk
   - **Qty Dipesan**: Jumlah yang dipesan
   - **Qty Diterima**: Jumlah aktual yang diterima
   - **Qty Siap**: Jumlah yang siap diproses
   - **Qty Reject**: Jumlah yang ditolak/reject
   - **Satuan**: Unit barang
   - **Catatan**: Keterangan per item
5. Klik **Simpan**

Status awal: **DRAFT**

---

#### Step 3: Konfirmasi Vendor (OPERASIONAL)

Setelah data incoming goods disimpan:

1. Di halaman Incoming Goods, buka detail dokumen
2. Klik tombol **Konfirmasi Vendor**
3. Masukkan konfirmasi (nomor dokumen vendor, dll)
4. Klik **Konfirmasi**

**Yang terjadi secara otomatis:**
- Status berubah menjadi **VENDOR_CONFIRMED**
- Sistem membuat **Surat Jalan** otomatis dengan nomor dokumen (format: `SJ-XXXX`)
- Snapshot item disimpan ke dalam surat jalan

---

#### Step 4: Notify Production (OPERASIONAL)

1. Di detail Incoming Goods yang sudah VENDOR_CONFIRMED
2. Klik tombol **Notify Production**
3. Konfirmasi aksi

Status berubah menjadi: **PRODUCTION_NOTIFIED**

Setelah status ini, HEAD_PACKING dapat mulai membuat Packing Job.

---

#### Step 5: Cetak Surat Jalan (OPERASIONAL / PRODUKSI)

1. Buka menu **Surat Jalan** di sidebar
2. Cari surat jalan yang ingin dicetak
3. Klik **Cetak** / **Print**
4. Browser akan membuka dialog print
5. Sistem mencatat waktu cetakan (`printedAt`)

---

#### Step 6: Buat Packing Job (HEAD_PACKING)

1. Buka menu **Packing Jobs** di sidebar
2. Klik **Buat Packing Job Baru**
3. Isi detail packing job:
   - **Incoming Goods**: Pilih dokumen incoming goods yang relevan
   - **Ditugaskan Ke**: Pilih worker (TIM_PACKING) yang akan mengerjakan
   - **Catatan**: Instruksi khusus (opsional)
4. Klik **Simpan**

Status awal packing job: **PENDING**

---

#### Step 7: Mulai Packing (TIM_PACKING)

1. Worker membuka menu **Packing Jobs**
2. Cari packing job yang ditugaskan
3. Klik **Mulai** / **Start**
4. Status berubah menjadi: **IN_PROGRESS**

---

#### Step 8: Submit Hasil Packing (TIM_PACKING)

Setelah selesai mengerjakan packing:

1. Buka detail packing job
2. Untuk setiap item, masukkan:
   - **Qty Ready**: Jumlah item yang berhasil dipacking
   - **Qty Reject**: Jumlah item yang reject
   - **Alasan Reject**: Alasan penolakan (jika ada reject)
   - **Barcode Scan**: Scan barcode item untuk verifikasi
3. Klik **Submit** setelah semua item terisi
4. Status berubah menjadi: **SUBMITTED**

---

#### Step 9: Verifikasi Packing (HEAD_PACKING)

1. HEAD_PACKING membuka menu **Packing Jobs**
2. Filter packing job dengan status **SUBMITTED**
3. Buka detail packing job
4. Review hasil packing: qty ready, reject, dan alasan
5. Jika sudah sesuai, klik **Verifikasi**
6. Status berubah menjadi: **VERIFIED**

Setelah semua packing job diverifikasi, OPERASIONAL harus menutup dokumen secara manual dengan klik **Selesaikan** di detail Incoming Goods. Status berubah menjadi **COMPLETED** dan sistem mengagregasi total `qtyReady`/`qtyReject` per item.

---

#### Step 10: Lihat Form Anak Packing (HR / HEAD_PACKING)

Form Anak Packing adalah rekap detail per-worker yang berguna untuk:
- Perhitungan upah/bonus packing
- Dokumentasi kinerja tim packing
- Rekap hasil per sesi packing

1. Buka menu **Form Anak Packing**
2. Pilih periode atau packing job tertentu
3. Data yang tampil:
   - Nama worker
   - Total qty yang dipacking
   - Total qty ready
   - Total qty reject
   - Snapshot detail per item

---

### 6.8 Manajemen User & Perusahaan

> Fitur ini hanya tersedia untuk role **ADMIN**, **COMPANY_ADMIN**, dan **SUPER_ADMIN**.

#### Membuat User Baru (ADMIN)

1. Buka menu **Users** di sidebar
2. Klik **Tambah User**
3. Isi data user:
   - **Nama Lengkap**
   - **Email** (akan digunakan untuk login)
   - **Password** (minimal 8 karakter)
   - **Role**: Pilih role yang sesuai
   - **Status**: Aktif / Tidak Aktif
4. Klik **Simpan**

User baru langsung bisa login dengan email dan password yang dibuat.

#### Menonaktifkan User

1. Di halaman Users, klik **Edit** pada user yang ingin dinonaktifkan
2. Ubah status **isActive** menjadi `false`
3. Klik **Simpan**

User yang tidak aktif tidak bisa login ke sistem.

#### Manajemen Perusahaan (SUPER_ADMIN)

1. Buka menu **Companies** di sidebar
2. Dari sini SUPER_ADMIN dapat:
   - Melihat semua perusahaan yang terdaftar
   - Membuat perusahaan baru
   - Mengubah status perusahaan (active/inactive/suspended)
   - Mengatur tanggal expired langganan

---

## 7. API Reference

Semua endpoint dilindungi dengan JWT. Sertakan header:
```
Authorization: Bearer <token>
```

### Autentikasi

| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/login` | Login dengan email & password |
| POST | `/refresh-token` | Refresh JWT token |

### Inventaris

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET/POST | `/api/categories` | List / buat kategori |
| GET/PUT/DELETE | `/api/categories/:id` | Detail / update / hapus kategori |
| GET/POST | `/api/products` | List / buat produk |
| GET/PUT/DELETE | `/api/products/:id` | Detail / update / hapus produk |
| GET/POST | `/api/warehouses` | List / buat gudang |
| GET/POST | `/api/suppliers` | List / buat supplier |
| GET/POST | `/api/stocks` | List / update stok |
| GET/POST | `/api/stock-in-headers` | List / buat transaksi stock in |
| GET/POST | `/api/stock-out-headers` | List / buat transaksi stock out |
| GET | `/api/stock-movements` | Riwayat pergerakan stok |
| GET/POST | `/api/stock-opname-sessions` | List / buat sesi opname |
| GET/POST | `/api/stock-opname-items` | Detail item opname |

### Modul Packing

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET/POST | `/api/vendors` | List / buat vendor |
| PUT/DELETE | `/api/vendors/:id` | Update / hapus vendor |
| GET/POST | `/api/incoming-goods` | List / buat incoming goods |
| GET | `/api/incoming-goods/:id` | Detail incoming goods |
| PUT | `/api/incoming-goods/:id` | Update incoming goods |
| DELETE | `/api/incoming-goods/:id` | Hapus incoming goods |
| PUT | `/api/incoming-goods/:id/items/:itemId` | Update item |
| POST | `/api/incoming-goods/:id/confirm-vendor` | Konfirmasi vendor |
| POST | `/api/incoming-goods/:id/notify-production` | Notify produksi + buat SJ |
| POST | `/api/incoming-goods/:id/complete` | Selesaikan |
| GET | `/api/surat-jalan` | List surat jalan |
| GET | `/api/surat-jalan/:id` | Detail surat jalan |
| POST | `/api/surat-jalan/:id/print` | Tandai sudah dicetak |
| GET/POST | `/api/packing-jobs` | List / buat packing job |
| GET | `/api/packing-jobs/:id` | Detail packing job |
| POST | `/api/packing-jobs/:id/start` | Mulai packing |
| POST | `/api/packing-jobs/:id/submit` | Submit hasil |
| POST | `/api/packing-jobs/:id/verify` | Verifikasi |
| GET | `/api/form-anak-packing` | List form anak packing |
| GET | `/api/form-anak-packing/:id` | Detail form |

### Admin

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET/POST | `/api/users` | List / buat user |
| PUT/DELETE | `/api/users/:id` | Update / hapus user |
| GET/POST | `/api/companies` | List / buat perusahaan |
| PUT | `/api/companies/:id` | Update perusahaan |

---

## 8. Struktur Database

### Diagram Relasi

```
Company ──< User
Company ──< Category
Company ──< Warehouse
Company ──< Supplier
Company ──< Product >── Category

Product ──< Stock >── Warehouse
Product ──< StockMovement >── Warehouse
Supplier ──< StockInHeader

Company ──< Vendor
Vendor ──< IncomingGoods >── User (receivedBy)
IncomingGoods ──< IncomingGoodsItem >── Product
IncomingGoods ──< SuratJalan >── User (generatedBy)
IncomingGoods ──< PackingJob >── User (assignedTo, assignedBy, verifiedBy)
PackingJob ──< PackingResult >── IncomingGoodsItem
PackingJob ──< FormAnakPacking

Company ──< StockOpnameSession >── Warehouse
StockOpnameSession ──< StockOpnameItem >── Product
```

### Status Flow

**Incoming Goods:**
```
DRAFT → VENDOR_CONFIRMED (+ SJ otomatis) → PRODUCTION_NOTIFIED → PACKING_IN_PROGRESS → COMPLETED
```

**Packing Job:**
```
PENDING → IN_PROGRESS → SUBMITTED → VERIFIED
```

**Company:**
```
active ↔ inactive ↔ suspended
```

---

## Catatan Pengembangan

- Semua data terfilter otomatis berdasarkan `companyId` user yang login (kecuali SUPER_ADMIN)
- Nomor dokumen di-generate otomatis oleh server (contoh: `SJ-0001`, `BM-0001`)
- Token JWT expired setelah durasi tertentu; gunakan `/refresh-token` untuk memperbarui
- Semua transaksi stok menciptakan record di tabel `stock_movements` sebagai audit trail
