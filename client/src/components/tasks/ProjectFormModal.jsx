import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '../Modal'
import { projectsApi } from '../../api'
import { PROJECT_STATUS_CONFIG, PROJECT_COLORS } from './taskConfig'

const EMPTY_FORM = {
  name: '', description: '', color: PROJECT_COLORS[0], status: 'ACTIVE',
  startDate: '', dueDate: '', ownerId: '',
}

// Satu modal dipakai untuk bikin & edit project — `project` null berarti mode
// bikin baru (pola yang sama dengan modal CRUD lain di app ini).
export default function ProjectFormModal({ open, onClose, project, userOptions = [], defaultColor }) {
  const qc = useQueryClient()
  const [syncedId, setSyncedId] = useState('new')
  const [form, setForm] = useState(EMPTY_FORM)

  // Sinkronkan form saat modal dibuka untuk project lain (pola "adjust state
  // when a prop changes", sama seperti TaskDetailPanel).
  const key = project ? `edit:${project.id}` : `new:${open}`
  if (key !== syncedId) {
    setSyncedId(key)
    setForm(project ? {
      name: project.name,
      description: project.description || '',
      color: project.color || PROJECT_COLORS[0],
      status: project.status,
      startDate: project.startDate || '',
      dueDate: project.dueDate || '',
      ownerId: project.ownerId || '',
    } : { ...EMPTY_FORM, color: defaultColor || PROJECT_COLORS[0] })
  }

  const save = useMutation({
    mutationFn: (d) => {
      const payload = {
        ...d,
        description: d.description || null,
        startDate: d.startDate || null,
        dueDate: d.dueDate || null,
        ownerId: d.ownerId || null,
      }
      return project ? projectsApi.update(project.id, payload) : projectsApi.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['project-detail'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      toast.success(project ? 'Project diperbarui' : 'Project dibuat')
      onClose()
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  return (
    <Modal open={open} onClose={onClose} title={project ? 'Edit Project' : 'Project Baru'}>
      <form onSubmit={e => { e.preventDefault(); save.mutate(form) }} className="space-y-4">
        <div>
          <label className="label">Nama Project</label>
          <input
            className="input"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
            autoFocus
            placeholder="cth. Revamp Gudang Reject"
          />
        </div>

        <div>
          <label className="label">Deskripsi</label>
          <textarea
            className="input"
            rows={2}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Tujuan & ruang lingkup project (opsional)"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Status</label>
            <select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {Object.entries(PROJECT_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">PIC</label>
            <select className="select" value={form.ownerId} onChange={e => setForm(f => ({ ...f, ownerId: e.target.value }))}>
              <option value="">Tanpa PIC</option>
              {userOptions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Mulai</label>
            <input type="date" className="input" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div>
            <label className="label">Deadline</label>
            <input type="date" className="input" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="label">Warna</label>
          <div className="flex items-center gap-2">
            {PROJECT_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setForm(f => ({ ...f, color: c }))}
                className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
          <button type="submit" disabled={save.isPending} className="btn-primary flex-1 justify-center">
            {save.isPending ? 'Menyimpan…' : project ? 'Simpan' : 'Buat Project'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
