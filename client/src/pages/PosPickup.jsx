import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { PackageCheck, Search, MessageCircle, Undo2, Check, Clock } from 'lucide-react'
import { posApi } from '../api'
import PageHeader from '../components/PageHeader'

// Antrean Pengambilan: dibuka staff gudang/operasional di perangkat lain, jadi kasir fokus melayani.
// Pembeli "ambil nanti" datang -> scan barcode struk / cari nama / 4 digit HP -> cocokkan barang -> Sudah diambil.
const shortName = (n) => String(n || '').replace(/[\u200b-\u200d\u2060\ufeff]/g, '').replace(/\s+PREFACE\s+-\s+/i, ' · ').replace(/\s+PREFACE$/i, '').trim()
const ago = (d) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000))
  return m < 1 ? 'baru saja' : m < 60 ? `${m} mnt lalu` : `${Math.floor(m / 60)} jam ${m % 60} mnt lalu`
}
// 08xx / 8xx / +628xx -> 628xx untuk link WhatsApp
const waNumber = (p) => {
  const d = String(p || '').replace(/\D/g, '')
  return d.startsWith('0') ? '62' + d.slice(1) : d.startsWith('8') ? '62' + d : d
}

export default function PosPickup() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState('PENDING')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const searchRef = useRef(null)

  const { data: events = [] } = useQuery({ queryKey: ['pos-events'], queryFn: posApi.events })
  const eventId = params.get('event') || events.find(e => e.status === 'OPEN')?.id || events[0]?.id || ''
  const event = events.find(e => String(e.id) === String(eventId))

  const { data, isFetching } = useQuery({
    queryKey: ['pos-pickup', eventId, tab, q],
    queryFn: () => posApi.orders({ eventId, fulfillment: 'LATER', status: 'PAID', pickupStatus: tab, search: q || undefined, limit: 100 }),
    enabled: !!eventId,
    refetchInterval: 10_000, // transaksi baru dari laptop kasir muncul sendiri
  })
  const { data: pendingCount } = useQuery({
    queryKey: ['pos-pickup-count', eventId],
    queryFn: () => posApi.orders({ eventId, fulfillment: 'LATER', status: 'PAID', pickupStatus: 'PENDING', limit: 1 }),
    enabled: !!eventId, refetchInterval: 10_000,
  })
  const rows = data?.data ?? []

  const mark = useMutation({
    mutationFn: ({ id, status }) => posApi.setPickup(id, status),
    onSuccess: (o) => {
      toast.success(o.pickupStatus === 'DONE' ? `${o.pickupCode} sudah diambil` : `${o.pickupCode} dikembalikan ke antrean`)
      setConfirmId(null)
      qc.invalidateQueries({ queryKey: ['pos-pickup'] }); qc.invalidateQueries({ queryKey: ['pos-pickup-count'] })
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Gagal menyimpan'),
  })

  // scan barcode struk = ketik cepat + Enter di kolom cari
  useEffect(() => { searchRef.current?.focus() }, [tab, eventId])
  const submitSearch = (e) => { e.preventDefault(); setQ(search.trim()) }

  return (
    <div className="px-6 py-6 space-y-5">
      <PageHeader title="Antrean Pengambilan" subtitle="Barang yang sudah dibayar dan menunggu diambil pembeli — diperbarui otomatis tiap 10 detik"
        action={events.length > 1 && (
          <select className="input" value={eventId} onChange={e => setParams({ event: e.target.value })}>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
        )} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl bg-white border border-slate-200 p-1">
          {[['PENDING', `Belum diambil${pendingCount ? ` (${pendingCount.pagination?.total ?? 0})` : ''}`], ['DONE', 'Sudah diambil']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 h-9 rounded-lg text-sm font-semibold ${tab === k ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>{l}</button>
          ))}
        </div>
        <form onSubmit={submitSearch} className="relative flex-1 min-w-[280px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input ref={searchRef} className="w-full h-11 pl-10 pr-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/30"
            value={search} onChange={e => { setSearch(e.target.value); if (!e.target.value) setQ('') }}
            placeholder="Scan barcode struk, nomor ambil, nama, atau 4 digit terakhir No. HP…" />
        </form>
        {isFetching && <span className="text-xs text-slate-400">memuat…</span>}
      </div>

      {!event ? <p className="text-sm text-slate-400">Belum ada event.</p> : !rows.length ? (
        <div className="card p-10 text-center text-slate-400">
          <PackageCheck className="mx-auto text-slate-300" size={36} />
          <p className="mt-2">{q ? `Tidak ada yang cocok dengan "${q}"` : tab === 'PENDING' ? 'Tidak ada barang yang menunggu diambil.' : 'Belum ada yang diambil.'}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map(o => {
            const phone = waNumber(o.customerPhone)
            const msg = encodeURIComponent(`Halo ${o.customerName || 'kak'}, pesanan Preface kamu (nomor ambil ${o.pickupCode}) sudah siap diambil di booth kami. Terima kasih!`)
            return (
              <div key={o.id} className={`card p-5 ${q && rows.length === 1 ? 'ring-2 ring-brand' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold tracking-[.2em] text-slate-400">NOMOR AMBIL</p>
                    <p className="text-3xl font-black tracking-wide text-slate-900">{o.pickupCode || o.orderNumber}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p className="inline-flex items-center gap-1"><Clock size={12} />{tab === 'PENDING' ? ago(o.soldAt) : `diambil ${ago(o.pickedUpAt)}`}</p>
                    <p className="font-mono mt-0.5">{o.orderNumber}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{o.customerName || 'Tanpa nama'}</p>
                    <p className="text-xs text-slate-500">{o.customerPhone ? `HP ••••${String(o.customerPhone).slice(-4)}` : 'No. HP tidak diisi'}</p>
                  </div>
                  {phone && (
                    <a className="btn-secondary text-xs shrink-0" href={`https://wa.me/${phone}?text=${msg}`} target="_blank" rel="noreferrer"><MessageCircle size={13} />WhatsApp</a>
                  )}
                </div>
                <ul className="mt-3 divide-y divide-slate-100">
                  {o.items.map(i => (
                    <li key={i.id} className="py-2 flex items-center gap-3 text-sm">
                      <span className="font-bold w-7">{i.qty}×</span>
                      <span className="flex-1 font-medium text-slate-800">{shortName(i.name)}</span>
                      <span className="min-w-[32px] text-center text-xs font-bold px-1.5 py-0.5 rounded border border-slate-300">{i.variant || '—'}</span>
                    </li>
                  ))}
                </ul>
                {tab === 'PENDING' ? (
                  confirmId === o.id ? (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button className="btn-secondary justify-center" onClick={() => setConfirmId(null)}>Batal</button>
                      <button className="btn-primary justify-center" disabled={mark.isPending} onClick={() => mark.mutate({ id: o.id, status: 'DONE' })}><Check size={14} />Ya, sudah diserahkan</button>
                    </div>
                  ) : (
                    <button className="mt-4 w-full h-11 rounded-xl bg-slate-900 text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-slate-800" onClick={() => setConfirmId(o.id)}>
                      <PackageCheck size={16} />Sudah diambil
                    </button>
                  )
                ) : (
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                    <span>Diserahkan oleh {o.PickedUpBy?.name || '—'}</span>
                    <button className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-700" onClick={() => mark.mutate({ id: o.id, status: 'PENDING' })}><Undo2 size={12} />Batalkan tanda</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
