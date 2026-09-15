import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../../api'
import Modal from '../../../components/Modal'
import SearchableSelect from '../../../components/SearchableSelect'
import { Plus, Download, Check, RotateCcw, Trash2, Loader2, Pencil } from 'lucide-react'
import { useCompanyGuard } from '../../../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../../../components/CompanyRequiredBanner'

const STATUS_LABEL = { DRAFT: 'Draft', PUBLISHED: 'Published' }
const STATUS_COLOR = { DRAFT: 'badge-amber', PUBLISHED: 'badge-green' }
const fmtRp = (n) => `Rp ${Number(n ?? 0).toLocaleString('id-ID')}`
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const EMPTY_FORM = { userId: '', periodStart: '', periodEnd: '', paymentDate: '', overtime: 0, bonus: 0, otherDeductions: 0 }

function GeneratePayslipModal({ users, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(EMPTY_FORM)

  const selectedUser = users.find(u => String(u.id) === String(form.userId))
  const fixedSalary = Number(selectedUser?.salaryProfile?.fixedSalary ?? 0)
  const allowanceTransport = Number(selectedUser?.salaryProfile?.allowanceTransport ?? 0)
  const allowanceMeal = Number(selectedUser?.salaryProfile?.allowanceMeal ?? 0)

  const totalEarnings = fixedSalary + allowanceTransport + allowanceMeal + Number(form.overtime || 0) + Number(form.bonus || 0)
  const totalDeductions = Number(form.otherDeductions || 0)
  const netPay = totalEarnings - totalDeductions

  const create = useMutation({
    mutationFn: hrisApi.createPayslip,
    onSuccess: () => { toast.success('Slip gaji berhasil dibuat (Draft)'); qc.invalidateQueries({ queryKey: ['hris-payslips'] }); onClose() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal membuat slip gaji'),
  })

  return (
    <Modal open onClose={onClose} title="Generate Slip Gaji" size="md">
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
          {selectedUser && !selectedUser.salaryProfile && (
            <p className="text-xs text-amber-600 mt-1">Karyawan ini belum punya Profil Gaji — isi dulu di halaman Profil Gaji, atau lanjut dengan Rp 0.</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Periode Dari</label>
            <input type="date" required className="input" value={form.periodStart} onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))} />
          </div>
          <div>
            <label className="label">Periode Sampai</label>
            <input type="date" required className="input" value={form.periodEnd} onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Tanggal Pembayaran</label>
            <input type="date" required className="input" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} />
          </div>
          <div>
            <label className="label">Overtime (Rp)</label>
            <input type="number" min="0" className="input" value={form.overtime} onChange={e => setForm(f => ({ ...f, overtime: e.target.value }))} />
          </div>
          <div>
            <label className="label">Bonus (Rp)</label>
            <input type="number" min="0" className="input" value={form.bonus} onChange={e => setForm(f => ({ ...f, bonus: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Potongan Lainnya (Rp)</label>
            <input type="number" min="0" className="input" value={form.otherDeductions} onChange={e => setForm(f => ({ ...f, otherDeductions: e.target.value }))} />
          </div>
        </div>

        {form.userId && (
          <div className="card p-3 bg-slate-50/50 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">Fixed Salary</span><span className="font-semibold">{fmtRp(fixedSalary)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Tunjangan Transportasi</span><span className="font-semibold">{fmtRp(allowanceTransport)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Tunjangan Makan</span><span className="font-semibold">{fmtRp(allowanceMeal)}</span></div>
            <div className="flex justify-between pt-1 border-t border-slate-200"><span className="text-slate-600 font-semibold">Total Earnings</span><span className="font-bold text-emerald-600">{fmtRp(totalEarnings)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600 font-semibold">Total Deductions</span><span className="font-bold text-red-600">{fmtRp(totalDeductions)}</span></div>
            <div className="flex justify-between pt-1 border-t border-slate-200"><span className="text-slate-800 font-bold">Net Pay</span><span className="font-bold text-slate-800">{fmtRp(netPay)}</span></div>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
          <button type="submit" disabled={create.isPending} className="btn-primary flex-1 justify-center">
            {create.isPending ? 'Membuat…' : 'Generate (Draft)'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// Edit slip DRAFT — semua komponen bisa diubah (gaji pokok, tunjangan,
// lembur, bonus, potongan, tanggal). Slip PUBLISHED harus ditarik ke Draft
// dulu. Total dihitung ulang backend, preview di sini cuma estimasi live.
function EditPayslipModal({ payslip, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    periodStart: payslip.periodStart,
    periodEnd: payslip.periodEnd,
    paymentDate: payslip.paymentDate,
    fixedSalary: Number(payslip.fixedSalary),
    allowanceTransport: Number(payslip.allowanceTransport),
    allowanceMeal: Number(payslip.allowanceMeal),
    overtime: Number(payslip.overtime),
    bonus: Number(payslip.bonus),
    otherDeductions: Number(payslip.otherDeductions),
  })

  const totalEarnings = Number(form.fixedSalary || 0) + Number(form.allowanceTransport || 0) + Number(form.allowanceMeal || 0) + Number(form.overtime || 0) + Number(form.bonus || 0)
  const totalDeductions = Number(form.otherDeductions || 0)
  const netPay = totalEarnings - totalDeductions

  const update = useMutation({
    mutationFn: (data) => hrisApi.updatePayslip(payslip.id, data),
    onSuccess: () => { toast.success('Slip gaji diperbarui'); qc.invalidateQueries({ queryKey: ['hris-payslips'] }); onClose() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal memperbarui slip gaji'),
  })

  const NUM_FIELDS = [
    ['fixedSalary', 'Gaji Pokok (Rp)'],
    ['allowanceTransport', 'Tunjangan Transportasi (Rp)'],
    ['allowanceMeal', 'Tunjangan Makan (Rp)'],
    ['overtime', 'Overtime (Rp)'],
    ['bonus', 'Bonus (Rp)'],
    ['otherDeductions', 'Potongan Lainnya (Rp)'],
  ]

  return (
    <Modal open onClose={onClose} title={`Edit Slip Gaji — ${payslip.user?.name ?? ''}`} size="md">
      <form onSubmit={e => { e.preventDefault(); update.mutate(form) }} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Periode Dari</label>
            <input type="date" required className="input" value={form.periodStart} onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))} />
          </div>
          <div>
            <label className="label">Periode Sampai</label>
            <input type="date" required className="input" value={form.periodEnd} onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Tanggal Pembayaran</label>
            <input type="date" required className="input" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} />
          </div>
          {NUM_FIELDS.map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input type="number" min="0" className="input" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
        </div>

        <div className="card p-3 bg-slate-50/50 space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-slate-600 font-semibold">Total Earnings</span><span className="font-bold text-emerald-600">{fmtRp(totalEarnings)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600 font-semibold">Total Deductions</span><span className="font-bold text-red-600">{fmtRp(totalDeductions)}</span></div>
          <div className="flex justify-between pt-1 border-t border-slate-200"><span className="text-slate-800 font-bold">Net Pay</span><span className="font-bold text-slate-800">{fmtRp(netPay)}</span></div>
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

export default function Payslips() {
  const qc = useQueryClient()
  const { needsCompany } = useCompanyGuard()
  const [showGenerate, setShowGenerate] = useState(false)
  const [editingRow, setEditingRow] = useState(null)

  const { data: users } = useQuery({ queryKey: ['hris-salary-profiles'], queryFn: () => hrisApi.salaryProfiles({}) })
  const { data: list, isLoading } = useQuery({ queryKey: ['hris-payslips', 'admin'], queryFn: () => hrisApi.payslips({ limit: 100 }) })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['hris-payslips'] })
  const publish = useMutation({ mutationFn: hrisApi.publishPayslip, onSuccess: () => { toast.success('Slip gaji dipublish'); invalidate() }, onError: e => toast.error(e.response?.data?.message ?? 'Gagal publish') })
  const unpublish = useMutation({ mutationFn: hrisApi.unpublishPayslip, onSuccess: () => { toast.success('Slip gaji ditarik ke Draft'); invalidate() }, onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })
  const remove = useMutation({ mutationFn: hrisApi.deletePayslip, onSuccess: () => { toast.success('Slip gaji dihapus'); invalidate() }, onError: e => toast.error(e.response?.data?.message ?? 'Gagal menghapus') })

  const [downloadingId, setDownloadingId] = useState(null)
  async function handleDownload(row) {
    setDownloadingId(row.id)
    try {
      const blob = await hrisApi.downloadPayslip(row.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `slip-gaji-${row.user?.name ?? row.id}-${row.periodStart}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Gagal mengunduh PDF')
    } finally {
      setDownloadingId(null)
    }
  }

  const rows = list?.data ?? []

  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Slip Gaji</h1>
          <p className="text-xs text-slate-400 mt-0.5">Generate, review, dan publish slip gaji bulanan karyawan</p>
        </div>
        <button
          onClick={() => { if (needsCompany) return toast.error('Pilih perusahaan terlebih dahulu'); setShowGenerate(true) }}
          className="btn-primary text-sm flex items-center gap-1.5"
        >
          <Plus size={14} /> Generate Slip Gaji
        </button>
      </div>

      {needsCompany && <div className="mb-6"><CompanyRequiredBanner action="generate slip gaji" /></div>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Karyawan</th>
                <th className="th">Periode</th>
                <th className="th">Tgl Bayar</th>
                <th className="th text-right">Net Pay</th>
                <th className="th text-center">Status</th>
                <th className="th text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Memuat…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Belum ada slip gaji</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="tr">
                  <td className="td font-medium">{r.user?.name ?? '—'}</td>
                  <td className="td">{fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}</td>
                  <td className="td">{fmtDate(r.paymentDate)}</td>
                  <td className="td text-right font-semibold">{fmtRp(r.netPay)}</td>
                  <td className="td text-center"><span className={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</span></td>
                  <td className="td text-center">
                    <div className="flex gap-1.5 justify-center">
                      <button title="Download PDF" disabled={downloadingId === r.id} onClick={() => handleDownload(r)} className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100">
                        {downloadingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      </button>
                      {r.status === 'DRAFT' && (
                        <>
                          <button title="Edit" onClick={() => setEditingRow(r)} className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100">
                            <Pencil size={14} />
                          </button>
                          <button title="Publish" onClick={() => publish.mutate(r.id)} className="w-7 h-7 rounded flex items-center justify-center text-emerald-600 hover:bg-emerald-50">
                            <Check size={14} />
                          </button>
                          <button title="Hapus" onClick={() => remove.mutate(r.id)} className="w-7 h-7 rounded flex items-center justify-center text-red-600 hover:bg-red-50">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                      {r.status === 'PUBLISHED' && (
                        <button title="Tarik ke Draft" onClick={() => unpublish.mutate(r.id)} className="w-7 h-7 rounded flex items-center justify-center text-amber-600 hover:bg-amber-50">
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showGenerate && <GeneratePayslipModal users={users ?? []} onClose={() => setShowGenerate(false)} />}
      {editingRow && <EditPayslipModal payslip={editingRow} onClose={() => setEditingRow(null)} />}
    </div>
  )
}
