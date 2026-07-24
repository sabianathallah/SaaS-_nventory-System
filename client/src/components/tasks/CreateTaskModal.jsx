import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '../Modal'
import { tasksApi, taskListsApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { PRIORITY_CONFIG, RECURRENCE_CONFIG } from './taskConfig'
import DescriptionEditor from './DescriptionEditor'
import AssigneeMultiSelect from './AssigneeMultiSelect'

const EMPTY_FORM = {
  title: '', description: '', priority: 'MEDIUM', dueDate: '', assigneeIds: [],
  listId: '', tags: '', reminderAt: '', recurrence: 'NONE',
}

export default function CreateTaskModal({ open, onClose, userOptions, defaultView, divisi }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [form, setForm] = useState(EMPTY_FORM)

  // Task lands in the folder it's created from; outside a folder it falls
  // back to the creator's own divisi (mirrors the server-side default).
  const effectiveDivisi = divisi || user?.divisi || null

  const { data: lists } = useQuery({
    queryKey: ['task-lists', effectiveDivisi],
    queryFn: () => taskListsApi.list({ divisi: effectiveDivisi }),
    enabled: open && !!effectiveDivisi,
  })

  const create = useMutation({
    mutationFn: (d) => tasksApi.create({
      ...d,
      dueDate: d.dueDate || null,
      assigneeIds: d.assigneeIds,
      listId: d.listId || null,
      divisi: divisi || undefined,
      tags: d.tags ? d.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      reminderAt: d.reminderAt || null,
      isImportant: defaultView === 'important' || undefined,
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
        <div>
          <label className="label">Deskripsi</label>
          <DescriptionEditor value={form.description} onChange={(v) => setForm(f => ({ ...f, description: v }))} />
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Assignee</label>
            <AssigneeMultiSelect value={form.assigneeIds} onChange={ids => setForm(f => ({ ...f, assigneeIds: ids }))} options={userOptions} />
          </div>
          {effectiveDivisi && (
            <div>
              <label className="label">List</label>
              <select className="select" value={form.listId} onChange={e => setForm(f => ({ ...f, listId: e.target.value }))}>
                <option value="">Tanpa list</option>
                {(lists ?? []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div>
          <label className="label">Tags</label>
          <input className="input" placeholder="pisahkan dengan koma, cth. urgent, vendor" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Reminder</label>
            <input type="datetime-local" className="input" value={form.reminderAt} onChange={e => setForm(f => ({ ...f, reminderAt: e.target.value }))} />
          </div>
          <div>
            <label className="label">Ulangi</label>
            <select className="select" value={form.recurrence} onChange={e => setForm(f => ({ ...f, recurrence: e.target.value }))}>
              {Object.entries(RECURRENCE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
          <button type="submit" disabled={create.isPending} className="btn-primary flex-1 justify-center">{create.isPending ? 'Menyimpan…' : 'Buat Task'}</button>
        </div>
      </form>
    </Modal>
  )
}
