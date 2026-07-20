import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '../Modal'
import { tasksApi } from '../../api'
import toast from 'react-hot-toast'
import { PRIORITY_CONFIG } from './taskConfig'

const EMPTY_FORM = { title: '', priority: 'MEDIUM', dueDate: '', assigneeId: '' }

export default function CreateTaskModal({ open, onClose, userOptions, defaultView }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(EMPTY_FORM)

  const create = useMutation({
    mutationFn: (d) => tasksApi.create({
      ...d,
      dueDate: d.dueDate || null,
      assigneeId: d.assigneeId || null,
      isImportant: defaultView === 'important' || undefined,
      myDayDate: defaultView === 'my_day' ? new Date().toISOString().slice(0, 10) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Task dibuat')
      setForm(EMPTY_FORM)
      onClose()
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  return (
    <Modal open={open} onClose={onClose} title="Task Baru">
      <form onSubmit={e => { e.preventDefault(); create.mutate(form) }} className="space-y-4">
        <div>
          <label className="label">Judul</label>
          <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required autoFocus placeholder="cth. Follow up vendor A" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Priority</label>
            <select className="select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Due Date</label>
            <input type="date" className="input" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="label">Assignee</label>
          <select className="select" value={form.assigneeId} onChange={e => setForm(f => ({ ...f, assigneeId: e.target.value }))}>
            <option value="">Tidak ditugaskan</option>
            {userOptions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
          <button type="submit" disabled={create.isPending} className="btn-primary flex-1 justify-center">{create.isPending ? 'Menyimpan…' : 'Buat Task'}</button>
        </div>
      </form>
    </Modal>
  )
}
