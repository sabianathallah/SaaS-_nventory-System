# Dokumentasi SaaS Inventory System

## Daftar Isi

1. [Gambaran Umum](#1-gambaran-umum)
2. [Teknologi yang Digunakan](#2-teknologi-yang-digunakan)
3. [Struktur Project](#3-struktur-project)
4. [Sistem Role & Hak Akses](#4-sistem-role--hak-akses)
5. [Panduan Instalasi](#5-panduan-instalasi)
6. [Fitur-Fitur Utama](#6-fitur-fitur-utama)
   - [Dashboard](#61-dashboard)
   - [Produk](#62-produk)
   - [Katalog (Kategori & Artikel)](#63-katalog-kategori--artikel)
   - [Gudang & Warehouse Products](#64-gudang--warehouse-products)
   - [Supplier](#65-supplier)
   - [Stock In](#66-stock-in)
   - [Stock Out](#67-stock-out)
   - [Movements (Pergerakan Stok)](#68-movements-pergerakan-stok)
   - [Stock Opname](#69-stock-opname)
   - [QR Code & Label Thermal](#610-qr-code--label-thermal)
   - [Modul Packing](#611-modul-packing)
   - [Manajemen User & Perusahaan](#612-manajemen-user--perusahaan)
7. [Komponen UI Reusable](#7-komponen-ui-reusable)
8. [API Reference](#8-api-reference)
9. [Struktur Database](#9-struktur-database)

---

## 1. Gambaran Umum

**SaaS Inventory System** adalah sistem manajemen inventaris berbasis web yang dirancang untuk perusahaan manufaktur/distribusi. Sistem ini bersifat **multi-tenant** (satu aplikasi dapat digunakan oleh banyak perusahaan secara bersamaan, dengan data yang terpisah per perusahaan).

### Fitur Utama

| Modul | Deskripsi |
|---|---|
| **Inventaris** | Kelola produk beserta variant, SKU, foto, kategori, artikel, gudang, dan level stok |
| **Transaksi Stok** | Pencatatan barang masuk (Stock In) dan keluar (Stock Out) |
| **Stock Opname** | Hitung fisik stok dan rekonsiliasi selisih |
| **Packing** | Alur kerja packing dari penerimaan barang vendor hingga selesai |
| **Surat Jalan** | Pembuatan dan pencetakan surat jalan otomatis |
| **QR/Label Thermal** | Generate QR per SKU, cetak label dalam berbagai ukuran thermal |
| **Multi-Tenant** | Satu sistem untuk banyak perusahaan, data terisolasi per perusahaan |
| **Dashboard** | Statistik real-time termasuk pergerakan stok hari ini |

---

## 2. Teknologi yang Digunakan

### Backend (Server)
- **Runtime**: Node.js
- **Framework**: Express.js 5.x
- **Database**: PostgreSQL
- **ORM**: Sequelize 6.x
- **Autentikasi**: JWT (JSON Web Token)
- **Enkripsi Password**: bcryptjs
- **Upload Gambar**: Cloudinary

### Frontend (Client)
- **Framework**: React 19 + Vite
- **Routing**: React Router DOM 6
- **HTTP Client**: Axios
- **Styling**: TailwindCSS
- **Icons**: Lucide React
- **Notifikasi**: React Hot Toast
- **Chart**: Recharts
- **QR Generate**: react-qr-code
- **QR Scan**: ZXing
- **State Management**: React Context + TanStack React Query v5

---

## 3. Struktur Project

```
SaaS-_nventory-System/
├── client/                        # Frontend (React)
│   └── src/
│       ├── api/                   # Konfigurasi Axios + API calls
│       ├── components/            # Komponen reusable
│       │   ├── Layout.jsx         # Sidebar + header wrapper
│       │   ├── Modal.jsx          # Modal dialog
│       │   ├── Table.jsx          # Table + Pagination component
│       │   ├── SearchBar.jsx      # Search input
│       │   ├── PageHeader.jsx     # Header halaman
│       │   ├── QrModal.jsx        # Modal QR print dengan pilihan ukuran thermal
│       │   └── QRScanner.jsx      # Kamera scanner QR/barcode
│       ├── context/               # AuthContext (state user login)
│       └── pages/                 # Halaman-halaman utama aplikasi
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── Products.jsx           # Daftar produk (filter, sort, pagination)
│           ├── ProductDetail.jsx      # Detail produk (read-only)
│           ├── ProductEdit.jsx        # Edit/buat produk (terpisah dari detail)
│           ├── Catalog.jsx            # Kategori & artikel (dengan search + pagination)
│           ├── Warehouses.jsx
│           ├── WarehouseProducts.jsx  # Daftar produk per gudang
│           ├── Suppliers.jsx
│           ├── StockIn.jsx
│           ├── StockInDetail.jsx
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
    ├── app.js                     # Konfigurasi Express + CORS
    ├── bin/www.js                 # Entry point server
    ├── config/config.json         # Konfigurasi database
    ├── controllers/               # Business logic per modul
    ├── helpers/                   # Utility (JWT, bcrypt, tenancy, docNumber, queryHelper)
    ├── middlewares/               # Auth, authorization, role checks
    ├── migrations/                # Migrasi database Sequelize
    ├── models/                    # Model Sequelize
    ├── routes/                    # Definisi endpoint API
    └── seeders/                   # Data awal untuk development
```

### Routing Frontend

| Path | Komponen | Keterangan |
|---|---|---|
| `/` | Dashboard | Halaman utama |
| `/products` | Products | Daftar produk + filter + sort |
| `/products/new` | ProductEdit | Buat produk baru |
| `/products/:id` | ProductDetail | Detail produk (read-only) |
| `/products/:id/edit` | ProductEdit | Edit produk |
| `/catalog` | Catalog | Kelola kategori & artikel |
| `/warehouses` | Warehouses | Daftar gudang |
| `/warehouses/:id/products` | WarehouseProducts | Produk per gudang |
| `/suppliers` | Suppliers | Daftar supplier |
| `/stock-in` | StockIn | Daftar transaksi masuk |
| `/stock-in/:id` | StockInDetail | Buat/detail stock in |
| `/stock-out` | StockOut | Daftar transaksi keluar |
| `/movements` | Movements | Riwayat pergerakan stok |
| `/opname` | Opname | Stock opname |
| `/vendors` | Vendors | Daftar vendor packing |
| `/incoming-goods` | IncomingGoods | Incoming goods |
| `/surat-jalan` | SuratJalan | Surat jalan |
| `/packing-jobs` | PackingJobs | Packing jobs |
| `/form-anak-packing` | FormAnakPacking | Rekap per worker |
| `/users` | Users | Manajemen user |
| `/companies` | Companies | Manajemen perusahaan |

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
| Produk & Katalog | ✅ | ✅ | 👁️ | ✅ | 👁️ | 👁️ | - | - |
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

#### 1. Setup Database

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
    "dialect": "postgres"
  }
}
```

#### 2. Environment Variables

Buat file `.env` di folder `server/`:
```env
JWT_SECRET=your_jwt_secret_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

#### 3. Setup Backend

```bash
cd server
npm install

# Jalankan semua migrasi database
npx sequelize-cli db:migrate

# (Opsional) Isi data awal untuk development
npx sequelize-cli db:seed:all
```

#### 4. Setup Frontend

```bash
cd client
npm install
```

#### 5. Jalankan Aplikasi

**Terminal 1 — Backend:**
```bash
cd server
npm start
# Server berjalan di http://localhost:3000
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
# Frontend berjalan di http://localhost:5173
```

#### 6. Akun Default (setelah seeding)

| Role | Email | Password |
|---|---|---|
| SUPER_ADMIN | admin@system.com | (lihat seeder) |
| ADMIN (Demo Company) | admin@demo.com | (lihat seeder) |

---

## 6. Fitur-Fitur Utama

### 6.1 Dashboard

Dashboard menampilkan ringkasan real-time kondisi inventaris perusahaan:

- **Total Produk** — Jumlah jenis produk terdaftar
- **Total Stok** — Total unit dari semua SKU
- **Total Nilai Inventaris** — Estimasi nilai stok (harga × qty)
- **Stock & Nilai per Artikel** — Breakdown per artikel dengan progress bar
- **Stock per Gudang** — Bar chart distribusi stok antar gudang
- **Pergerakan Terbaru** — 10 pergerakan stok terakhir + badge **"N total pergerakan barang hari ini"** yang menghitung stock in/out hari ini secara real-time

---

### 6.2 Produk

#### Halaman Daftar Produk (`/products`)

- Tabel menampilkan: foto, nama, kategori, **variant beserta opsi-nya** (pills), jumlah SKU, range harga, total stok, total nilai stok
- **Sort** per kolom: nama produk atau total stok (klik header kolom)
- **Filter**: nama (search), kategori, artikel, gudang
- **Pagination** standar di bagian bawah tabel

#### Halaman Detail Produk (`/products/:id`) — Read-Only

Halaman ini **hanya untuk melihat**, tidak bisa mengedit apapun secara inline:
- Foto produk, nama, satuan, kategori, artikel, total stok
- Variant types dan opsi-opsinya (pills violet)
- Tabel SKU: variant, SKU code, harga, stok, nilai stok
- **Tombol QR** per SKU (selalu tampil, tidak perlu hover)
- Tombol **Ubah** → navigasi ke halaman edit
- Tombol **Hapus** produk

#### Halaman Edit Produk (`/products/:id/edit` dan `/products/new`)

Satu halaman untuk buat dan edit produk:
- Upload foto (Cloudinary)
- Nama, satuan (creatable select), kategori, artikel
- **VariantBuilder**: tambah/hapus tipe variant dan opsinya
- **SkuTable**: generate SKU dari kombinasi variant atau tambah manual
  - Edit harga dan qty langsung di tabel (auto-save saat blur)
  - Generate QR per SKU

---

### 6.3 Katalog (Kategori & Artikel)

Halaman `/catalog` mengelola dua referensi data sekaligus dalam satu tampilan dua kolom:

- **Kategori**: pengelompokan produk (contoh: Bahan Baku, Kemasan)
- **Artikel**: sub-klasifikasi produk (contoh: Kotak, Plastik, Karung)

Fitur per section:
- **Search** nama item
- **Edit inline** — klik nama item untuk langsung ubah, tekan Enter untuk simpan
- **Tambah baru** — tombol "+ Tambah baru" di bawah tabel
- **Hapus** — konfirmasi sebelum menghapus
- **Pagination** (15 item per halaman)

---

### 6.4 Gudang & Warehouse Products

#### Halaman Gudang (`/warehouses`)

- Tabel daftar gudang dengan nama dan lokasi
- Tombol **Produk** per baris → masuk ke halaman WarehouseProducts
- Tambah, edit, hapus gudang via modal

#### Halaman Produk per Gudang (`/warehouses/:id/products`)

Menampilkan semua produk yang memiliki stok di gudang tersebut:

- **3 Stat card**: Total Produk, Total Stok (unit), Total Nilai Stok
- **Search** nama produk
- **Tabel** dengan kolom: produk (foto + nama), kategori, variant, SKU, harga, stok, nilai stok
- **Sort** per kolom nama dan total stok
- **Pagination**
- Klik baris → navigasi ke detail produk

---

### 6.5 Supplier

- CRUD supplier melalui modal
- Search nama supplier
- Pagination

---

### 6.6 Stock In

- Daftar transaksi barang masuk dengan pagination
- Buat transaksi baru: header (tanggal, supplier, catatan) + detail per produk/gudang/jumlah
- Setiap simpan → stok bertambah + record Movement tipe `IN` dibuat otomatis

---

### 6.7 Stock Out

- Daftar transaksi barang keluar dengan pagination
- Buat transaksi baru: header + detail per produk/gudang/jumlah
- Setiap simpan → stok berkurang + record Movement tipe `OUT` dibuat otomatis
- Validasi stok mencukupi sebelum simpan

---

### 6.8 Movements (Pergerakan Stok)

- Riwayat seluruh pergerakan stok (IN / OUT / ADJUSTMENT)
- Filter berdasarkan tipe pergerakan dan gudang
- Pagination

---

### 6.9 Stock Opname

- Buat sesi opname per gudang
- Hitung fisik dan bandingkan dengan qty sistem
- Catat selisih (positif = lebih, negatif = kurang)
- Pagination daftar sesi

---

### 6.10 QR Code & Label Thermal

Setiap SKU memiliki tombol QR yang **selalu tampil** (tidak perlu hover). Klik tombol membuka **QrModal** dengan fitur:

#### Pilihan Ukuran Label

| ID | Ukuran | Cocok Untuk |
|---|---|---|
| 30×20 mm | Stiker kecil | Label kemasan kecil |
| 40×30 mm | Stiker sedang | Penggunaan umum |
| 50×40 mm | Stiker besar | Produk ukuran sedang |
| 58×40 mm | Thermal standar | Printer thermal 58mm |
| 80×50 mm | Label besar | Karton/box |

#### Cara Print

1. Klik ikon QR pada baris SKU
2. Pilih ukuran label yang sesuai
3. Isi **Jumlah Copy** (ketik langsung angka, 1–999)
4. Klik **Print N lembar**
5. Browser membuka print dialog — pastikan pilih printer thermal yang sesuai

Label yang dicetak berisi: **QR code + nama produk + SKU code**

CSS menggunakan `@page { size: Wmm Hmm; margin: 0 }` sehingga ukuran persis sesuai pilihan di semua printer thermal.

---

### 6.11 Modul Packing

Alur kerja packing melibatkan beberapa role:

```
OPERASIONAL → HEAD_PACKING → TIM_PACKING → HEAD_PACKING → OPERASIONAL
```

Detail alur lengkap ada di [TUTORIAL.md](./TUTORIAL.md) bagian Modul Packing.

**Status flow Incoming Goods:**
```
DRAFT → VENDOR_CONFIRMED → PRODUCTION_NOTIFIED → PACKING_IN_PROGRESS → COMPLETED
```

**Status flow Packing Job:**
```
PENDING → IN_PROGRESS → SUBMITTED → VERIFIED
```

---

### 6.12 Manajemen User & Perusahaan

- **Users** (ADMIN): buat, edit, aktifkan/nonaktifkan user per perusahaan
- **Companies** (SUPER_ADMIN): buat perusahaan, atur status (active/inactive/suspended), atur tanggal expired langganan

---

## 7. Komponen UI Reusable

### `Table` & `Pagination` (`src/components/Table.jsx`)

```jsx
import { Table, Pagination } from '../components/Table'

<Table columns={columns} data={rows} loading={isLoading} emptyText="Belum ada data" />
<Pagination pagination={data?.pagination} onPageChange={setPage} />
```

- **Pagination** selalu tampil jika ada data (`total > 0`)
- Tombol navigasi halaman hanya muncul jika `totalPages > 1`
- Menampilkan info "Showing X–Y of Z results"
- Pagination shape dari backend: `{ total, page, limit, totalPages }`

### `QrModal` (`src/components/QrModal.jsx`)

```jsx
import QrModal from '../components/QrModal'

{qrSku && (
  <QrModal
    sku={qrSku}            // { sku_code: '...' }
    skuName="Nama Produk"  // ditampilkan di label
    onClose={() => setQrSku(null)}
  />
)}
```

### `SearchBar` (`src/components/SearchBar.jsx`)

```jsx
<SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Cari…" />
```

### `Modal` (`src/components/Modal.jsx`)

```jsx
<Modal open={modal?.mode === 'create'} onClose={() => setModal(null)} title="Judul Modal" size="sm|md|lg">
  {/* konten */}
</Modal>
```

---

## 8. API Reference

Semua endpoint dilindungi dengan JWT. Sertakan header:
```
Authorization: Bearer <token>
```

Response paginated memiliki shape:
```json
{
  "data": [...],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

### Autentikasi

| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/login` | Login dengan email & password |
| POST | `/refresh-token` | Refresh JWT token |

### Inventaris

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET/POST | `/api/categories` | List (paginasi) / buat kategori |
| GET/PUT/DELETE | `/api/categories/:id` | Detail / update / hapus kategori |
| GET/POST | `/api/articles` | List (paginasi) / buat artikel |
| GET/PUT/DELETE | `/api/articles/:id` | Detail / update / hapus artikel |
| GET/POST | `/api/products` | List (paginasi, filter, sort) / buat produk |
| GET/PUT/DELETE | `/api/products/:id` | Detail / update / hapus produk |
| GET/POST | `/api/products/:id/variant-types` | List / buat tipe variant |
| DELETE | `/api/products/:id/variant-types/:tid` | Hapus tipe variant |
| POST | `/api/products/:id/variant-types/:tid/options` | Tambah opsi variant |
| DELETE | `/api/products/:id/variant-types/:tid/options/:oid` | Hapus opsi variant |
| GET/POST | `/api/products/:id/skus` | List / buat SKU |
| PUT/DELETE | `/api/products/:id/skus/:sid` | Update / hapus SKU |
| GET/POST | `/api/warehouses` | List / buat gudang |
| GET/PUT/DELETE | `/api/warehouses/:id` | Detail / update / hapus gudang |
| GET/POST | `/api/suppliers` | List / buat supplier |
| GET | `/api/stocks` | Level stok (filter WarehouseId, ProductId) |
| GET/POST | `/api/stock-in-headers` | List / buat transaksi stock in |
| GET/PUT/DELETE | `/api/stock-in-headers/:id` | Detail / update / hapus stock in |
| GET/POST | `/api/stock-out-headers` | List / buat transaksi stock out |
| GET | `/api/stock-movements` | Riwayat pergerakan stok |
| GET/POST | `/api/stock-opname-sessions` | List / buat sesi opname |
| GET | `/api/dashboard/stats` | Statistik dashboard termasuk `todayMovements` |

### Query Params Produk

| Param | Tipe | Keterangan |
|---|---|---|
| `name` | string | Filter nama (ILIKE) |
| `CategoryId` | number | Filter kategori |
| `ArticleId` | number | Filter artikel |
| `WarehouseId` | number | Filter gudang (EXISTS subquery) |
| `sortBy` | `name` \| `totalStock` \| `createdAt` | Kolom sort |
| `sortOrder` | `asc` \| `desc` | Arah sort |
| `page` | number | Halaman (default: 1) |
| `limit` | number | Item per halaman (default: 15, max: 100) |

### Modul Packing

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET/POST | `/api/vendors` | List / buat vendor |
| PUT/DELETE | `/api/vendors/:id` | Update / hapus vendor |
| GET/POST | `/api/incoming-goods` | List / buat incoming goods |
| GET/PUT/DELETE | `/api/incoming-goods/:id` | Detail / update / hapus |
| POST | `/api/incoming-goods/:id/confirm-vendor` | Konfirmasi vendor + buat SJ otomatis |
| POST | `/api/incoming-goods/:id/notify-production` | Notify produksi |
| POST | `/api/incoming-goods/:id/complete` | Selesaikan |
| GET | `/api/surat-jalan` | List surat jalan |
| POST | `/api/surat-jalan/:id/print` | Tandai sudah dicetak |
| GET/POST | `/api/packing-jobs` | List / buat packing job |
| POST | `/api/packing-jobs/:id/start` | Mulai packing |
| POST | `/api/packing-jobs/:id/submit` | Submit hasil |
| POST | `/api/packing-jobs/:id/verify` | Verifikasi |
| GET | `/api/form-anak-packing` | List form anak packing |

### Admin

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET/POST | `/api/users` | List / buat user |
| PUT/DELETE | `/api/users/:id` | Update / hapus user |
| GET/POST | `/api/companies` | List / buat perusahaan |
| PUT | `/api/companies/:id` | Update perusahaan |
| GET/PUT | `/api/role-permissions` | Kelola hak akses per role |

---

## 9. Struktur Database

### Diagram Relasi

```
Company ──< User
Company ──< Category
Company ──< Article
Company ──< Warehouse
Company ──< Supplier
Company ──< Product >── Category
                  └──> Article

Product ──< ProductVariantType ──< ProductVariantOption
Product ──< ProductSKU >──< ProductVariantOption (many-to-many)
Product ──< Stock >── Warehouse
Product ──< StockMovement >── Warehouse

Supplier ──< StockInHeader ──< StockInDetail >── Product

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
- Semua transaksi stok menciptakan record di tabel `Stock_Movements` sebagai audit trail
- `queryHelper.paginatedResponse` mengembalikan shape `{ data, pagination: { total, page, limit, totalPages } }`
- Halaman detail produk dan halaman edit produk adalah **dua route terpisah** (`/products/:id` vs `/products/:id/edit`)
- QR label dicetak menggunakan `@page { size: Wmm Hmm; margin: 0 }` untuk kompatibilitas thermal printer
