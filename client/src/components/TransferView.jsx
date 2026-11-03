import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, ArrowRight, Printer, Trash2, Copy, Search, CheckCircle2, Circle, Package, Warehouse, StickyNote, RotateCcw, X,
} from 'lucide-react'
import logoPreface from '../assets/logo-preface.jpeg'
import { TYPE_STYLE, typeLabel, transferNo, fmtDate, fmtDateTime, variantOf, compareVariant } from '../pages/transferShared'

// Tanda cek hanya untuk kenyamanan di perangkat ini (bukan data resmi), jadi cukup localStorage
const checkKey = (id) => `transfer-check:${id}`
const loadChecks = (id) => { try { return new Set(JSON.parse(localStorage.getItem(checkKey(id)) || '[]')) } catch { return new Set() } }
const saveChecks = (id, set) => { try { localStorage.setItem(checkKey(id), JSON.stringify([...set])) } catch { /* abaikan */ } }

export default function TransferView({ transfer, canDelete, onDelete, deleting }) {
  const no = transferNo(transfer.id)
  // kembali ke daftar dengan filter & halaman yang sama seperti sebelum dibuka
  const backTo = `/transfers${useLocation().state?.fromSearch ?? ''}`
  const items = useMemo(() => (transfer.items ?? []).map(it => ({
    id: it.id,
    name: it.ProductSKU?.Product?.name ?? '—',
    imageUrl: it.ProductSKU?.Product?.imageUrl || null,
    variant: variantOf(it.ProductSKU),
    code: it.ProductSKU?.sku_code ?? '—',
    unit: it.ProductSKU?.Product?.unit || 'pcs',
    qty: Number(it.quantity) || 0,
  })).sort((a, b) => a.name.localeCompare(b.name) || compareVariant(a.variant, b.variant)), [transfer.items])
  const totalQty = items.reduce((s, i) => s + i.qty, 0)

  const [checked, setChecked] = useState(() => loadChecks(transfer.id))
  const update = (fn) => setChecked(prev => { const next = fn(new Set(prev)); saveChecks(transfer.id, next); return next })
  const toggle = (id) => update(s => (s.has(id) ? s.delete(id) : s.add(id), s))
  const doneCount = items.filter(i => checked.has(i.id)).length
  const allDone = items.length > 0 && doneCount === items.length

  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return items
    return items.filter(i => words.every(w => `${i.name} ${i.variant ?? ''} ${i.code}`.toLowerCase().includes(w)))
  }, [items, q])

  const copyNo = () => {
    navigator.clipboard?.writeText(no).then(() => toast.success(`${no} disalin`), () => toast.error('Gagal menyalin'))
  }
  const print = () => {
    const prev = document.title
    document.title = `Transfer Stok ${no}`
    window.print()
    setTimeout(() => { document.title = prev }, 1000)
  }

  return (
    <>
      <div className="px-6 py-6 space-y-5 max-w-6xl no-print">
        <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} /> Kembali ke Transfer Stok
        </Link>

        {/* ── Header ───────────────────────────────────────── */}
        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-mono text-xl font-bold text-slate-900 tracking-tight">{no}</h1>
                <button type="button" onClick={copyNo} title="Salin nomor transfer" aria-label="Salin nomor transfer"
                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                  <Copy size={14} />
                </button>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${TYPE_STYLE[transfer.transferType] ?? TYPE_STYLE.LAINNYA}`}>
                  {typeLabel(transfer.transferType)}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                Tanggal transfer <b className="text-slate-700">{fmtDate(transfer.date, 'long')}</b>
              </p>
              <p className="text-xs text-slate-400">
                Dicatat {fmtDateTime(transfer.createdAt)} oleh <span className="text-slate-600">{transfer.Creator?.name ?? '—'}</span>
                {transfer.updater && transfer.updater.name !== transfer.Creator?.name && <> · diedit oleh <span className="text-slate-600">{transfer.updater.name}</span></>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={print} className="btn-secondary"><Printer size={14} /> Cetak</button>
              {canDelete && (
                <button type="button" disabled={deleting} className="btn-ghost text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => { if (window.confirm(`Hapus ${no}? Semua perubahan stok akan dikembalikan.`)) onDelete() }}>
                  <Trash2 size={14} /> {deleting ? 'Menghapus…' : 'Hapus'}
                </button>
              )}
            </div>
          </div>

          {/* Rute */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-stretch gap-3">
            <WarehouseBox label="Dari gudang" name={transfer.FromWarehouse?.name} />
            <div className="flex md:flex-col items-center justify-center gap-1 px-2 text-slate-400">
              <span className="text-xs font-bold text-slate-600 tabular-nums whitespace-nowrap">{totalQty} pcs</span>
              <ArrowRight size={22} className="rotate-90 md:rotate-0" />
            </div>
            <WarehouseBox label="Ke gudang" name={transfer.ToWarehouse?.name} accent />
          </div>

          {/* Ringkasan */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="Jenis barang" value={`${items.length} SKU`} />
            <Stat label="Total barang" value={`${totalQty} pcs`} />
            <Stat label="Sudah dicek" value={`${doneCount} / ${items.length}`} tone={allDone ? 'green' : doneCount ? 'amber' : null} />
          </div>

          {transfer.note && (
            <div className="mt-4 flex gap-2.5 rounded-lg bg-amber-50/60 border border-amber-100 px-4 py-3">
              <StickyNote size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">Catatan</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{transfer.note}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Daftar barang + cross-check ─────────────────────── */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <p className="text-sm font-bold text-slate-800">Daftar Barang</p>
              <p className="text-xs text-slate-400">Centang tiap barang saat dicocokkan dengan fisiknya. Tanda cek tersimpan di perangkat ini saja.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-8 pr-7 py-1.5" value={q} onChange={e => setQ(e.target.value)} placeholder="Cari produk / size / SKU…" />
              {q && <button type="button" onClick={() => setQ('')} aria-label="Hapus pencarian" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={13} /></button>}
            </div>
            {items.length > 0 && (allDone || doneCount > 0
              ? <button type="button" className="btn-ghost text-xs" onClick={() => update(() => new Set())}><RotateCcw size={13} /> Reset cek</button>
              : <button type="button" className="btn-ghost text-xs" onClick={() => update(() => new Set(items.map(i => i.id)))}><CheckCircle2 size={13} /> Cek semua</button>)}
          </div>

          {/* progres */}
          <div className="h-1 bg-slate-100">
            <div className={`h-full transition-all ${allDone ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }} />
          </div>

          {allDone && (
            <div className="px-4 py-2.5 bg-green-50 border-b border-green-100 text-sm text-green-700 font-medium flex items-center gap-2">
              <CheckCircle2 size={15} /> Semua barang sudah dicek — cocok dengan transfer ini.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th w-12 text-center">Cek</th>
                  <th className="th w-10">#</th>
                  <th className="th">Produk</th>
                  <th className="th">Varian</th>
                  <th className="th">Kode SKU</th>
                  <th className="th text-right w-24">Qty</th>
                </tr>
              </thead>
              <tbody>
                {!shown.length && (
                  <tr><td colSpan={6} className="td text-center py-10 text-slate-400">{items.length ? `Tidak ada barang yang cocok dengan "${q}"` : 'Transfer ini tidak berisi barang'}</td></tr>
                )}
                {shown.map(it => {
                  const done = checked.has(it.id)
                  return (
                    <tr key={it.id} onClick={() => toggle(it.id)}
                      className={`cursor-pointer transition-colors ${done ? 'bg-green-50/50 hover:bg-green-50' : 'hover:bg-slate-50'}`}>
                      <td className="td text-center">
                        <button type="button" role="checkbox" aria-checked={done} aria-label={`Tandai ${it.name} ${it.variant ?? ''} sudah dicek`}
                          onClick={(e) => { e.stopPropagation(); toggle(it.id) }}
                          className={`inline-flex rounded-full ${done ? 'text-green-600' : 'text-slate-300 hover:text-slate-500'}`}>
                          {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                        </button>
                      </td>
                      <td className="td text-xs text-slate-400 tabular-nums">{items.indexOf(it) + 1}</td>
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <Thumb src={it.imageUrl} name={it.name} />
                          <span className={`text-sm font-medium ${done ? 'text-slate-500' : 'text-slate-800'}`}>{it.name}</span>
                        </div>
                      </td>
                      <td className="td">
                        {it.variant ? <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-xs font-semibold text-slate-700">{it.variant}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="td"><span className="font-mono text-xs text-slate-500">{it.code}</span></td>
                      <td className="td text-right">
                        <span className="text-base font-bold text-slate-900 tabular-nums">{it.qty}</span>
                        <span className="text-xs text-slate-400 ml-1">{it.unit}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {items.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50">
                    <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-slate-600 text-right">Total ({items.length} SKU)</td>
                    <td className="px-4 py-3 text-right"><span className="text-base font-bold text-slate-900 tabular-nums">{totalQty}</span><span className="text-xs text-slate-400 ml-1">pcs</span></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* ── Versi cetak: bukti transfer untuk dicocokkan & ditandatangani ── */}
      <div className="print-only">
        <div className="print-page">
          <div className="print-header">
            <img src={logoPreface} alt="Preface" className="print-logo" />
          </div>
          <div className="print-divider" />
          <div className="print-title">BUKTI TRANSFER STOK</div>
          <div className="print-meta">
            <table className="print-meta-table">
              <tbody>
                <tr>
                  <td className="print-meta-key">No. Transfer</td><td className="print-meta-sep">:</td><td className="print-meta-val"><strong>{no}</strong></td>
                  <td className="print-meta-key">Tanggal</td><td className="print-meta-sep">:</td><td className="print-meta-val">{fmtDate(transfer.date, 'long')}</td>
                </tr>
                <tr>
                  <td className="print-meta-key">Dari Gudang</td><td className="print-meta-sep">:</td><td className="print-meta-val"><strong>{transfer.FromWarehouse?.name ?? '—'}</strong></td>
                  <td className="print-meta-key">Ke Gudang</td><td className="print-meta-sep">:</td><td className="print-meta-val"><strong>{transfer.ToWarehouse?.name ?? '—'}</strong></td>
                </tr>
                <tr>
                  <td className="print-meta-key">Tipe</td><td className="print-meta-sep">:</td><td className="print-meta-val">{typeLabel(transfer.transferType)}</td>
                  <td className="print-meta-key">Total</td><td className="print-meta-sep">:</td><td className="print-meta-val">{items.length} SKU · {totalQty} pcs</td>
                </tr>
                {transfer.note && (
                  <tr><td className="print-meta-key">Catatan</td><td className="print-meta-sep">:</td><td className="print-meta-val" colSpan={4}>{transfer.note}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <table className="print-table">
            <thead>
              <tr>
                <th className="print-th print-th-no">No.</th>
                <th className="print-th">Produk</th>
                <th className="print-th">Varian</th>
                <th className="print-th">Kode SKU</th>
                <th className="print-th" style={{ width: '14mm' }}>Qty</th>
                <th className="print-th" style={{ width: '14mm' }}>Cek</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.id} className={idx % 2 === 0 ? 'print-row-even' : ''}>
                  <td className="print-td print-td-center">{idx + 1}</td>
                  <td className="print-td">{it.name}</td>
                  <td className="print-td">{it.variant ?? '—'}</td>
                  <td className="print-td" style={{ fontFamily: 'monospace' }}>{it.code}</td>
                  <td className="print-td print-td-center"><strong>{it.qty}</strong></td>
                  <td className="print-td print-td-center">☐</td>
                </tr>
              ))}
              <tr>
                <td className="print-td" colSpan={4} style={{ textAlign: 'right' }}><strong>Total</strong></td>
                <td className="print-td print-td-center"><strong>{totalQty}</strong></td>
                <td className="print-td" />
              </tr>
            </tbody>
          </table>
          <div className="print-footer">
            <div className="print-sign-block">
              <div className="print-sign-title">Dikirim oleh,</div>
              <div className="print-sign-space" />
              <div className="print-sign-line" />
              <div className="print-sign-name">&nbsp;</div>
              <div className="print-sign-role">{transfer.FromWarehouse?.name ?? 'Gudang asal'}</div>
            </div>
            <div className="print-sign-block">
              <div className="print-sign-title">Diterima oleh,</div>
              <div className="print-sign-space" />
              <div className="print-sign-line" />
              <div className="print-sign-name">&nbsp;</div>
              <div className="print-sign-role">{transfer.ToWarehouse?.name ?? 'Gudang tujuan'}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function WarehouseBox({ label, name, accent }) {
  return (
    <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${accent ? 'bg-red-50/40 border-red-100' : 'bg-slate-50 border-slate-200'}`}>
      <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accent ? 'bg-white text-red-700 border border-red-100' : 'bg-white text-slate-500 border border-slate-200'}`}>
        <Warehouse size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-[15px] font-bold text-slate-800 truncate">{name ?? '—'}</p>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }) {
  const cls = tone === 'green' ? 'text-green-700' : tone === 'amber' ? 'text-amber-600' : 'text-slate-800'
  return (
    <div className="rounded-lg border border-slate-200 px-4 py-2.5">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${cls}`}>{value}</p>
    </div>
  )
}

function Thumb({ src, name }) {
  const [err, setErr] = useState(false)
  if (!src || err) {
    return <span className="w-9 h-9 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center shrink-0" aria-hidden><Package size={16} /></span>
  }
  return <img src={src} alt={name} loading="lazy" onError={() => setErr(true)} className="w-9 h-9 rounded-md object-cover bg-slate-100 shrink-0" />
}
