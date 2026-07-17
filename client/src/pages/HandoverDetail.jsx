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
  Plus, X, Package, Lock, Unlock, ScanBarcode, FileEdit,
  Paperclip, ExternalLink, Link,
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

  const [form, setForm]           = useState({ ekspedisi: '', ekspedisiCustom: '', date: today(), note: '' })
  const [customMode, setCustomMode] = useState(false)
  const [scanInput, setScanInput]   = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [scannerConnected, setScannerConnected] = useState(false)
  const [confirmClose, setConfirmClose]   = useState(false)
  const [attachUrlInput, setAttachUrlInput] = useState('')
  const [showAttachInput, setShowAttachInput] = useState(false)
  const [attachSaving, setAttachSaving]   = useState(false)
  const scanInputRef = useRef(null)

  const { data: handover, isLoading } = useQuery({
    queryKey: ['handover', id],
    queryFn:  () => handoverApi.get(id),
    enabled:  !isNew && !!id && id !== 'undefined',
    staleTime: 0,
  })

  const isClosed = handover?.status === 'CLOSED'

  useEffect(() => {
    if (!isNew && handover && searchParams.get('print') === '1') {
      setTimeout(() => {
        const eks  = handover.ekspedisi?.replace(/[/\\?%*:|"<>]/g, '-') ?? 'Ekspedisi'
        const tgl  = handover.date ?? new Date().toISOString().slice(0, 10)
        const prev = document.title
        document.title = `Serah Terima Paket_${eks}_${tgl}`
        window.print()
        setTimeout(() => { document.title = prev }, 1000)
      }, 500)
    }
  }, [isNew, handover, searchParams])

  useEffect(() => {
    if (!showCamera && !isNew && !isClosed) {
      setTimeout(() => scanInputRef.current?.focus(), 100)
    }
  }, [showCamera, isNew, isClosed])

  useExternalScanner(
    useCallback((code) => {
      if (!isNew && handover && !isClosed) handleAddResi(code)
    }, [isNew, handover, isClosed]),
    !isNew && !showCamera && scannerConnected,
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
      toast.error(e?.response?.data?.message ?? 'Gagal menambahkan resi')
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

  const closeMutation = useMutation({
    mutationFn: () => handoverApi.close(id),
    onSuccess: (h) => {
      qc.setQueryData(['handover', id], h)
      qc.invalidateQueries({ queryKey: ['handovers'] })
      qc.invalidateQueries({ queryKey: ['handovers-count'] })
      setScannerConnected(false)
      toast.success('Sesi ditutup')
    },
    onError: () => toast.error('Gagal menutup sesi'),
  })

  const reopenMutation = useMutation({
    mutationFn: () => handoverApi.reopen(id),
    onSuccess: (h) => {
      qc.setQueryData(['handover', id], h)
      toast.success('Sesi dibuka kembali')
    },
    onError: () => toast.error('Gagal membuka sesi'),
  })

  const deleteAttachmentMutation = useMutation({
    mutationFn: () => handoverApi.deleteAttachment(id),
    onSuccess: (h) => {
      qc.setQueryData(['handover', id], h)
      setShowAttachInput(false)
      setAttachUrlInput('')
      toast.success('Lampiran dihapus')
    },
    onError: () => toast.error('Gagal menghapus lampiran'),
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

  async function handleSaveAttachUrl(e) {
    e.preventDefault()
    const url = attachUrlInput.trim()
    if (!url) return toast.error('Masukkan link dokumen')
    setAttachSaving(true)
    try {
      const h = await handoverApi.setAttachmentUrl(id, url)
      qc.setQueryData(['handover', id], h)
      setShowAttachInput(false)
      setAttachUrlInput('')
      toast.success('Link dokumen disimpan')
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'Gagal menyimpan link')
    } finally {
      setAttachSaving(false)
    }
  }

  // ── Create form ────────────────────────────────────────────────────────────
  if (isNew) {
    return (
      <div className="px-6 py-6 max-w-xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Buat Handover Baru</h1>
            <p className="text-xs text-slate-400">Satu dokumen untuk satu ekspedisi</p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="card p-6 space-y-5">
          <div>
            <label className="label mb-1.5">Ekspedisi</label>
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
                  className="input flex-1"
                  placeholder="Nama ekspedisi…"
                  value={form.ekspedisiCustom}
                  onChange={e => setForm(f => ({ ...f, ekspedisiCustom: e.target.value }))}
                />
                <button type="button" onClick={() => setCustomMode(false)} className="btn-secondary text-sm">
                  Pilih daftar
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="label mb-1.5">Tanggal</label>
            <input
              type="date"
              className="input"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            />
          </div>

          <div>
            <label className="label mb-1.5">Catatan <span className="font-normal text-slate-400">(opsional)</span></label>
            <input
              type="text"
              className="input"
              placeholder="Keterangan tambahan…"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            />
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="btn-primary w-full justify-center py-2.5"
          >
            <PackageCheck size={15} />
            {createMutation.isPending ? 'Menyimpan…' : 'Buat Handover & Mulai Scan'}
          </button>
        </form>
      </div>
    )
  }

  if (isLoading) {
    return <div className="p-8 text-slate-400 text-sm">Memuat…</div>
  }

  if (!handover) {
    return <div className="p-8 text-red-500 text-sm">Handover tidak ditemukan.</div>
  }

  const items = handover.Handover_Items ?? []

  // ── Detail / Scan view ─────────────────────────────────────────────────────
  return (
    <>
      {showCamera && (
        <QRScanner
          onScan={handleCameraResult}
          onClose={() => setShowCamera(false)}
          hint="Arahkan kamera ke barcode nomor resi"
          autoClose={false}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="card p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-bold text-slate-800 mb-2">Hapus resi?</h3>
            <p className="text-sm text-slate-500 mb-4 font-mono break-all">{confirmDelete.resi}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1 justify-center">Batal</button>
              <button
                onClick={() => removeResiMutation.mutate({ hid: handover.id, itemId: confirmDelete.id })}
                disabled={removeResiMutation.isPending}
                className="btn-danger flex-1 justify-center"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen view */}
      <div className="px-6 py-6 max-w-4xl no-print">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-slate-800">Handover #{handover.id}</h1>
              <span className="badge-muted">{handover.ekspedisi}</span>
              {isClosed
                ? <span className="badge bg-red-50 text-red-600 border border-red-200"><Lock size={9} /> Ditutup</span>
                : null
              }
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {fmtDate(handover.date)} · {items.length} resi
              {handover.note && ` · ${handover.note}`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Draft Session button — pause & return to list, session stays OPEN */}
            {!isClosed && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200 transition-colors"
              >
                <FileEdit size={13} /> Draft Session
              </button>
            )}

            {/* Scanner connect toggle */}
            {!isClosed && (
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur()
                  setScannerConnected(v => !v)
                  if (!scannerConnected) toast.success('Scanner eksternal terhubung', { icon: '🔌' })
                  else toast('Scanner diputus', { icon: '🔌' })
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  scannerConnected
                    ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                {scannerConnected
                  ? <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Connected</>
                  : <><ScanBarcode size={14} /> Hubungkan Scanner</>
                }
              </button>
            )}

            {isClosed ? (
              <button
                onClick={() => reopenMutation.mutate()}
                disabled={reopenMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-green-300 bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 disabled:opacity-50 transition-colors"
              >
                <Unlock size={14} /> Buka Sesi
              </button>
            ) : (
              <button
                onClick={() => setConfirmClose(true)}
                disabled={closeMutation.isPending}
                className="text-sm px-3 py-2 rounded-lg font-medium flex items-center gap-1.5 bg-success-light text-success border border-success/20 hover:bg-success hover:text-white transition-colors disabled:opacity-50"
              >
                <Lock size={14} /> Tutup Sesi
              </button>
            )}

            <button
              onClick={() => {
                const eks  = handover.ekspedisi?.replace(/[/\\?%*:|"<>]/g, '-') ?? 'Ekspedisi'
                const tgl  = handover.date ?? new Date().toISOString().slice(0, 10)
                const prev = document.title
                document.title = `Serah Terima Paket_${eks}_${tgl}`
                window.print()
                setTimeout(() => { document.title = prev }, 1000)
              }}
              className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-2"
            >
              <Printer size={14} /> Print
            </button>

            {!isClosed && (
              <button
                onClick={() => {
                  if (window.confirm(`Batalkan session Handover #${handover.id}? Semua data resi akan ikut terhapus.`)) {
                    deleteMutation.mutate()
                  }
                }}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} /> Batalkan Session
              </button>
            )}
            {isClosed && (
              <button
                onClick={() => {
                  if (window.confirm(`Hapus handover #${handover.id}?`)) {
                    deleteMutation.mutate()
                  }
                }}
                disabled={deleteMutation.isPending}
                className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
                title="Hapus handover"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Close confirm panel */}
        {confirmClose && (
          <div className="card p-5 mb-5 border-amber-200 bg-amber-50/50">
            <p className="text-sm font-semibold text-slate-800 mb-2">Tutup sesi handover ini?</p>
            <p className="text-sm text-slate-600 mb-4">Setelah ditutup tidak bisa menambah resi lagi, kecuali dibuka kembali.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmClose(false)} className="btn-secondary flex-1 justify-center">Batal</button>
              <button
                onClick={() => { closeMutation.mutate(); setConfirmClose(false) }}
                disabled={closeMutation.isPending}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 transition-colors"
              >
                {closeMutation.isPending ? 'Menutup…' : 'Ya, Tutup Sesi'}
              </button>
            </div>
          </div>
        )}

        {/* Attachment section */}
        <div className="card p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
              <Paperclip size={13} /> Dokumen Lampiran
            </span>
            {!handover.attachment_url && !showAttachInput && (
              <button
                type="button"
                onClick={() => setShowAttachInput(true)}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                <Link size={12} /> Tambah Link
              </button>
            )}
          </div>

          {handover.attachment_url ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <ExternalLink size={15} className="text-blue-500 shrink-0" />
                <span className="text-xs text-slate-600 truncate flex-1 font-mono">
                  {handover.attachment_url}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={handover.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5"
                >
                  <ExternalLink size={12} /> Buka Dokumen
                </a>
                <button
                  type="button"
                  onClick={() => { setAttachUrlInput(handover.attachment_url); setShowAttachInput(true) }}
                  className="text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  Ganti
                </button>
                <button
                  type="button"
                  onClick={() => { if (window.confirm('Hapus lampiran ini?')) deleteAttachmentMutation.mutate() }}
                  disabled={deleteAttachmentMutation.isPending}
                  className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ) : showAttachInput ? (
            <form onSubmit={handleSaveAttachUrl} className="flex gap-2">
              <input
                autoFocus
                type="url"
                className="input flex-1 text-sm"
                placeholder="Paste link Google Drive / Dropbox…"
                value={attachUrlInput}
                onChange={e => setAttachUrlInput(e.target.value)}
              />
              <button type="submit" disabled={attachSaving} className="btn-primary text-xs px-4">
                {attachSaving ? 'Menyimpan…' : 'Simpan'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAttachInput(false); setAttachUrlInput('') }}
                className="btn-secondary text-xs px-3"
              >
                Batal
              </button>
            </form>
          ) : (
            <p className="text-xs text-slate-400">
              Belum ada lampiran — tambahkan link Google Drive / Dropbox untuk validasi shipping.
            </p>
          )}
        </div>

        {/* Scan input area */}
        {isClosed ? (
          <div className="card p-4 mb-5 border-red-200 bg-red-50/50 flex items-center gap-3 text-red-700">
            <Lock size={16} className="shrink-0" />
            <div>
              <p className="text-sm font-semibold">Sesi ditutup</p>
              <p className="text-xs mt-0.5 text-red-500">Tidak bisa menambah atau menghapus resi. Klik "Buka Sesi" untuk mengaktifkan kembali.</p>
            </div>
          </div>
        ) : (
          <div className="card p-4 mb-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Scan / Input Resi</p>
            <div className="flex gap-2">
              <form onSubmit={handleScanInput} className="flex-1 flex gap-2">
                <input
                  ref={scanInputRef}
                  type="text"
                  className="input flex-1 font-mono"
                  placeholder="Scan atau ketik nomor resi, lalu Enter…"
                  value={scanInput}
                  onChange={e => setScanInput(e.target.value.toUpperCase())}
                  disabled={addResiMutation.isPending}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!scanInput.trim() || addResiMutation.isPending}
                  className="btn-primary px-4 flex items-center gap-1.5 text-sm"
                >
                  <Plus size={14} /> Tambah
                </button>
              </form>
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="btn-secondary px-3 flex items-center gap-1.5 text-sm"
                title="Gunakan kamera"
              >
                <Camera size={15} />
              </button>
            </div>
            {addResiMutation.isPending && (
              <p className="text-xs text-slate-400 mt-2 animate-pulse">Menambahkan resi…</p>
            )}
            {scannerConnected && (
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                Scanner eksternal aktif — arahkan scanner ke resi (tanpa fokus di input)
              </p>
            )}
          </div>
        )}

        {/* Resi table */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-2">
              <Package size={13} /> Daftar Resi
            </span>
            <span className="text-xs font-mono font-bold text-slate-500">{items.length} resi</span>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-300">
              <ScanLine size={28} className="mb-2" />
              <p className="text-sm">Belum ada resi — mulai scan di atas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="th py-2 text-center w-12">No.</th>
                    <th className="th py-2 text-left">Nomor Resi</th>
                    <th className="th py-2 text-right w-44">Waktu Scan</th>
                    {!isClosed && <th className="th py-2 w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id} className="tr border-b border-slate-50">
                      <td className="td py-2.5 text-center font-mono text-xs text-slate-400">{idx + 1}</td>
                      <td className="td py-2.5 font-mono font-semibold text-slate-800">{item.resi}</td>
                      <td className="td py-2.5 text-right text-xs text-slate-400">{fmtDateTime(item.scannedAt)}</td>
                      {!isClosed && (
                        <td className="td py-2.5 text-center">
                          <button
                            onClick={() => setConfirmDelete(item)}
                            className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <X size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
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

  const ROWS_PER_PAGE = 25

  const pages = []
  for (let i = 0; i < Math.max(1, items.length); i += ROWS_PER_PAGE) {
    pages.push(items.slice(i, i + ROWS_PER_PAGE))
  }

  return (
    <>
      {pages.map((pageItems, pageIdx) => (
        <div key={pageIdx} className="print-page">
          <div className="print-header">
            <img src={logoPreface} alt="Preface" className="print-logo" />
          </div>
          <div className="print-divider" />

          <div className="print-title">DOKUMEN SERAH TERIMA PAKET</div>

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

          {pageIdx === pages.length - 1 && (
            <div className="print-footer">
              <div className="print-sign-block">
                <div className="print-sign-title">Pengirim,</div>
                <div className="print-sign-space" />
                <div className="print-sign-line" />
                <div className="print-sign-name">&nbsp;</div>
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
