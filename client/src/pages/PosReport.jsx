import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { posApi } from '../api'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import { exportExcel } from '../utils/exportExcel'

const rp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const METHOD = { CASH: 'Cash', QRIS: 'QRIS', TRANSFER: 'Transfer', EDC: 'EDC / Kartu', OTHER: 'Lainnya' }

export default function PosReport() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canVoid = hasPermission('pos.manage') || hasPermission('pos.void')
  const [voidTarget, setVoidTarget] = useState(null)
  const [reason, setReason] = useState('')

  const { data: r, isLoading } = useQuery({ queryKey: ['pos-report', id], queryFn: () => posApi.report(id) })
  const { data: orders } = useQuery({ queryKey: ['pos-orders', id], queryFn: () => posApi.orders({ eventId: id, limit: 200 }) })
  const doVoid = useMutation({
    mutationFn: () => posApi.voidOrder(voidTarget.id, reason),
    onSuccess: () => { toast.success('Transaksi dibatalkan, stok dikembalikan'); setVoidTarget(null); setReason(''); qc.invalidateQueries({ queryKey: ['pos-report', id] }); qc.invalidateQueries({ queryKey: ['pos-orders', id] }) },
    onError: (e) => toast.error(e.response?.data?.message || 'Gagal membatalkan'),
  })

  if (isLoading || !r) return <div className="p-6 text-slate-400">Memuat laporan…</div>
  const t = r.totals

  const exportXlsx = () => exportExcel(`laporan-${r.event.name}`, {
    sheetName: 'Per produk',
    headers: ['Produk', 'Varian', 'Qty', 'Harga kotor', 'Diskon', 'Bersih'],
    rows: r.byProduct.map(p => [p.name, p.variant || '', p.qty, p.gross, p.discount, p.net]),
  })

  return (
    <div className="px-6 py-6 space-y-5">
      <PageHeader title={`Laporan — ${r.event.name}`} subtitle={`${r.event.startDate || ''} ${r.event.location ? '· ' + r.event.location : ''}`}
        action={<>
          <button className="btn-secondary" onClick={() => navigate('/pos/events')}><ArrowLeft size={14} />Event</button>
          <button className="btn-secondary" onClick={exportXlsx}>Excel</button>
        </>} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[['Omzet bersih', rp(t.total)], ['Transaksi', t.orders], ['Barang terjual', `${t.qty} pcs`], ['Total diskon', rp(t.discount)], ['Dibatalkan', t.voided]].map(([l, v]) => (
          <div key={l} className="card p-4"><p className="text-xs text-slate-500">{l}</p><p className="text-2xl font-bold font-mono text-slate-800">{v}</p></div>
        ))}
      </div>

      {t.needsReview > 0 && (
        <div className="card p-4 border border-amber-200 bg-amber-50/50">
          <p className="font-semibold text-amber-800 flex items-center gap-2"><AlertTriangle size={15} />{t.needsReview} transaksi perlu dicek saat opname</p>
          <ul className="text-sm text-amber-800 mt-2 list-disc pl-5">
            {r.needsReview.map(o => <li key={o.id}>{o.orderNumber}: {o.reviewNote}</li>)}
          </ul>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="font-semibold mb-2">Per metode bayar</p>
          {Object.entries(r.byMethod).filter(([, v]) => v).map(([k, v]) => <Line key={k} l={METHOD[k]} v={rp(v)} />)}
        </div>
        <div className="card p-4">
          <p className="font-semibold mb-2">Per hari</p>
          {r.byDay.map(d => <Line key={d.day} l={`${d.day} · ${d.orders} trx · ${d.qty} pcs`} v={rp(d.total)} />)}
        </div>
      </div>

      <div className="card p-4">
        <p className="font-semibold mb-2">Shift & kas</p>
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 uppercase"><tr><th className="text-left py-1">Shift</th><th className="text-left">Kasir</th><th className="text-right">Penjualan</th><th className="text-right">Kas seharusnya</th><th className="text-right">Kas dihitung</th><th className="text-right">Selisih</th></tr></thead>
          <tbody>
            {r.shifts.map(s => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="py-1.5">#{s.id} {s.deviceName} <span className="text-xs text-slate-400">{s.status === 'OPEN' ? '(masih buka)' : ''}</span></td>
                <td>{s.Cashier?.name}</td>
                <td className="text-right font-mono">{rp(s.summary.total)}</td>
                <td className="text-right font-mono">{rp(s.summary.expectedCash)}</td>
                <td className="text-right font-mono">{s.countedCash == null ? '—' : rp(s.countedCash)}</td>
                <td className={`text-right font-mono ${s.summary.cashDifference ? 'text-danger' : ''}`}>{s.summary.cashDifference == null ? '—' : rp(s.summary.cashDifference)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-4">
        <p className="font-semibold mb-2">Per produk</p>
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 uppercase"><tr><th className="text-left py-1">Produk</th><th className="text-right">Qty</th><th className="text-right">Kotor</th><th className="text-right">Diskon</th><th className="text-right">Bersih</th></tr></thead>
          <tbody>
            {r.byProduct.map(p => (
              <tr key={`${p.ProductSKUId}-${p.name}`} className="border-t border-slate-100">
                <td className="py-1.5">{p.name} <span className="text-slate-400">{p.variant}</span></td>
                <td className="text-right">{p.qty}</td><td className="text-right font-mono">{rp(p.gross)}</td>
                <td className="text-right font-mono">{p.discount ? `-${rp(p.discount)}` : '—'}</td><td className="text-right font-mono">{rp(p.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-4">
        <p className="font-semibold mb-2">Transaksi</p>
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 uppercase"><tr><th className="text-left py-1">No.</th><th className="text-left">Waktu</th><th className="text-left">Item</th><th className="text-right">Total</th><th className="text-left pl-3">Status</th><th /></tr></thead>
          <tbody>
            {(orders?.data ?? []).map(o => (
              <tr key={o.id} className="border-t border-slate-100 align-top">
                <td className="py-1.5 font-mono text-xs">{o.orderNumber}</td>
                <td className="text-xs text-slate-500">{new Date(o.soldAt).toLocaleString('id-ID')}</td>
                <td className="text-xs">{o.customerName && <b>{o.customerName}{o.customerPhone ? ` (${o.customerPhone})` : ''} · </b>}{o.items.map(i => `${i.qty}x ${i.name}${i.variant ? ` ${i.variant}` : ''}`).join(', ')}{o.discountNote && <span className="text-slate-400"> · {o.discountNote}</span>}</td>
                <td className="text-right font-mono">{rp(o.total)}</td>
                <td className="pl-3 text-xs">{o.status === 'VOID' ? <span className="text-danger">Batal: {o.voidReason}</span> : o.needsReview ? <span className="text-amber-600">Perlu dicek</span> : 'OK'}</td>
                <td className="text-right">{canVoid && o.status === 'PAID' && <button className="text-xs text-slate-400 hover:text-danger" onClick={() => setVoidTarget(o)}>Batalkan</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

const Line = ({ l, v }) => <div className="flex justify-between text-sm py-1 border-t border-slate-100 first:border-0"><span className="text-slate-600">{l}</span><span className="font-mono">{v}</span></div>
