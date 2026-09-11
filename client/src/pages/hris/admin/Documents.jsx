import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../../api'
import Modal from '../../../components/Modal'
import SearchableSelect from '../../../components/SearchableSelect'
import { useCompanyGuard } from '../../../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../../../components/CompanyRequiredBanner'
import { Plus, Trash2, Pencil, RefreshCw, ExternalLink } from 'lucide-react'

const TYPE_LABEL = { KTP: 'KTP', NPWP: 'NPWP', CONTRACT: 'Kontrak Kerja', OTHER: 'Lainnya' }
const TYPE_OPTIONS = Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function ExpiryBadge({ expiryDate }) {
  if (!expiryDate) return <span className="text-slate-300">—</span>
  const daysLeft = Math.ceil((new Date(expiryDate) - new Date()) / 86400000)
  if (daysLeft < 0) return <span className="badge-red">Kedaluwarsa · {fmtDate(expiryDate)}</span>
  if (daysLeft <= 30) return <span className="badge-amber">{fmtDate(expiryDate)}</span>
  return <span className="text-slate-500">{fmtDate(expiryDate)}</span>
}

const EMPTY_FORM = { userId: '', type: 'KTP', title: '', expiryDate: '', note: '', document: null }

function UploadDocumentModal({ users, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(EMPTY_FORM)

  const create = useMutation({
    mutationFn: hrisApi.createEmployeeDocument,
    onSuccess: () => { toast.success('Dokumen berhasil diunggah'); qc.invalidateQueries({ queryKey: ['hris-employee-documents'] }); onClose() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal mengunggah dokumen'),
  })

  return (
    <Modal open onClose={onClose} title="Upload Dokumen Karyawan" size="md">
      <form onSubmit={e => { e.preventDefault(); create.mutate(form) }} className="space-y-4">
        <div>
          <label className="label">Karyawan</label>
          <SearchableSelect
            value={form.userId}
            onChange={v => setForm(f => ({ ...f, userId: v }))}
            options={users.map(u => ({ value: u.id, label: u.name }))}
            placeholder="Pilih karyawan…"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Jenis Dokumen</label>
            <select required className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tgl Kedaluwarsa (opsional)</label>
            <input type="date" className="input" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Judul</label>
            <input required className="input" placeholder="mis. KTP 2026, Kontrak Kerja Tahun 2026" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Catatan (opsional)</label>
            <textarea className="input" rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">File (gambar atau PDF, maks 10MB)</label>
            <input
              type="file"
              required
              accept="image/*,application/pdf"
              className="input"
              onChange={e => setForm(f => ({ ...f, document: e.target.files?.[0] ?? null }))}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
          <button type="submit" disabled={create.isPending} className="btn-primary flex-1 justify-center">
            {create.isPending ? 'Mengunggah…' : 'Upload'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function EditDocumentModal({ doc, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    type: doc.type,
    title: doc.title,
    expiryDate: doc.expiryDate ?? '',
    note: doc.note ?? '',
  })

  const update = useMutation({
    mutationFn: (data) => hrisApi.updateEmployeeDocument(doc.id, data),
    onSuccess: () => { toast.success('Dokumen diperbarui'); qc.invalidateQueries({ queryKey: ['hris-employee-documents'] }); onClose() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal memperbarui dokumen'),
  })

  return (
    <Modal open onClose={onClose} title={`Edit Dokumen — ${doc.user?.name ?? ''}`} size="md">
      <form onSubmit={e => { e.preventDefault(); update.mutate(form) }} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Jenis Dokumen</label>
            <select required className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tgl Kedaluwarsa</label>
            <input type="date" className="input" value={form.expiryDate ?? ''} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Judul</label>
            <input required className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Catatan</label>
            <textarea className="input" rows={2} value={form.note ?? ''} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
          <button type="submit" disabled={update.isPending} className="btn-primary flex-1 justify-center">
            {update.isPending ? 'Menyimpan…' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function DocumentsAdmin() {
  const qc = useQueryClient()
  const { needsCompany } = useCompanyGuard()
  const [showUpload, setShowUpload] = useState(false)
  const [editingDoc, setEditingDoc] = useState(null)
  const [replacingId, setReplacingId] = useState(null)

  const { data: users } = useQuery({ queryKey: ['hris-employee-documents', 'employees'], queryFn: hrisApi.employeeDocumentEmployees })
  const { data: list, isLoading } = useQuery({ queryKey: ['hris-employee-documents', 'admin'], queryFn: () => hrisApi.employeeDocuments({ limit: 200 }) })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['hris-employee-documents'] })
  const remove = useMutation({ mutationFn: hrisApi.deleteEmployeeDocument, onSuccess: () => { toast.success('Dokumen dihapus'); invalidate() }, onError: e => toast.error(e.response?.data?.message ?? 'Gagal menghapus') })
  const replaceFile = useMutation({
    mutationFn: ({ id, file }) => hrisApi.replaceEmployeeDocumentFile(id, file),
    onSuccess: () => { toast.success('File dokumen diganti'); invalidate() },
    onError: e => toast.error(e.response?.data?.message ?? 'Gagal mengganti file'),
    onSettled: () => setReplacingId(null),
  })

  function handleReplaceFile(id, file) {
    if (!file) return
    setReplacingId(id)
    replaceFile.mutate({ id, file })
  }

  const rows = list?.data ?? []

  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Dokumen Karyawan</h1>
          <p className="text-xs text-slate-400 mt-0.5">KTP, NPWP, kontrak kerja, dan dokumen lain milik karyawan</p>
        </div>
        <button
          onClick={() => { if (needsCompany) return toast.error('Pilih perusahaan terlebih dahulu'); setShowUpload(true) }}
          className="btn-primary text-sm flex items-center gap-1.5"
        >
          <Plus size={14} /> Upload Dokumen
        </button>
      </div>

      {needsCompany && <div className="mb-6"><CompanyRequiredBanner action="upload dokumen karyawan" /></div>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Karyawan</th>
                <th className="th">Jenis</th>
                <th className="th">Judul</th>
                <th className="th">Kedaluwarsa</th>
                <th className="th">Diunggah oleh</th>
                <th className="th text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Memuat…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Belum ada dokumen</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="tr">
                  <td className="td font-medium">{r.user?.name ?? '—'}</td>
                  <td className="td">{TYPE_LABEL[r.type] ?? r.type}</td>
                  <td className="td">{r.title}</td>
                  <td className="td"><ExpiryBadge expiryDate={r.expiryDate} /></td>
                  <td className="td text-slate-500">{r.uploader?.name ?? '—'}</td>
                  <td className="td text-center">
                    <div className="flex gap-1.5 justify-center items-center">
                      <a title="Lihat file" href={r.url} target="_blank" rel="noreferrer" className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100">
                        <ExternalLink size={14} />
                      </a>
                      <button title="Edit" onClick={() => setEditingDoc(r)} className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100">
                        <Pencil size={14} />
                      </button>
                      <label title="Ganti file" className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer">
                        {replacingId === r.id ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={e => handleReplaceFile(r.id, e.target.files?.[0])}
                        />
                      </label>
                      <button title="Hapus" onClick={() => remove.mutate(r.id)} className="w-7 h-7 rounded flex items-center justify-center text-red-600 hover:bg-red-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showUpload && <UploadDocumentModal users={users ?? []} onClose={() => setShowUpload(false)} />}
      {editingDoc && <EditDocumentModal doc={editingDoc} onClose={() => setEditingDoc(null)} />}
    </div>
  )
}
