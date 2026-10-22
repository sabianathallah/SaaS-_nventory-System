import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { posApi, warehousesApi, channelsApi } from '../api'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Pencil, Store, BarChart2, Repeat2, Play, Square } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCompanyGuard } from '../hooks/useCompanyGuard'

const STATUS = {
  PREP:   { label: 'Persiapan', cls: 'badge-amber' },
  OPEN:   { label: 'Berjalan',  cls: 'badge-green' },
  CLOSED: { label: 'Selesai',   cls: 'badge-muted' },
}
const EMPTY = { name: '', location: '', startDate: '', endDate: '', WarehouseId: '', ChannelId: '', receiptHeader: '', receiptFooter: 'Terima kasih!' }

export default function PosEvents() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const { needsCompany } = useCompanyGuard()
  const canManage = hasPermission('pos.manage') || hasPermission('pos.event.manage')
  const canSell   = hasPermission('pos.manage') || hasPermission('pos.sell')
  const canReport = canManage || hasPermission('pos.report')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const { data: events = [], isLoading } = useQuery({ queryKey: ['pos-events'], queryFn: posApi.events })
  const { data: whs } = useQuery({ queryKey: ['warehouses', { limit: 500 }], queryFn: () => warehousesApi.list({ limit: 500 }), enabled: canManage })
  const { data: chs } = useQuery({ queryKey: ['channels', { limit: 500 }], queryFn: () => channelsApi.list({ limit: 500 }), enabled: canManage })

  const save = useMutation({
    mutationFn: (d) => modal?.data ? posApi.updateEvent(modal.data.id, d) : posApi.createEvent(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pos-events'] }); toast.success('Event disimpan'); setModal(null) },
    onError: (e) => toast.error(e.response?.data?.message || 'Gagal menyimpan event'),
  })
  const setStatus = useMutation({
    mutationFn: ({ id, status }) => posApi.updateEvent(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos-events'] }),
    onError: (e) => toast.error(e.response?.data?.message || 'Gagal mengubah status'),
  })

  const openForm = (ev) => {
    setForm(ev ? { ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map(k => [k, ev[k] ?? ''])) } : EMPTY)
    setModal({ data: ev || null })
  }
  const submit = (e) => {
    e.preventDefault()
    const payload = { ...form, startDate: form.startDate || null, endDate: form.endDate || null }
    save.mutate(payload)
  }

  return (
    <div className="px-6 py-6 space-y-5">
      <PageHeader title="Event Pop Up" subtitle="Kasir untuk event: stok dari gudang khusus event, penjualan tercatat sebagai Stock Out Penjualan"
        action={canManage && (
          <button className="btn-primary" onClick={() => needsCompany ? toast.error('Pilih perusahaan terlebih dahulu') : openForm(null)}>
            <Plus size={14} />Event Baru
          </button>
        )}
      />

      <div className="card p-4 text-sm text-slate-600 space-y-1">
        <p className="font-semibold text-slate-800">Alur event</p>
        <p>1. Buat gudang khusus event (menu Gudang) dan channel penjualan event (Data Master), lalu buat event di sini.</p>
        <p>2. <b>Transfer Stok</b> dari Gudang Ready ke gudang event, lalu klik <b>Mulai</b>.</p>
        <p>3. Kasir membuka <b>Kasir</b> di laptop saat masih online (katalog tersimpan untuk mode offline).</p>
        <p>4. Selesai event: tutup shift, <b>Stock Opname</b> gudang event, transfer sisa barang balik ke Ready, lalu klik <b>Selesai</b>.</p>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <p className="p-6 text-sm text-slate-400">Memuat…</p> : !events.length ? (
          <p className="p-6 text-sm text-slate-400">Belum ada event.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr><th className="text-left px-4 py-2">Event</th><th className="text-left px-4 py-2">Gudang</th><th className="text-left px-4 py-2">Channel</th>
                <th className="text-left px-4 py-2">Tanggal</th><th className="text-left px-4 py-2">Status</th><th /></tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.id} className="border-t border-slate-100">
                  <td className="px-4 py-3"><p className="font-semibold text-slate-800">{ev.name}</p><p className="text-xs text-slate-400">{ev.location || '—'}</p></td>
                  <td className="px-4 py-3 text-slate-600">{ev.Warehouse?.name}</td>
                  <td className="px-4 py-3 text-slate-600">{ev.Channel?.name}</td>
                  <td className="px-4 py-3 text-slate-500">{ev.startDate || '—'}{ev.endDate && ev.endDate !== ev.startDate ? ` s/d ${ev.endDate}` : ''}</td>
                  <td className="px-4 py-3"><span className={STATUS[ev.status]?.cls}>{STATUS[ev.status]?.label}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end flex-wrap">
                      {canSell && ev.status === 'OPEN' && (
                        <button className="btn-primary text-xs" onClick={() => navigate(`/pos/kasir/${ev.id}`)}><Store size={13} />Kasir</button>
                      )}
                      {canManage && ev.status === 'PREP' && (
                        <>
                          <button className="btn-secondary text-xs" onClick={() => navigate('/transfers')}><Repeat2 size={13} />Transfer stok</button>
                          <button className="btn-secondary text-xs" onClick={() => setStatus.mutate({ id: ev.id, status: 'OPEN' })}><Play size={13} />Mulai</button>
                        </>
                      )}
                      {canManage && ev.status === 'OPEN' && (
                        <button className="btn-secondary text-xs" onClick={() => setStatus.mutate({ id: ev.id, status: 'CLOSED' })}><Square size={13} />Selesai</button>
                      )}
                      {canReport && <button className="btn-secondary text-xs" onClick={() => navigate(`/pos/events/${ev.id}/report`)}><BarChart2 size={13} />Laporan</button>}
                      {canManage && <button className="p-1.5 rounded text-slate-400 btn-edit" onClick={() => openForm(ev)}><Pencil size={13} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.data ? 'Edit Event' : 'Event Baru'}>
        <form onSubmit={submit} className="space-y-3">
          <div><label className="label">Nama event</label><input className="input" value={form.name} onChange={set('name')} required autoFocus placeholder="mis. Pop Up Senayan 5 Nov" /></div>
          <div><label className="label">Lokasi</label><input className="input" value={form.location} onChange={set('location')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Mulai</label><input type="date" className="input" value={form.startDate} onChange={set('startDate')} /></div>
            <div><label className="label">Selesai</label><input type="date" className="input" value={form.endDate} onChange={set('endDate')} /></div>
          </div>
          <div>
            <label className="label">Gudang event</label>
            <select className="input" value={form.WarehouseId} onChange={set('WarehouseId')} required>
              <option value="">Pilih gudang…</option>
              {(whs?.data ?? []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <p className="text-xs text-slate-400 mt-1">Pakai gudang khusus event, jangan Gudang Ready.</p>
          </div>
          <div>
            <label className="label">Channel penjualan</label>
            <select className="input" value={form.ChannelId} onChange={set('ChannelId')} required>
              <option value="">Pilih channel…</option>
              {(chs?.data ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Baris tambahan di struk (opsional)</label><input className="input" value={form.receiptHeader} onChange={set('receiptHeader')} placeholder="mis. IG @preface · preface.id" /></div>
          <div><label className="label">Catatan bawah struk</label><textarea className="input" rows={2} value={form.receiptFooter} onChange={set('receiptFooter')} /></div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 justify-center">{save.isPending ? 'Menyimpan…' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
