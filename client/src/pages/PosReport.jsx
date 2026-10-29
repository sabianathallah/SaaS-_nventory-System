import { useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, AlertTriangle, ChevronDown, ChevronRight, Download, PackageCheck } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import * as XLSX from 'xlsx'
import { posApi } from '../api'
import PageHeader from '../components/PageHeader'
import OrdersPanel from '../components/pos/OrdersPanel'

// Laporan event pop up: satu halaman, tab per sudut pandang. Semua angka dari /pos/events/:id/report.
const rp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const rpShort = (n) => {
  const v = Math.abs(n), sign = n < 0 ? '-' : ''
  if (v >= 1e9) return `${sign}${(v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`
  if (v >= 1e6) return `${sign}${(v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
  if (v >= 1e3) return `${sign}${Math.round(v / 1e3)} rb`
  return `${sign}${v}`
}
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0)
const shortName = (n) => String(n || '').replace(/[\u200b-\u200d\u2060\ufeff]/g, '').replace(/\s+PREFACE\s+-\s+/i, ' · ').replace(/\s+PREFACE$/i, '').trim()
const METHOD = { CASH: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer', EDC: 'Kartu (EDC)', OTHER: 'Lainnya' }
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
const sizeRank = (v) => { const i = SIZE_ORDER.indexOf(v); return i < 0 ? 99 : i }
// satu warna untuk besaran (omzet/qty); sorotan = event / jam yang sedang dilihat
const INK = '#C8102E', INK_SOFT = '#F2B8C1', GRID = '#EEF0F3', AXIS = '#94A3B8'
const TABS = [['ringkasan', 'Ringkasan'], ['produk', 'Produk'], ['waktu', 'Waktu'], ['bayar', 'Kasir & Bayar'], ['pelanggan', 'Pelanggan'], ['transaksi', 'Transaksi'], ['event', 'Antar event']]

export default function PosReport() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'ringkasan'
  const { data: r, isLoading } = useQuery({ queryKey: ['pos-report', id], queryFn: () => posApi.report(id), refetchInterval: 30_000 })

  if (isLoading || !r) return <div className="p-6 text-slate-400">Memuat laporan…</div>
  return (
    <div className="px-6 py-6 space-y-5">
      <PageHeader title={`Laporan — ${r.event.name}`}
        subtitle={[r.event.startDate && `${r.event.startDate}${r.event.endDate && r.event.endDate !== r.event.startDate ? ` s/d ${r.event.endDate}` : ''}`, r.event.location].filter(Boolean).join(' · ')}
        action={<>
          <button className="btn-secondary" onClick={() => navigate('/pos/events')}><ArrowLeft size={14} />Event</button>
          <button className="btn-secondary" onClick={() => exportReport(r)}><Download size={14} />Excel lengkap</button>
        </>} />

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setParams({ tab: k }, { replace: true })}
            className={`shrink-0 px-4 h-10 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === k ? 'border-brand text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{l}</button>
        ))}
      </div>

      {tab === 'ringkasan' && <Summary r={r} go={(t) => setParams({ tab: t }, { replace: true })} />}
      {tab === 'produk' && <Products r={r} />}
      {tab === 'waktu' && <Time r={r} />}
      {tab === 'bayar' && <Payments r={r} />}
      {tab === 'pelanggan' && <Customers r={r} />}
      {tab === 'transaksi' && <OrdersPanel eventId={id} event={r.event} />}
      {tab === 'event' && <Compare r={r} />}
    </div>
  )
}

// ── Ringkasan ───────────────────────────────────────────────────────────────
function Summary({ r, go }) {
  const t = r.totals
  const sold = r.byArticle.reduce((s, a) => s + a.sold, 0)
  const brought = r.byArticle.filter(a => a.hasStock).reduce((s, a) => s + a.brought, 0)
  const peak = [...r.byHour].sort((a, b) => b.total - a.total)[0]
  const topMethod = Object.entries(r.byMethod).sort((a, b) => b[1] - a[1])[0]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Omzet bersih" value={rp(t.total)} hint={`kotor ${rp(t.subtotal)} · diskon ${rp(t.discount)}`} big />
        <Kpi label="Transaksi" value={t.orders} hint={`${t.later} ambil nanti`} />
        <Kpi label="Rata-rata belanja" value={rp(t.aov)} hint={`${t.upt.toLocaleString('id-ID')} pcs per transaksi`} />
        <Kpi label="Barang terjual" value={`${t.soldQty} pcs`} hint={brought ? `sell-through ${pct(sold, brought)}% dari ${brought} pcs dibawa` : 'stok bawaan belum tercatat'} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Kpi label="Dibatalkan (void)" value={t.voided} hint={t.voided ? `senilai ${rp(t.voidedTotal)}` : '—'} />
        <Kpi label="Pembeli ber-No. HP" value={t.customers} hint={`${t.repeatCustomers} belanja lebih dari sekali`} />
      </div>

      {(t.needsReview > 0 || t.pendingPickup > 0) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {t.needsReview > 0 && (
            <div className="card p-4 border border-amber-200 bg-amber-50/50">
              <p className="font-semibold text-amber-800 flex items-center gap-2"><AlertTriangle size={15} />{t.needsReview} transaksi perlu dicek</p>
              <ul className="text-sm text-amber-800 mt-2 list-disc pl-5 space-y-0.5 max-h-40 overflow-auto">
                {r.needsReview.map(o => <li key={o.id}><span className="font-mono text-xs">{o.orderNumber}</span>: {o.reviewNote}</li>)}
              </ul>
            </div>
          )}
          {t.pendingPickup > 0 && (
            <div className="card p-4">
              <p className="font-semibold text-slate-800 flex items-center gap-2"><PackageCheck size={15} />{t.pendingPickup} pesanan belum diambil</p>
              <ul className="text-sm text-slate-600 mt-2 space-y-0.5 max-h-40 overflow-auto">
                {r.pendingPickup.map(o => <li key={o.id}><b>{o.pickupCode}</b> · {o.customerName || '—'} · {o.items.map(i => `${i.qty}× ${shortName(i.name)} ${i.variant || ''}`).join(', ')}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Artikel terlaris" more={() => go('produk')}>
          <RankBars rows={r.byArticle.filter(a => a.sold).slice(0, 6).map(a => ({ key: a.name, label: shortName(a.name), value: a.net, note: `${a.sold - a.returned} pcs` }))} fmt={rp} />
        </Card>
        <Card title="Jam ramai" more={() => go('waktu')}>
          {peak ? <>
            <p className="text-sm text-slate-500">Paling ramai jam <b className="text-slate-900">{String(peak.hour).padStart(2, '0')}.00–{String(peak.hour + 1).padStart(2, '0')}.00</b> · {peak.orders} transaksi · {rp(peak.total)}</p>
            <HourChart rows={r.byHour} metric="total" height={150} />
          </> : <Empty />}
        </Card>
        <Card title="Metode bayar" more={() => go('bayar')}>
          <RankBars rows={Object.entries(r.byMethod).filter(([, v]) => v > 0).map(([k, v]) => ({ key: k, label: METHOD[k], value: v, note: `${pct(v, Object.values(r.byMethod).reduce((s, x) => s + Math.max(x, 0), 0))}%` }))} fmt={rp} />
          {topMethod && topMethod[1] > 0 && <p className="text-xs text-slate-400 mt-2">{METHOD[topMethod[0]]} paling banyak dipakai.</p>}
        </Card>
      </div>
    </div>
  )
}

// ── Produk: per artikel → per size, dengan stok dibawa / terjual / sisa ─────────
function Products({ r }) {
  const [open, setOpen] = useState({})
  const [sort, setSort] = useState('net')
  const rows = useMemo(() => [...r.byArticle].sort((a, b) => sort === 'st'
    ? pct(b.sold - b.returned, b.brought) - pct(a.sold - a.returned, a.brought)
    : sort === 'qty' ? (b.sold - b.returned) - (a.sold - a.returned) : b[sort] - a[sort]), [r.byArticle, sort])
  // size terlaris (gabungan semua artikel)
  const sizes = useMemo(() => {
    const m = {}
    for (const k of r.byProduct) { const v = k.variant || 'Tanpa size'; m[v] = (m[v] || 0) + k.sold - k.returned }
    return Object.entries(m).sort((a, b) => sizeRank(a[0]) - sizeRank(b[0])).map(([size, qty]) => ({ size, qty }))
  }, [r.byProduct])
  const unsold = r.byProduct.filter(k => k.brought > 0 && k.sold === 0).length

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Terjual per size">
          {sizes.length ? <ResponsiveContainer width="100%" height={170}>
            <BarChart data={sizes} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="size" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: '#F8FAFC' }} content={<Tip render={(d) => <><b>Size {d.size}</b><br />{d.qty} pcs terjual</>} />} />
              <Bar dataKey="qty" fill={INK} radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer> : <Empty />}
        </Card>
        <Card title="Stok">
          <Line l="Dibawa ke event" v={`${r.totals.brought} pcs`} />
          <Line l="Terjual bersih" v={`${r.totals.qty} pcs`} />
          <Line l="Sisa di gudang event" v={`${r.byArticle.reduce((s, a) => s + a.left, 0)} pcs`} />
          <Line l="SKU belum terjual sama sekali" v={unsold} />
          <p className="text-xs text-slate-400 mt-2">"Dibawa" = transfer / stock in ke gudang event. Sell-through = terjual bersih ÷ dibawa.</p>
        </Card>
      </div>

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <p className="font-semibold">Per artikel <span className="text-xs font-normal text-slate-400">· klik untuk lihat per size</span></p>
          <select className="input w-auto text-sm" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="net">Urut: omzet</option><option value="qty">Urut: pcs terjual</option><option value="st">Urut: sell-through</option>
          </select>
        </div>
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="text-left px-4 py-2">Artikel</th><th className="text-right">Dibawa</th><th className="text-right">Terjual</th><th className="text-right">Sisa</th><th className="text-left pl-6 w-44">Sell-through</th><th className="text-right">Diskon</th><th className="text-right pr-4">Omzet bersih</th></tr>
          </thead>
          <tbody>
            {rows.map(a => {
              const k = a.ProductId || a.name, isOpen = open[k]
              return [
                <tr key={k} className="border-t border-slate-100 hover:bg-slate-50/60 cursor-pointer" onClick={() => setOpen(o => ({ ...o, [k]: !o[k] }))}>
                  <td className="px-4 py-2 font-semibold text-slate-800">{isOpen ? <ChevronDown size={13} className="inline mr-1" /> : <ChevronRight size={13} className="inline mr-1" />}{shortName(a.name)}</td>
                  <td className="text-right">{a.hasStock ? a.brought : '—'}</td>
                  <td className="text-right">{a.sold - a.returned}</td>
                  <td className="text-right">{a.hasStock ? a.left : '—'}</td>
                  <td className="pl-6"><StBar sold={a.sold - a.returned} brought={a.hasStock ? a.brought : 0} /></td>
                  <td className="text-right font-mono text-xs">{a.discount ? `-${rp(a.discount)}` : '—'}</td>
                  <td className="text-right pr-4 font-mono">{rp(a.net)}</td>
                </tr>,
                ...(isOpen ? [...a.skus].sort((x, y) => sizeRank(x.variant) - sizeRank(y.variant)).map(s => (
                  <tr key={`${k}-${s.ProductSKUId}`} className="bg-slate-50/50 text-slate-600">
                    <td className="pl-10 py-1.5">Size <b>{s.variant || '—'}</b></td>
                    <td className="text-right">{s.brought ?? '—'}</td>
                    <td className="text-right">{s.sold - s.returned}</td>
                    <td className="text-right">{s.left ?? '—'}</td>
                    <td className="pl-6"><StBar sold={s.sold - s.returned} brought={s.brought || 0} /></td>
                    <td className="text-right font-mono text-xs">{s.discount ? `-${rp(s.discount)}` : '—'}</td>
                    <td className="text-right pr-4 font-mono text-xs">{rp(s.net)}</td>
                  </tr>
                )) : []),
              ]
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StBar({ sold, brought }) {
  if (!brought) return <span className="text-xs text-slate-400">—</span>
  const p = Math.min(pct(sold, brought), 100)
  return (
    <div className="flex items-center gap-2" title={`${sold} dari ${brought} pcs`}>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${p}%`, background: INK }} /></div>
      <span className="text-xs tabular-nums w-9 text-right text-slate-700">{pct(sold, brought)}%</span>
    </div>
  )
}

// ── Waktu: per jam & per hari ────────────────────────────────────────────────
const METRICS = [['total', 'Omzet'], ['orders', 'Transaksi'], ['qty', 'Pcs']]
function Time({ r }) {
  const [metric, setMetric] = useState('total')
  return (
    <div className="space-y-4">
      <Card title="Per jam (WIB)" right={<Segmented value={metric} onChange={setMetric} options={METRICS} />}>
        {r.byHour.length ? <HourChart rows={r.byHour} metric={metric} height={260} /> : <Empty />}
      </Card>
      <Card title="Per hari">
        {r.byDay.length > 1 && (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={r.byDay} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} tickFormatter={v => metric === 'total' ? rpShort(v) : v} />
              <Tooltip cursor={{ fill: '#F8FAFC' }} content={<Tip render={(d) => <><b>{d.day}</b><br />{rp(d.total)} · {d.orders} transaksi · {d.qty} pcs</>} />} />
              <Bar dataKey={metric} fill={INK} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <table className="w-full text-sm mt-2">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="text-left py-1">Tanggal</th><th className="text-right">Transaksi</th><th className="text-right">Pcs</th><th className="text-right">Rata-rata</th><th className="text-right">Omzet</th></tr></thead>
          <tbody>{r.byDay.map(d => (
            <tr key={d.day} className="border-t border-slate-100"><td className="py-1.5">{d.day}</td><td className="text-right">{d.orders}</td><td className="text-right">{d.qty}</td><td className="text-right font-mono">{rp(d.orders ? Math.round(d.total / d.orders) : 0)}</td><td className="text-right font-mono">{rp(d.total)}</td></tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  )
}

function HourChart({ rows, metric, height }) {
  // isi jam kosong di antara jam pertama & terakhir supaya jeda sepi terlihat
  const data = useMemo(() => {
    if (!rows.length) return []
    const m = Object.fromEntries(rows.map(h => [h.hour, h]))
    const out = []
    for (let h = rows[0].hour; h <= rows[rows.length - 1].hour; h++) out.push(m[h] || { hour: h, orders: 0, qty: 0, total: 0 })
    return out
  }, [rows])
  const max = Math.max(...data.map(d => d[metric]))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: metric === 'total' ? 0 : -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="hour" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} tickFormatter={h => String(h).padStart(2, '0')} />
        <YAxis tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={v => metric === 'total' ? rpShort(v) : v} />
        <Tooltip cursor={{ fill: '#F8FAFC' }} content={<Tip render={(d) => <><b>{String(d.hour).padStart(2, '0')}.00–{String(d.hour + 1).padStart(2, '0')}.00</b><br />{rp(d.total)} · {d.orders} transaksi · {d.qty} pcs</>} />} />
        <Bar dataKey={metric} radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map(d => <Cell key={d.hour} fill={d[metric] === max ? INK : INK_SOFT} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Kasir & Bayar ───────────────────────────────────────────────────────────
function Payments({ r }) {
  const totalPaid = Object.values(r.byMethod).reduce((s, v) => s + Math.max(v, 0), 0)
  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Metode bayar">
          <RankBars rows={Object.entries(r.byMethod).filter(([, v]) => v !== 0).map(([k, v]) => ({ key: k, label: METHOD[k], value: v, note: `${pct(v, totalPaid)}% · ${r.methodOrders[k] || 0} trx` }))} fmt={rp} />
          {r.byMethod.CASH < 0 && <p className="text-xs text-slate-400 mt-2">Tunai negatif = uang dikembalikan lebih besar dari tunai masuk.</p>}
        </Card>
        <Card title="Per laptop kasir">
          <SimpleTable cols={['Laptop', 'Transaksi', 'Pcs', 'Omzet']} rows={r.byDevice.map(d => [d.name, d.orders, d.qty, rp(d.total)])} />
        </Card>
      </div>
      <Card title="Per kasir">
        <SimpleTable cols={['Kasir', 'Transaksi', 'Pcs', 'Rata-rata', 'Omzet', 'Porsi']}
          rows={r.byCashier.map(c => [c.name, c.orders, c.qty, rp(c.orders ? Math.round(c.total / c.orders) : 0), rp(c.total), `${pct(c.total, r.totals.total)}%`])} />
      </Card>
      <Card title="Shift & kas">
        <SimpleTable cols={['Shift', 'Kasir', 'Dibuka', 'Transaksi', 'Penjualan', 'Modal', 'Kas seharusnya', 'Kas dihitung', 'Selisih']}
          rows={r.shifts.map(s => [
            <>#{s.id} {s.deviceName} {s.status === 'OPEN' && <span className="text-xs text-amber-600">(masih buka)</span>}</>,
            s.Cashier?.name || '—', new Date(s.openedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
            s.summary.orderCount, rp(s.summary.total), rp(s.openingCash), rp(s.summary.expectedCash),
            s.countedCash == null ? '—' : rp(s.countedCash),
            s.summary.cashDifference == null ? '—' : <span className={s.summary.cashDifference ? 'text-danger font-semibold' : 'text-emerald-600'}>{rp(s.summary.cashDifference)}</span>,
          ])} />
      </Card>
    </div>
  )
}

// ── Pelanggan ───────────────────────────────────────────────────────────────
function Customers({ r }) {
  const t = r.totals
  const limit = r.event.purchaseLimit
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Pembeli unik (No. HP)" value={t.customers} />
        <Kpi label="Belanja lebih dari sekali" value={t.repeatCustomers} hint={t.customers ? `${pct(t.repeatCustomers, t.customers)}% dari pembeli ber-HP` : '—'} />
        <Kpi label="Transaksi dengan No. HP" value={`${pct(t.withPhone, t.salesOrders)}%`} hint={`${t.withPhone} dari ${t.salesOrders} transaksi jual`} />
        <Kpi label="Kena batas beli" value={t.limitHits} hint={limit?.qty ? `aturan: maks ${limit.qty} pcs/artikel${limit.perPhone ? ' per No. HP' : ''}` : 'batas beli tidak aktif'} />
      </div>
      <Card title="Pembeli teratas">
        {r.customers.length ? (
          <SimpleTable cols={['Nama', 'No. HP', 'Transaksi', 'Pcs', 'Total belanja', 'Terakhir']}
            rows={r.customers.map(c => [c.name || '—', `••••${c.last4}`, c.orders, c.qty, rp(c.total), new Date(c.lastAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })])} />
        ) : <p className="text-sm text-slate-400">Belum ada transaksi yang mencatat No. HP.</p>}
        <p className="text-xs text-slate-400 mt-2">No. HP hanya 4 digit terakhir. Nomor lengkap ada di detail transaksi untuk konfirmasi pesanan.</p>
      </Card>
    </div>
  )
}

// ── Antar event ─────────────────────────────────────────────────────────────
function Compare({ r }) {
  const navigate = useNavigate()
  const rows = r.compare.map(c => ({ ...c, label: c.name, aov: c.orders ? Math.round(c.total / c.orders) : 0 }))
  return (
    <div className="space-y-4">
      <Card title="Omzet per event">
        <ResponsiveContainer width="100%" height={Math.max(120, rows.length * 44)}>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} tickFormatter={rpShort} />
            <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: '#F8FAFC' }} content={<Tip render={(d) => <><b>{d.name}</b><br />{rp(d.total)} · {d.orders} transaksi · {d.qty} pcs</>} />} />
            <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {rows.map(c => <Cell key={c.id} fill={c.id === r.event.id ? INK : INK_SOFT} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Perbandingan">
        <SimpleTable cols={['Event', 'Tanggal', 'Status', 'Transaksi', 'Pcs', 'Rata-rata belanja', 'Omzet', '']}
          rows={rows.map(c => [
            <span className={c.id === r.event.id ? 'font-bold' : ''}>{c.name}</span>, c.startDate || '—', { PREP: 'Persiapan', OPEN: 'Berjalan', CLOSED: 'Selesai' }[c.status],
            c.orders, c.qty, rp(c.aov), rp(c.total),
            c.id !== r.event.id ? <button className="text-xs text-brand" onClick={() => navigate(`/pos/events/${c.id}/report?tab=ringkasan`)}>Buka</button> : <span className="text-xs text-slate-400">event ini</span>,
          ])} />
      </Card>
    </div>
  )
}

// ── Komponen kecil ──────────────────────────────────────────────────────────
function Kpi({ label, value, hint, big }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`${big ? 'text-3xl' : 'text-2xl'} font-bold text-slate-900 tabular-nums mt-0.5`}>{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}
function Card({ title, right, more, children }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <p className="font-semibold text-slate-800">{title}</p>
        {right}{more && <button className="text-xs font-semibold text-brand" onClick={more}>Lihat detail</button>}
      </div>
      {children}
    </div>
  )
}
function RankBars({ rows, fmt }) {
  if (!rows.length) return <Empty />
  const max = Math.max(...rows.map(r => Math.abs(r.value)))
  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <div key={r.key}>
          <div className="flex justify-between gap-3 text-sm"><span className="text-slate-700 truncate">{r.label}</span><span className="font-semibold tabular-nums shrink-0">{fmt(r.value)}</span></div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${max ? Math.abs(r.value) / max * 100 : 0}%`, background: INK }} /></div>
            {r.note && <span className="text-[11px] text-slate-400 shrink-0">{r.note}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
function SimpleTable({ cols, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-slate-500"><tr>{cols.map((c, i) => <th key={i} className={`py-1.5 ${i ? 'text-right' : 'text-left'}`}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-slate-100">{r.map((v, j) => <td key={j} className={`py-1.5 ${j ? 'text-right tabular-nums' : ''}`}>{v}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}
function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {options.map(([k, l]) => <button key={k} onClick={() => onChange(k)} className={`px-3 h-7 rounded-md text-xs font-semibold ${value === k ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{l}</button>)}
    </div>
  )
}
function Tip({ active, payload, render }) {
  if (!active || !payload?.length) return null
  return <div className="rounded-lg bg-slate-900 text-white text-xs px-3 py-2 shadow-lg leading-relaxed">{render(payload[0].payload)}</div>
}
const Line = ({ l, v }) => <div className="flex justify-between text-sm py-1.5 border-t border-slate-100 first:border-0"><span className="text-slate-600">{l}</span><span className="font-semibold tabular-nums">{v}</span></div>
const Empty = () => <p className="text-sm text-slate-400">Belum ada data.</p>

// ── Excel: satu file, satu sheet per tab ─────────────────────────────────────
async function exportReport(r) {
  const t = r.totals
  const all = []
  for (let page = 1; page < 50; page++) {
    const res = await posApi.orders({ eventId: r.event.id, page, limit: 500 })
    all.push(...res.data)
    if (page >= (res.pagination?.totalPages || 1)) break
  }
  const sheets = {
    Ringkasan: [['Metrik', 'Nilai'],
      ['Omzet bersih', t.total], ['Omzet kotor', t.subtotal], ['Diskon', t.discount], ['Transaksi', t.orders], ['Rata-rata belanja', t.aov],
      ['Pcs per transaksi', t.upt], ['Pcs terjual', t.soldQty], ['Pcs dibawa', t.brought], ['Dibatalkan', t.voided], ['Pembeli ber-HP', t.customers], ['Pembeli berulang', t.repeatCustomers]],
    'Per artikel': [['Artikel', 'Dibawa', 'Terjual', 'Sisa', 'Sell-through %', 'Kotor', 'Diskon', 'Bersih'],
      ...r.byArticle.map(a => [a.name, a.hasStock ? a.brought : '', a.sold - a.returned, a.hasStock ? a.left : '', a.hasStock ? pct(a.sold - a.returned, a.brought) : '', a.gross, a.discount, a.net])],
    'Per size': [['Artikel', 'Size', 'Dibawa', 'Terjual', 'Sisa', 'Bersih'],
      ...r.byProduct.map(s => [s.name, s.variant || '', s.brought ?? '', s.sold - s.returned, s.left ?? '', s.net])],
    'Per jam': [['Jam', 'Transaksi', 'Pcs', 'Omzet'], ...r.byHour.map(h => [`${String(h.hour).padStart(2, '0')}.00`, h.orders, h.qty, h.total])],
    'Per hari': [['Tanggal', 'Transaksi', 'Pcs', 'Omzet'], ...r.byDay.map(d => [d.day, d.orders, d.qty, d.total])],
    'Metode bayar': [['Metode', 'Nominal', 'Transaksi'], ...Object.entries(r.byMethod).map(([k, v]) => [METHOD[k], v, r.methodOrders[k] || 0])],
    Kasir: [['Kasir', 'Transaksi', 'Pcs', 'Omzet'], ...r.byCashier.map(c => [c.name, c.orders, c.qty, c.total])],
    Shift: [['Shift', 'Laptop', 'Kasir', 'Dibuka', 'Ditutup', 'Transaksi', 'Penjualan', 'Modal', 'Kas seharusnya', 'Kas dihitung', 'Selisih'],
      ...r.shifts.map(s => [s.id, s.deviceName || '', s.Cashier?.name || '', s.openedAt, s.closedAt || '', s.summary.orderCount, s.summary.total, s.openingCash, s.summary.expectedCash, s.countedCash ?? '', s.summary.cashDifference ?? ''])],
    Pelanggan: [['Nama', 'HP (4 digit)', 'Transaksi', 'Pcs', 'Total'], ...r.customers.map(c => [c.name || '', c.last4, c.orders, c.qty, c.total])],
    Transaksi: [['No. struk', 'Waktu', 'Status', 'Kasir', 'Pembeli', 'Barang', 'Subtotal', 'Diskon', 'Total', 'Bayar', 'Ambil', 'Catatan cek'],
      ...all.map(o => [o.orderNumber, new Date(o.soldAt).toLocaleString('id-ID'), o.status, o.Cashier?.name || '', o.customerName || '',
        o.items.map(i => `${i.qty}x ${i.name}${i.variant ? ` ${i.variant}` : ''}`).join('; '),
        o.subtotal, o.itemDiscount + o.orderDiscount, o.total, o.payments.map(p => `${METHOD[p.method] || p.method} ${p.amount}`).join(' + '),
        o.fulfillment === 'LATER' ? `${o.pickupCode} ${o.pickupStatus === 'PENDING' ? '(belum)' : '(sudah)'}` : '', o.reviewNote || ''])],
    'Antar event': [['Event', 'Tanggal', 'Transaksi', 'Pcs', 'Omzet'], ...r.compare.map(c => [c.name, c.startDate || '', c.orders, c.qty, c.total])],
  }
  const wb = XLSX.utils.book_new()
  for (const [name, aoa] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = aoa[0].map((h, i) => ({ wch: Math.min(60, Math.max(String(h).length + 2, ...aoa.slice(1).map(row => String(row[i] ?? '').length), 10)) }))
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  XLSX.writeFile(wb, `laporan-${r.event.name}.xlsx`)
}
