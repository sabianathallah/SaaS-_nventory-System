import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { handoverApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useExternalScanner } from '../hooks/useExternalScanner'
import QRScanner from '../components/QRScanner'
import toast from 'react-hot-toast'
import {
  ArrowLeft, PackageCheck, ScanLine, Camera, Trash2, Printer,
  Plus, X, Package,
} from 'lucide-react'
import logoPreface from '../assets/logo-preface.jpeg'

const EKSPEDISI_LIST = [
  'J&T Express', 'Lion Parcel', 'SPX (Shopee Express)', 'GoSend',
  'Lala Move', 'JNE', 'SiCepat', 'Anteraja', 'TIKI', 'Pos Indonesia',
]

const fmtDate = (d) => {
  if (!d) return ''
  const dt = new Date(typeof d === 'string' && d.length === 10 ? d + 'T00:00:00' : d)
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

const fmtDateTime = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const today = () => new Date().toISOString().slice(0, 10)

export default function HandoverDetail() {
  const { id }         = useParams()
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const qc             = useQueryClient()
  const { user }       = useAuth()
  const isNew          = id === 'new'

  // form state (only used when creating)
  const [form, setForm] = useState({ ekspedisi: '', ekspedisiCustom: '', date: today(), note: '' })
  const [customMode, setCustomMode] = useState(false)

  // scan state
  const [scanInput, setScanInput]   = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const scanInputRef = useRef(null)

  // existing handover
  const { data: handover, isLoading } = useQuery({
    queryKey: ['handover', id],
    queryFn:  () => handoverApi.get(id),
    enabled:  !isNew,
    staleTime: 0,
  })

  // auto-print if ?print=1
  useEffect(() => {
    if (!isNew && handover && searchParams.get('print') === '1') {
      setTimeout(() => window.print(), 500)
    }
  }, [isNew, handover, searchParams])

  // focus scan input when not in camera mode
  useEffect(() => {
    if (!showCamera && !isNew) {
      setTimeout(() => scanInputRef.current?.focus(), 100)
    }
  }, [showCamera, isNew])

  // external USB scanner (fires when scan input is NOT focused — catch global keypresses)
  useExternalScanner(
    useCallback((code) => { if (!isNew) handleAddResi(code) }, [isNew, handover]),
    !isNew && !showCamera,
  )

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data) => handoverApi.create(data),
    onSuccess: (h) => {
      qc.invalidateQueries({ queryKey: ['handovers'] })
      navigate(`/handover/${h.id}`, { replace: true })
      toast.success('Handover dibuat')
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Gagal membuat handover'),
  })

  const addResiMutation = useMutation({
    mutationFn: ({ id: hid, resi }) => handoverApi.addResi(hid, resi),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['handover', id] })
      setScanInput('')
      scanInputRef.current?.focus()
    },
    onError: (e) => {
      const msg = e?.response?.data?.message ?? 'Gagal menambahkan resi'
      toast.error(msg)
      setScanInput('')
      scanInputRef.current?.focus()
    },
  })

  const removeResiMutation = useMutation({
    mutationFn: ({ hid, itemId }) => handoverApi.removeResi(hid, itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['handover', id] })
      setConfirmDelete(null)
      toast.success('Resi dihapus')
    },
    onError: () => toast.error('Gagal menghapus resi'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => handoverApi.destroy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['handovers'] })
      navigate('/handover', { replace: true })
      toast.success('Handover dihapus')
    },
    onError: () => toast.error('Gagal menghapus handover'),
  })

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleCreate(e) {
    e.preventDefault()
    const eks = customMode ? form.ekspedisiCustom.trim() : form.ekspedisi
    if (!eks) return toast.error('Pilih atau ketik nama ekspedisi')
    if (!form.date) return toast.error('Tanggal wajib diisi')
    createMutation.mutate({ ekspedisi: eks, date: form.date, note: form.note || null })
  }

  function handleAddResi(resiRaw) {
    const resi = (resiRaw ?? scanInput).trim()
    if (!resi || !handover) return
    addResiMutation.mutate({ id: handover.id, resi })
  }

  function handleScanInput(e) {
    e.preventDefault()
    handleAddResi(scanInput)
  }

  function handleCameraResult(code) {
    handleAddResi(code)
    setShowCamera(false)
  }

  // ── Create form ────────────────────────────────────────────────────────────
  if (isNew) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/handover')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Buat Handover Baru</h1>
            <p className="text-sm text-slate-500 mt-0.5">Satu dokumen untuk satu ekspedisi</p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
          {/* Ekspedisi */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ekspedisi</label>
            {!customMode ? (
              <div className="grid grid-cols-2 gap-2">
                {EKSPEDISI_LIST.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, ekspedisi: e }))}
                    className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all text-left ${
                      form.ekspedisi === e
                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-red-300 hover:bg-red-50'
                    }`}
                  >
                    {e}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setCustomMode(true); setForm(f => ({ ...f, ekspedisi: '' })) }}
                  className="px-3 py-2 rounded-xl text-sm font-medium border border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-all"
                >
                  + Lainnya
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  autoFocus
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  placeholder="Nama ekspedisi…"
                  value={form.ekspedisiCustom}
                  onChange={e => setForm(f => ({ ...f, ekspedisiCustom: e.target.value }))}
                />
                <button type="button" onClick={() => setCustomMode(false)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50">
                  Pilih daftar
                </button>
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catatan <span className="font-normal text-slate-400">(opsional)</span></label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              placeholder="Keterangan tambahan…"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            />
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <PackageCheck size={16} />
            {createMutation.isPending ? 'Menyimpan…' : 'Buat Handover & Mulai Scan'}
          </button>
        </form>
      </div>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Memuat data handover…
      </div>
    )
  }

  if (!handover) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Handover tidak ditemukan.
      </div>
    )
  }

  const items = handover.Handover_Items ?? []

  // ── Detail / Scan view ─────────────────────────────────────────────────────
  return (
    <>
      {/* Camera scanner overlay */}
      {showCamera && (
        <QRScanner
          onScan={handleCameraResult}
          onClose={() => setShowCamera(false)}
          hint="Arahkan kamera ke barcode nomor resi"
          autoClose={false}
        />
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-bold text-slate-800 mb-2">Hapus resi?</h3>
            <p className="text-sm text-slate-500 mb-4 font-mono break-all">{confirmDelete.resi}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={() => removeResiMutation.mutate({ hid: handover.id, itemId: confirmDelete.id })}
                disabled={removeResiMutation.isPending}
                className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:bg-red-400"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen view */}
      <div className="space-y-5 no-print">
        {/* Header bar */}
        <div className="flex items-start gap-3">
          <button onClick={() => navigate('/handover')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 mt-0.5 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-800">Handover #{handover.id}</h1>
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs font-semibold">
                {handover.ekspedisi}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {fmtDate(handover.date)} · {items.length} resi
              {handover.note && ` · ${handover.note}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors"
            >
              <Printer size={15} /> Print
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Hapus handover #${handover.id}? Semua data resi akan ikut terhapus.`)) {
                  deleteMutation.mutate()
                }
              }}
              className="p-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
              title="Hapus handover"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Scan input area */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Scan / Input Resi</p>
          <div className="flex gap-2">
            <form onSubmit={handleScanInput} className="flex-1 flex gap-2">
              <input
                ref={scanInputRef}
                type="text"
                className="flex-1 px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                placeholder="Scan atau ketik nomor resi, lalu Enter…"
                value={scanInput}
                onChange={e => setScanInput(e.target.value.toUpperCase())}
                disabled={addResiMutation.isPending}
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={!scanInput.trim() || addResiMutation.isPending}
                className="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 disabled:bg-slate-300 transition-colors flex items-center gap-1.5"
              >
                <Plus size={15} /> Tambah
              </button>
            </form>
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5 text-sm"
              title="Gunakan kamera"
            >
              <Camera size={16} />
            </button>
          </div>
          {addResiMutation.isPending && (
            <p className="text-xs text-slate-400 mt-2 animate-pulse">Menambahkan resi…</p>
          )}
        </div>

        {/* Resi list */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Package size={15} className="text-slate-400" />
              Daftar Resi
            </p>
            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
              {items.length} resi
            </span>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-300">
              <ScanLine size={32} className="mb-2" />
              <p className="text-sm">Belum ada resi — mulai scan di atas</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {items.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <span className="text-xs font-mono text-slate-400 w-8 text-right shrink-0">{idx + 1}</span>
                  <span className="flex-1 font-mono text-sm font-semibold text-slate-800 break-all">{item.resi}</span>
                  <span className="text-xs text-slate-400 shrink-0">{fmtDateTime(item.scannedAt)}</span>
                  <button
                    onClick={() => setConfirmDelete(item)}
                    className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Print layout ── */}
      <div className="print-only">
        <PrintLayout handover={handover} items={items} />
      </div>
    </>
  )
}

// ── Print Layout ─────────────────────────────────────────────────────────────
function PrintLayout({ handover, items }) {
  const fmtPrint = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const ROWS_PER_PAGE = 40

  // Split items into pages
  const pages = []
  for (let i = 0; i < Math.max(1, items.length); i += ROWS_PER_PAGE) {
    pages.push(items.slice(i, i + ROWS_PER_PAGE))
  }

  return (
    <>
      {pages.map((pageItems, pageIdx) => (
        <div key={pageIdx} className="print-page">
          {/* Kop Surat */}
          <div className="print-header">
            <img src={logoPreface} alt="Preface" className="print-logo" />
            <div className="print-company">
              <div className="print-company-name">PREFACE</div>
              <div className="print-company-sub">Warehouse & Fulfillment Division</div>
            </div>
          </div>
          <div className="print-divider" />

          {/* Title */}
          <div className="print-title">
            DOKUMEN SERAH TERIMA PAKET
          </div>

          {/* Meta info */}
          <div className="print-meta">
            <table className="print-meta-table">
              <tbody>
                <tr>
                  <td className="print-meta-key">Ekspedisi</td>
                  <td className="print-meta-sep">:</td>
                  <td className="print-meta-val"><strong>{handover.ekspedisi}</strong></td>
                  <td className="print-meta-key">Tanggal</td>
                  <td className="print-meta-sep">:</td>
                  <td className="print-meta-val">{fmtDate(handover.date)}</td>
                </tr>
                <tr>
                  <td className="print-meta-key">Total Resi</td>
                  <td className="print-meta-sep">:</td>
                  <td className="print-meta-val"><strong>{items.length} paket</strong></td>
                  <td className="print-meta-key">Dibuat oleh</td>
                  <td className="print-meta-sep">:</td>
                  <td className="print-meta-val">{handover.User?.name ?? '—'}</td>
                </tr>
                {handover.note && (
                  <tr>
                    <td className="print-meta-key">Keterangan</td>
                    <td className="print-meta-sep">:</td>
                    <td className="print-meta-val" colSpan={3}>{handover.note}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {pages.length > 1 && (
            <div className="print-page-info">Halaman {pageIdx + 1} dari {pages.length}</div>
          )}

          {/* Resi table */}
          <table className="print-table">
            <thead>
              <tr>
                <th className="print-th print-th-no">No.</th>
                <th className="print-th">Nomor Resi</th>
                <th className="print-th print-th-time">Waktu Scan</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={3} className="print-td" style={{ textAlign: 'center', color: '#94a3b8' }}>
                    Belum ada resi
                  </td>
                </tr>
              ) : (
                pageItems.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? 'print-row-even' : ''}>
                    <td className="print-td print-td-center">{pageIdx * ROWS_PER_PAGE + idx + 1}</td>
                    <td className="print-td print-td-resi">{item.resi}</td>
                    <td className="print-td print-td-center">{fmtPrint(item.scannedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Footer TTD — only on last page */}
          {pageIdx === pages.length - 1 && (
            <div className="print-footer">
              <div className="print-sign-block">
                <div className="print-sign-title">Pengirim,</div>
                <div className="print-sign-space" />
                <div className="print-sign-line" />
                <div className="print-sign-name">{handover.User?.name ?? '(Nama Pengirim)'}</div>
                <div className="print-sign-role">Pihak Preface</div>
              </div>
              <div className="print-sign-block">
                <div className="print-sign-title">Penerima (Kurir),</div>
                <div className="print-sign-space" />
                <div className="print-sign-line" />
                <div className="print-sign-name">&nbsp;</div>
                <div className="print-sign-role">Perwakilan {handover.ekspedisi}</div>
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  )
}
