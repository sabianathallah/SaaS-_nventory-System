import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../../api'
import { Plus, X, Trash2, MapPin, LocateFixed } from 'lucide-react'

export default function Locations() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', latitude: '', longitude: '', radiusMeters: 150 })

  const { data: locations, isLoading } = useQuery({ queryKey: ['hris-locations'], queryFn: hrisApi.officeLocations })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['hris-locations'] })

  const create = useMutation({
    mutationFn: hrisApi.createOfficeLocation,
    onSuccess: () => { toast.success('Lokasi ditambahkan'); setShowForm(false); setForm({ name: '', address: '', latitude: '', longitude: '', radiusMeters: 150 }); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal menambahkan lokasi'),
  })
  const destroy = useMutation({
    mutationFn: hrisApi.deleteOfficeLocation,
    onSuccess: () => { toast.success('Lokasi dihapus'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal menghapus lokasi'),
  })

  function useCurrentLocation() {
    if (!navigator.geolocation) return toast.error('Geolocation tidak didukung browser ini')
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(7), longitude: pos.coords.longitude.toFixed(7) })),
      () => toast.error('Gagal mengambil lokasi saat ini'),
      { enableHighAccuracy: true }
    )
  }

  return (
    <div className="px-6 py-6 max-w-4xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Lokasi Kantor</h1>
          <p className="text-xs text-slate-400 mt-0.5">Titik lokasi & radius yang digunakan untuk validasi presensi (geofencing)</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary text-sm flex items-center gap-1.5">
          {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? 'Batal' : 'Tambah Lokasi'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate({ ...form, latitude: Number(form.latitude), longitude: Number(form.longitude), radiusMeters: Number(form.radiusMeters) }) }}
          className="card p-5 mb-6 grid sm:grid-cols-2 gap-4"
        >
          <div className="sm:col-span-2">
            <label className="label">Nama Lokasi</label>
            <input required className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Kantor Pusat" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Alamat</label>
            <input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div>
            <label className="label">Latitude</label>
            <input required type="number" step="any" className="input" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} />
          </div>
          <div>
            <label className="label">Longitude</label>
            <input required type="number" step="any" className="input" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} />
          </div>
          <div>
            <label className="label">Radius (meter)</label>
            <input required type="number" min="10" className="input" value={form.radiusMeters} onChange={e => setForm(f => ({ ...f, radiusMeters: e.target.value }))} />
          </div>
          <div className="flex items-end">
            <button type="button" onClick={useCurrentLocation} className="btn-secondary text-sm flex items-center gap-1.5">
              <LocateFixed size={14} /> Gunakan Lokasi Saat Ini
            </button>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={create.isPending} className="btn-primary text-sm">
              {create.isPending ? 'Menyimpan…' : 'Simpan Lokasi'}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Nama</th>
                <th className="th">Koordinat</th>
                <th className="th">Radius</th>
                <th className="th text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="td py-8 text-center text-slate-400">Memuat…</td></tr>
              ) : (locations ?? []).length === 0 ? (
                <tr><td colSpan={4} className="td py-8 text-center text-slate-400">Belum ada lokasi kantor</td></tr>
              ) : locations.map(l => (
                <tr key={l.id} className="tr">
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <MapPin size={13} className="text-brand flex-shrink-0" />
                      <div>
                        <div className="font-medium">{l.name}</div>
                        {l.address && <div className="text-xs text-slate-400">{l.address}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="td text-xs font-mono">{Number(l.latitude).toFixed(5)}, {Number(l.longitude).toFixed(5)}</td>
                  <td className="td">{l.radiusMeters}m</td>
                  <td className="td text-center">
                    <button title="Hapus" onClick={() => destroy.mutate(l.id)} className="w-7 h-7 rounded flex items-center justify-center text-red-500 hover:bg-red-50">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
