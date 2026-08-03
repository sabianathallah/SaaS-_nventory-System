import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { Download, Loader2, Wallet } from 'lucide-react'

const fmtRp = (n) => `Rp ${Number(n ?? 0).toLocaleString('id-ID')}`
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function Payslip() {
  const { user } = useAuth()
  // Halaman ini khusus slip MILIK SENDIRI. userId wajib dikirim eksplisit:
  // untuk admin (yang boleh lihat semua) tanpa ini backend mengembalikan slip
  // seluruh karyawan; untuk staff biasa parameter ini diabaikan backend.
  const { data: list, isLoading } = useQuery({
    queryKey: ['hris-payslips', 'self', user?.id],
    queryFn: () => hrisApi.payslips({ limit: 50, userId: user?.id, status: 'PUBLISHED' }),
    enabled: !!user?.id,
  })
  const [downloadingId, setDownloadingId] = useState(null)

  async function handleDownload(row) {
    setDownloadingId(row.id)
    try {
      const blob = await hrisApi.downloadPayslip(row.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `slip-gaji-${row.periodStart}.pdf`
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
    <div className="px-6 py-6 max-w-3xl">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-slate-800">Slip Gaji Saya</h1>
        <p className="text-xs text-slate-400 mt-0.5">Riwayat slip gaji bulanan yang sudah dipublish</p>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-slate-400">Memuat…</div>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center">
          <Wallet size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">Belum ada slip gaji yang dipublish</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.id} className="card p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-slate-800">{fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}</p>
                <p className="text-xs text-slate-400 mt-0.5">Dibayarkan {fmtDate(r.paymentDate)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-emerald-600">{fmtRp(r.netPay)}</p>
                <p className="text-[11px] text-slate-400">Net Pay</p>
              </div>
              <button
                disabled={downloadingId === r.id}
                onClick={() => handleDownload(r)}
                className="btn-secondary text-sm flex items-center gap-1.5"
              >
                {downloadingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Unduh PDF
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
