import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Search, Printer, ChevronDown, ChevronUp } from 'lucide-react'
import { posApi } from '../../api'
import Modal from '../Modal'
import { Pagination } from '../Table'
import { useAuth } from '../../context/AuthContext'
import { getItem } from '../../pos/store'
import { DEFAULT_RECEIPT, orderPrintHtml, printReceipt } from '../../pos/receipt'

// Daftar transaksi kasir satu event (semua laptop): cari, filter, detail, cetak ulang, void.
// Dipakai di halaman Riwayat Transaksi dan tab Transaksi di Laporan event.
const rp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const shortName = (n) => String(n || '').replace(/[\u200b-\u200d\u2060\ufeff]/g, '').replace(/\s+PREFACE\s+-\s+/i, ' · ').replace(/\s+PREFACE$/i, '').trim()
const METHOD = { CASH: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer', EDC: 'Kartu', OTHER: 'Lainnya' }
const FILTERS = [['', 'Semua'], ['LATER', 'Ambil nanti'], ['PENDING', 'Belum diambil'], ['SWAP', 'Tukar'], ['REVIEW', 'Perlu dicek'], ['VOID', 'Dibatalkan']]

export default function OrdersPanel({ eventId, event }) {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canVoid = hasPermission('pos.manage') || hasPermission('pos.void')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(null)
  const [voidTarget, setVoidTarget] = useState(null)
  const [reason, setReason] = useState('')
  const [settings, setSettings] = useState(DEFAULT_RECEIPT)
  useEffect(() => { getItem('kv', 'receiptSettings').then(s => s && setSettings(v => ({ ...v, ...s }))).catch(() => {}) }, [])

  const filterParams = {
    LATER: { fulfillment: 'LATER' }, PENDING: { fulfillment: 'LATER', pickupStatus: 'PENDING', status: 'PAID' },
    SWAP: { exchange: 'true', status: 'PAID' }, REVIEW: { needsReview: 'true', status: 'PAID' }, VOID: { status: 'VOID' },
  }[filter] || {}
  const { data, isLoading } = useQuery({
    queryKey: ['pos-orders', eventId, q, filter, page],
    queryFn: () => posApi.orders({ eventId, search: q || undefined, page, limit: 25, ...filterParams }),
    enabled: !!eventId, refetchInterval: 15_000,
  })
  const doVoid = useMutation({
    mutationFn: () => posApi.voidOrder(voidTarget.id, reason),
    onSuccess: () => {
      toast.success('Transaksi dibatalkan, stok dikembalikan'); setVoidTarget(null); setReason('')
      qc.invalidateQueries({ queryKey: ['pos-orders'] }); qc.invalidateQueries({ queryKey: ['pos-report'] })
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Gagal membatalkan'),
  })
  const reprint = (o, copies) => printReceipt(orderPrintHtml(o, { event, settings, cashierName: o.Cashier?.name }, copies))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={e => { e.preventDefault(); setQ(search.trim()); setPage(1) }} className="relative flex-1 min-w-[280px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="w-full h-11 pl-10 pr-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/30"
            value={search} onChange={e => { setSearch(e.target.value); if (!e.target.value) setQ('') }}
            placeholder="Cari nomor struk, nomor ambil, nama, atau 4 digit No. HP…" />
        </form>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(([k, l]) => (
            <button key={k} onClick={() => { setFilter(k); setPage(1) }}
              className={`px-3 h-9 rounded-full text-[13px] font-semibold border ${filter === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <p className="p-6 text-sm text-slate-400">Memuat…</p> : !(data?.data ?? []).length ? <p className="p-6 text-sm text-slate-400">Tidak ada transaksi.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="text-left px-4 py-2.5">Waktu</th><th className="text-left">No. struk</th><th className="text-left">Pembeli</th><th className="text-left">Barang</th><th className="text-left">Bayar</th><th className="text-right">Total</th><th className="text-left pl-4">Status</th><th /></tr>
            </thead>
            <tbody>
              {data.data.map(o => (
                <FragmentRow key={o.id} o={o} open={open === o.id} onToggle={() => setOpen(open === o.id ? null : o.id)}
                  onPrint={(c) => reprint(o, c)} onVoid={canVoid && o.status === 'PAID' ? () => setVoidTarget(o) : null} />
              ))}
            </tbody>
          </table>
        )}
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      <Modal open={!!voidTarget} onClose={() => setVoidTarget(null)} title={`Batalkan ${voidTarget?.orderNumber}`} size="sm">
        <p className="text-sm text-slate-600 mb-3">Stok barang dikembalikan ke gudang event dan transaksi ditandai batal.</p>
        <label className="label">Alasan</label>
        <input className="input" value={reason} onChange={e => setReason(e.target.value)} autoFocus placeholder="mis. salah scan, pembeli batal" />
        <div className="flex gap-2 mt-4">
          <button className="btn-secondary flex-1 justify-center" onClick={() => setVoidTarget(null)}>Kembali</button>
          <button className="btn-danger flex-1 justify-center" disabled={!reason || doVoid.isPending} onClick={() => doVoid.mutate()}>Batalkan transaksi</button>
        </div>
      </Modal>
    </div>
  )
}

function FragmentRow({ o, open, onToggle, onPrint, onVoid }) {
  const status = o.status === 'VOID' ? <span className="text-danger font-semibold">Batal</span>
    : o.fulfillment === 'LATER' ? (o.pickupStatus === 'PENDING' ? <span className="badge-amber">Belum diambil · {o.pickupCode}</span> : <span className="badge-green">Sudah diambil</span>)
    : <span className="text-slate-500">Dibawa</span>
  return (
    <>
      <tr className="border-t border-slate-100 hover:bg-slate-50/60 cursor-pointer align-top" onClick={onToggle}>
        <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{new Date(o.soldAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</td>
        <td className="py-2.5 font-mono text-xs">{o.orderNumber}{o.exchangeOf && <span className="block font-sans text-[11px] text-sky-700">tukar dari {o.exchangeOf.orderNumber}</span>}</td>
        <td className="py-2.5">{o.customerName || <span className="text-slate-400">—</span>}{o.customerPhone && <span className="block text-xs text-slate-400">••••{String(o.customerPhone).slice(-4)}</span>}</td>
        <td className="py-2.5 text-xs text-slate-600 max-w-[280px]">{o.items.map(i => `${i.qty < 0 ? `kembali ${-i.qty}` : i.qty}× ${shortName(i.name)}${i.variant ? ` ${i.variant}` : ''}`).join(', ')}</td>
        <td className="py-2.5 text-xs">{o.payments.map(p => METHOD[p.method] || p.method).join(' + ') || '—'}</td>
        <td className="py-2.5 text-right font-semibold whitespace-nowrap">{rp(o.total)}</td>
        <td className="py-2.5 pl-4 text-xs">{status}{o.needsReview && <span className="block text-amber-600">perlu dicek</span>}</td>
        <td className="pr-3 py-2.5 text-slate-400">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
      </tr>
      {open && (
        <tr className="bg-slate-50/70">
          <td colSpan={8} className="px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-4 text-sm">
              <div className="space-y-1">
                {o.items.map(i => (
                  <p key={i.id} className={i.qty < 0 ? 'text-sky-700' : ''}>{i.qty < 0 ? `Dikembalikan ${-i.qty}` : i.qty}× {shortName(i.name)} {i.variant && <b>{i.variant}</b>} — {rp(i.lineTotal)}{i.discount ? <span className="text-emerald-600"> (diskon {rp(i.discount)})</span> : ''}</p>
                ))}
                {o.returnTotal > 0 && <p className="text-sky-700">Barang dikembalikan senilai {rp(o.returnTotal)}{o.total < 0 ? ` · uang dikembalikan ${rp(-o.total)}` : ''}</p>}
                {o.orderDiscount > 0 && <p className="text-emerald-600">Diskon transaksi {rp(o.orderDiscount)}{o.discountNote ? ` · ${o.discountNote}` : ''}</p>}
                <p className="text-xs text-slate-500">Kasir {o.Cashier?.name || '—'}{o.customerPhone ? ` · HP ${o.customerPhone}` : ''}</p>
                {o.needsReview && <p className="text-xs text-amber-700">{o.reviewNote}</p>}
                {o.status === 'VOID' && <p className="text-xs text-danger">Dibatalkan: {o.voidReason}</p>}
              </div>
              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                <button className="btn-secondary text-xs" onClick={() => onPrint({ customer: true, staff: false })}><Printer size={12} />Struk pelanggan</button>
                <button className="btn-secondary text-xs" onClick={() => onPrint({ customer: false, staff: true })}><Printer size={12} />Slip staff</button>
                {onVoid && <button className="btn-secondary text-xs text-danger" onClick={onVoid}>Batalkan</button>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
