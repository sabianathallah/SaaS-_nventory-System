// Label, warna, dan format bersama untuk halaman Transfer Stok (list + detail)
export const TRANSFER_TYPES = [
  { value: 'TRANSFER',            label: 'Transfer Biasa',            short: 'Transfer Biasa' },
  { value: 'QC_REJECT_SEMENTARA', label: 'QC Reject → Gudang Sementara', short: 'QC Reject → Sementara' },
  { value: 'QC_REJECT_PERMANEN',  label: 'QC Reject → Tidak Bisa Diperbaiki', short: 'QC Reject → Permanen' },
  { value: 'LAINNYA',             label: 'Lainnya',                   short: 'Lainnya' },
]

export const TYPE_STYLE = {
  TRANSFER:            'bg-blue-50 text-blue-700 border-blue-100',
  QC_REJECT_SEMENTARA: 'bg-amber-50 text-amber-700 border-amber-100',
  QC_REJECT_PERMANEN:  'bg-red-50 text-red-700 border-red-100',
  LAINNYA:             'bg-slate-50 text-slate-600 border-slate-200',
}

export const typeLabel = (t, short = false) => {
  const f = TRANSFER_TYPES.find(x => x.value === t)
  return f ? (short ? f.short : f.label) : t
}

// Nomor transaksi yang mudah disebut & dicari: TRF-00012
export const transferNo = (id) => `TRF-${String(id).padStart(5, '0')}`

export const fmtDate = (d, month = 'short') =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month, year: 'numeric' }) : '—'

export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// Urutan size umum supaya daftar terbaca S → M → L, bukan urut abjad
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', 'ALL SIZE']
const sizeRank = (v) => {
  const parts = String(v || '').toUpperCase().split('/').map(x => x.trim())
  const i = parts.map(p => SIZE_ORDER.indexOf(p)).find(x => x >= 0)
  return i ?? 99
}
// Bandingkan varian: warna dulu (bagian selain size), lalu urutan size
export const compareVariant = (a, b) => {
  const strip = (v) => String(v || '').toUpperCase().split('/').map(x => x.trim()).filter(p => !SIZE_ORDER.includes(p)).join('/')
  return strip(a).localeCompare(strip(b)) || sizeRank(a) - sizeRank(b) || String(a || '').localeCompare(String(b || ''))
}

export const variantOf = (sku) =>
  (sku?.ProductVariantOptions ?? []).map(o => o.value).join(' / ') || null
