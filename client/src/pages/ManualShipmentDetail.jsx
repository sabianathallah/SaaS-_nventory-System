import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Package, ShoppingCart, Gift, CheckCircle2, Truck,
  XCircle, Edit2, Trash2, Upload, Printer, FileText, ImageIcon,
  ExternalLink, Clock, CreditCard, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { manualShipmentsApi } from '../api'
import { useAuth } from '../context/AuthContext'
import logoPreface from '../assets/logo-preface.jpeg'

const fmtRp   = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const fmtDate = d => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'
const fmtDateTime = d => d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:     { label: 'Draft',      badge: 'badge-muted',  step: -1 },
  pending:   { label: 'Menunggu',   badge: 'badge-amber',  step: 0 },
  paid:      { label: 'Lunas',      badge: 'badge-indigo', step: 1 },
  shipped:   { label: 'Dikirim',    badge: 'badge-purple', step: 2 },
  completed: { label: 'Selesai',    badge: 'badge-green',  step: 3 },
  cancelled: { label: 'Dibatalkan', badge: 'badge-red',    step: -1 },
}

const SALES_STEPS    = ['pending', 'paid', 'shipped', 'completed']
const NONSALES_STEPS = ['pending', 'shipped', 'completed']

// ── Timeline ──────────────────────────────────────────────────────────────────
function StatusTimeline({ status, type }) {
  const steps  = type === 'sales' ? SALES_STEPS : NONSALES_STEPS
  const labels = {
    pending:   type === 'sales' ? 'Belum Bayar' : 'Menunggu',
    paid:      'Lunas',
    shipped:   'Dikirim',
    completed: 'Selesai',
  }
  const curIdx = status === 'cancelled' ? -1 : steps.indexOf(status)

  return (
    <div className="flex items-center gap-0">
      {steps.map((s, idx) => {
        const done      = curIdx > idx
        const active    = curIdx === idx
        const cancelled = status === 'cancelled'
        return (
          <div key={s} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                cancelled  ? 'border-slate-200 bg-slate-100 text-slate-300'
                : done     ? 'border-emerald-500 bg-emerald-500 text-white'
                : active   ? 'border-indigo-500 bg-indigo-500 text-white ring-4 ring-indigo-100'
                           : 'border-slate-200 bg-white text-slate-300'
              }`}>
                {done ? <CheckCircle2 size={14} /> : idx + 1}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${
                cancelled ? 'text-slate-300'
                : done    ? 'text-emerald-600'
                : active  ? 'text-indigo-600'
                          : 'text-slate-400'
              }`}>{labels[s]}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Guided Next Action Card ───────────────────────────────────────────────────
function NextActionCard({ s, perm, proofRef, statusMut, proofMut }) {
  const { status, type, paymentProofUrl } = s
  const canShip    = perm('shipping.manual.manage')
  const canApprove = perm('shipping.manual.approve_payment')
  const canResi    = perm('shipping.manual.upload_resi')

  const configs = {
    // Draft — belum diajukan
    draft: {
      icon: <Clock size={16} className="text-slate-400" />,
      title: 'Ajukan Transaksi',
      desc: 'Transaksi masih dalam status draft. Ajukan untuk memulai proses pembayaran dan pengiriman.',
      actions: canShip && (
        <button onClick={() => statusMut.mutate({ status: 'pending' })} disabled={statusMut.isPending}
          className="btn-primary text-sm flex items-center gap-2 justify-center w-full">
          <CheckCircle2 size={14} /> {statusMut.isPending ? 'Memproses…' : 'Ajukan Transaksi'}
        </button>
      ),
    },
    // Sales pending — needs proof first
    sales_no_proof: {
      icon: <CreditCard size={16} className="text-amber-500" />,
      title: 'Upload Bukti Transfer',
      desc: 'Minta pembeli upload bukti transfer sebelum barang dikirim.',
      actions: canApprove && (
        <>
          <input type="file" ref={proofRef} accept="image/*" className="hidden"
            onChange={e => e.target.files[0] && proofMut.mutate(e.target.files[0])} />
          <button onClick={() => proofRef.current?.click()} disabled={proofMut.isPending}
            className="btn-primary text-sm flex items-center gap-2 justify-center w-full">
            <Upload size={14} /> {proofMut.isPending ? 'Uploading…' : 'Upload Bukti TF'}
          </button>
        </>
      ),
    },
    // Sales pending — has proof, waiting confirmation
    sales_confirm: {
      icon: <CheckCircle2 size={16} className="text-blue-500" />,
      title: 'Konfirmasi Pembayaran',
      desc: 'Bukti transfer sudah diupload. Konfirmasi pembayaran untuk lanjut ke pengiriman.',
      actions: canApprove && (
        <button onClick={() => statusMut.mutate({ status: 'paid' })} disabled={statusMut.isPending}
          className="btn-primary text-sm flex items-center gap-2 justify-center w-full">
          <CheckCircle2 size={14} /> {statusMut.isPending ? 'Memproses…' : 'Konfirmasi Pembayaran'}
        </button>
      ),
    },
    // paid or non-sales pending — ready to ship
    ready_ship: {
      icon: <Truck size={16} className="text-indigo-500" />,
      title: 'Tandai Dikirim',
      desc: status === 'paid'
        ? 'Pembayaran terkonfirmasi. Tandai barang ketika sudah diserahkan ke ekspedisi.'
        : 'Tandai barang ketika sudah diserahkan ke ekspedisi.',
      actions: canShip && (
        <button onClick={() => statusMut.mutate({ status: 'shipped' })} disabled={statusMut.isPending}
          className="btn-primary text-sm flex items-center gap-2 justify-center w-full">
          <Truck size={14} /> {statusMut.isPending ? 'Memproses…' : 'Tandai Shipped'}
        </button>
      ),
    },
    // Shipped — waiting to complete
    shipped: {
      icon: <CheckCircle2 size={16} className="text-emerald-500" />,
      title: 'Siap Diselesaikan',
      desc: 'Barang sudah dalam perjalanan. Tandai selesai setelah pembeli menerima barang.',
      actions: canShip && (
        <button onClick={() => statusMut.mutate({ status: 'completed' })} disabled={statusMut.isPending}
          className="btn-primary text-sm flex items-center gap-2 justify-center w-full bg-emerald-600 border-emerald-600 hover:bg-emerald-700">
          <CheckCircle2 size={14} /> {statusMut.isPending ? 'Memproses…' : 'Selesaikan'}
        </button>
      ),
    },
    completed: null,
    cancelled: null,
  }

  let cfgKey
  if (status === 'completed' || status === 'cancelled') {
    cfgKey = status
  } else if (status === 'draft') {
    cfgKey = 'draft'
  } else if (status === 'shipped') {
    cfgKey = 'shipped'
  } else if (status === 'paid') {
    cfgKey = 'ready_ship'
  } else if (status === 'pending') {
    if (type === 'non_sales') cfgKey = 'ready_ship'
    else if (!paymentProofUrl) cfgKey = 'sales_no_proof'
    else cfgKey = 'sales_confirm'
  }

  const cfg = configs[cfgKey]
  if (!cfg) return null

  return (
    <div className="card p-4 border-l-4 border-l-indigo-400">
      <div className="flex items-center gap-2 mb-2">
        {cfg.icon}
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Langkah Selanjutnya</span>
      </div>
      <p className="text-sm font-semibold text-slate-800 mb-1">{cfg.title}</p>
      <p className="text-xs text-slate-500 mb-3 leading-relaxed">{cfg.desc}</p>
      {cfg.actions}
    </div>
  )
}

// ── Cancel modal ──────────────────────────────────────────────────────────────
function CancelModal({ onConfirm, onClose, loading }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-semibold text-slate-800">Batalkan Shipping</h3>
        <div>
          <label className="label">Alasan Pembatalan</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} className="input min-h-[80px] resize-none" placeholder="Opsional…" />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Kembali</button>
          <button onClick={() => onConfirm(reason)} disabled={loading} className="btn-danger">
            {loading ? 'Membatalkan…' : 'Ya, Batalkan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Print helpers ─────────────────────────────────────────────────────────────
function printViaIframe(html) {
  const existing = document.getElementById('__pf_print_frame')
  if (existing) existing.remove()
  const iframe = document.createElement('iframe')
  iframe.id = '__pf_print_frame'
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument || iframe.contentWindow.document
  doc.open(); doc.write(html); doc.close()
  setTimeout(() => {
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
    setTimeout(() => iframe.remove(), 2000)
  }, 400)
  return true
}

function printResiSementara(shipment, showItems = true) {
  const items = shipment.items ?? []
  const toName    = shipment.buyerName    || shipment.recipientInfo || '-'
  const toPhone   = shipment.buyerPhone   || ''
  const toAddress = shipment.buyerAddress || ''
  return printViaIframe(`<!DOCTYPE html><html><head><title>Resi ${shipment.invoiceNumber}</title><style>
    @page{size:100mm 150mm;margin:5mm}
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#000;width:90mm}
    .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px}
    .logo{height:22px;object-fit:contain}
    .inv-info{text-align:right;font-size:8px;color:#444;line-height:1.5}
    .inv-no{font-weight:700;font-size:9px;color:#000}
    .divider-bold{border:none;border-top:2px solid #000;margin:4px 0}
    .divider{border:none;border-top:1px dashed #999;margin:5px 0}
    .block{margin:5px 0}
    .lbl{font-size:7px;font-weight:700;letter-spacing:1.5px;color:#666;text-transform:uppercase;margin-bottom:2px}
    .to-name{font-size:18px;font-weight:900;line-height:1.15;word-break:break-word;text-transform:uppercase}
    .to-phone{font-size:14px;font-weight:700;margin-top:3px;letter-spacing:.5px}
    .to-addr{font-size:9.5px;margin-top:3px;line-height:1.5;word-break:break-word}
    .items-lbl{font-size:7px;font-weight:700;letter-spacing:1.5px;color:#666;text-transform:uppercase;margin-bottom:3px}
    .item{display:flex;justify-content:space-between;font-size:9.5px;padding:2px 0;border-bottom:1px solid #ddd}
    .item:last-child{border-bottom:none}
    .iname{flex:1;padding-right:4px;word-break:break-word}
    .iqty{font-weight:900;white-space:nowrap;font-size:10px}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  <div class="top">
    <img src="${logoPreface}" class="logo" onerror="this.style.display='none'" />
    <div class="inv-info">
      <div class="inv-no">${shipment.invoiceNumber}</div>
      <div>${fmtDate(shipment.createdAt)}</div>
      ${shipment.expeditionName ? `<div>${shipment.expeditionName}</div>` : ''}
    </div>
  </div>
  <hr class="divider-bold"/>
  <div class="block">
    <div class="lbl">Kepada</div>
    <div class="to-name">${toName}</div>
    ${toPhone   ? `<div class="to-phone">${toPhone}</div>` : ''}
    ${toAddress ? `<div class="to-addr">${toAddress}</div>` : ''}
  </div>
  ${showItems ? `
  <hr class="divider"/>
  <div class="items-lbl">Isi Paket</div>
  ${items.map(i => `
    <div class="item">
      <span class="iname">${i.productName}${i.variantName ? ` — ${i.variantName}` : ''}</span>
      <span class="iqty">×${i.quantity}</span>
    </div>`).join('')}` : ''}
  </body></html>`)
}

function printInvoice(shipment) {
  const items    = shipment.items ?? []
  const subtotal = Number(shipment.subtotal)
  const shipping = Number(shipment.shippingCost)
  const total    = Number(shipment.total)
  return printViaIframe(`<!DOCTYPE html><html><head><title>Invoice ${shipment.invoiceNumber}</title><style>
    *{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',sans-serif}
    body{padding:40px;font-size:13px;color:#1a1a1a;max-width:720px;margin:0 auto}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}
    .logo{width:70px}
    .invoice-meta{text-align:right}.invoice-no{font-size:18px;font-weight:700;color:#C8102E}
    .invoice-date{color:#666;font-size:12px;margin-top:4px}
    .section{margin-bottom:24px}.section-title{font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #eee}
    .buyer-name{font-size:15px;font-weight:600}.buyer-info{color:#555;font-size:12px;margin-top:3px;line-height:1.6}
    table{width:100%;border-collapse:collapse;margin:0}
    thead tr{background:#f8f8f8}
    th{padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#555;border-bottom:2px solid #eee}
    td{padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px}
    .product-img{width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid #eee}
    .product-name{font-weight:500}.product-variant{font-size:11px;color:#888}
    .totals{margin-top:16px;border-top:2px solid #eee;padding-top:16px}
    .total-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}
    .total-row.grand{font-size:16px;font-weight:700;color:#C8102E;border-top:1px solid #eee;margin-top:8px;padding-top:8px}
    .footer{margin-top:40px;padding-top:16px;border-top:1px solid #eee;text-align:center;font-size:11px;color:#999}
    @media print{body{padding:20px}}
  </style></head><body>
  <div class="header">
    <div>
      <img src="${logoPreface}" class="logo" onerror="this.style.display='none'" />
    </div>
    <div class="invoice-meta">
      <div class="invoice-no">INVOICE</div>
      <div style="font-size:14px;font-weight:600;margin-top:4px">${shipment.invoiceNumber}</div>
      <div class="invoice-date">${fmtDate(shipment.createdAt)}</div>
    </div>
  </div>
  ${shipment.buyerName ? `
  <div class="section">
    <div class="section-title">Kepada</div>
    <div class="buyer-name">${shipment.buyerName}</div>
    <div class="buyer-info">
      ${shipment.buyerAddress ? shipment.buyerAddress + '<br/>' : ''}
      ${shipment.buyerPhone ? 'HP: ' + shipment.buyerPhone : ''}
    </div>
  </div>` : shipment.recipientInfo ? `
  <div class="section">
    <div class="section-title">Penerima</div>
    <div class="buyer-name">${shipment.recipientInfo}</div>
  </div>` : ''}
  ${shipment.expeditionName ? `
  <div class="section">
    <div class="section-title">Ekspedisi</div>
    <div style="font-weight:500">${shipment.expeditionName}</div>
  </div>` : ''}
  <div class="section">
    <div class="section-title">Produk</div>
    <table>
      <thead><tr>
        <th style="width:44px"></th><th>Produk</th>
        <th style="text-align:right;width:60px">Qty</th>
        <th style="text-align:right;width:120px">Harga</th>
        <th style="text-align:right;width:120px">Subtotal</th>
      </tr></thead>
      <tbody>
        ${items.map(i => `<tr>
          <td>${i.productImageUrl ? `<img src="${i.productImageUrl}" class="product-img" />` : ''}</td>
          <td>
            <div class="product-name">${i.productName}</div>
            ${i.variantName ? `<div class="product-variant">${i.variantName}</div>` : ''}
            ${i.sku ? `<div class="product-variant">SKU: ${i.sku}</div>` : ''}
          </td>
          <td style="text-align:right">${i.quantity}</td>
          <td style="text-align:right">${fmtRp(i.unitPrice)}</td>
          <td style="text-align:right;font-weight:500">${fmtRp(Number(i.unitPrice) * Number(i.quantity))}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="totals">
      <div class="total-row"><span>Subtotal</span><span>${fmtRp(subtotal)}</span></div>
      <div class="total-row"><span>Ongkos Kirim</span><span>${fmtRp(shipping)}</span></div>
      <div class="total-row grand"><span>Total</span><span>${fmtRp(total)}</span></div>
    </div>
  </div>
  ${shipment.notes ? `<div class="section"><div class="section-title">Catatan</div><div style="color:#555;font-size:12px">${shipment.notes}</div></div>` : ''}
  <div class="footer">
    <div style="margin-bottom:8px">Transfer pembayaran ke:</div>
    <div style="font-size:13px;font-weight:700;color:#1a1a1a">BCA 7380687130</div>
    <div style="font-size:12px;margin-top:2px">a/n Muhamad Akbar Fadillah</div>
    <div style="margin-top:12px;color:#bbb">Terima kasih atas kepercayaan Anda &nbsp;·&nbsp; Preface Wearhouse</div>
  </div>
  </body></html>`)
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ManualShipmentDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const { isSuperAdmin, hasPermission } = useAuth()

  const [showCancel, setShowCancel] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [resiNumber, setResiNumber] = useState('')
  const [resiFile,   setResiFile]   = useState(null)
  const proofRef    = useRef(null)
  const resiFileRef = useRef(null)

  const perm = (k) => isSuperAdmin || hasPermission(k) || hasPermission('shipping.manual.manage')

  const { data: res, isLoading, isError, refetch } = useQuery({
    queryKey: ['manual-shipment', id],
    queryFn:  () => manualShipmentsApi.get(id),
    enabled:  !!id,
  })
  const s = res?.data

  const invalidate = () => qc.invalidateQueries({ queryKey: ['manual-shipment', id] })

  const statusMut = useMutation({
    mutationFn: (data) => manualShipmentsApi.changeStatus(id, data),
    onSuccess: () => { invalidate(); toast.success('Status diperbarui') },
    onError: (err) => toast.error(err?.response?.data?.message ?? 'Gagal update status'),
  })
  const proofMut = useMutation({
    mutationFn: (file) => manualShipmentsApi.uploadPaymentProof(id, file),
    onSuccess: () => { invalidate(); toast.success('Bukti transfer diupload') },
    onError: (err) => toast.error(err?.response?.data?.message ?? 'Gagal upload'),
  })
  const resiMut = useMutation({
    mutationFn: (data) => manualShipmentsApi.uploadCourierResi(id, data),
    onSuccess: () => { invalidate(); toast.success('Resi kurir disimpan'); setResiNumber(''); setResiFile(null) },
    onError: (err) => toast.error(err?.response?.data?.message ?? 'Gagal simpan resi'),
  })
  const deleteMut = useMutation({
    mutationFn: () => manualShipmentsApi.destroy(id),
    onSuccess: () => { toast.success('Shipping dihapus'); navigate('/shipping-manual') },
    onError: () => toast.error('Gagal menghapus'),
  })
  const markPrintedMut = useMutation({
    mutationFn: (type) => manualShipmentsApi.markPrinted(id, type),
    onSuccess: () => invalidate(),
  })

  if (isLoading) return <div className="flex items-center justify-center h-64 text-slate-400">Memuat…</div>
  if (isError)   return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p className="text-slate-500 text-sm">Gagal memuat data. Server mungkin sedang tidak aktif.</p>
      <button onClick={() => refetch()} className="btn-secondary text-sm">Coba Lagi</button>
    </div>
  )
  if (!s) return <div className="flex items-center justify-center h-64 text-slate-400">Data tidak ditemukan</div>

  const cfg       = STATUS_CONFIG[s.status] ?? {}
  const canEdit   = ['draft', 'pending'].includes(s.status) && perm('shipping.manual.edit')
  const canCancel = !['completed', 'cancelled'].includes(s.status) && perm('shipping.manual.cancel')
  const canDelete = ['draft', 'pending', 'cancelled'].includes(s.status) && perm('shipping.manual.delete')
  const canUploadResi = !['draft', 'completed', 'cancelled'].includes(s.status) && perm('shipping.manual.upload_resi')

  return (
    <div className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-lg">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800 font-mono">{s.invoiceNumber}</h1>
            <span className={cfg.badge}>{cfg.label}</span>
            {s.type === 'sales'
              ? <span className="badge-teal flex items-center gap-1"><ShoppingCart size={10}/> Sales</span>
              : <span className="badge-muted flex items-center gap-1"><Gift size={10}/> Non-Sales {s.category ? `· ${s.category.name}` : ''}</span>
            }
            {s.sourceRequestId && (
              <button
                onClick={() => navigate(`/pengajuan/${s.sourceRequestId}`)}
                className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 transition-colors"
              >
                Dari Pengajuan #{s.sourceRequestId} <ExternalLink size={9} />
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Dibuat oleh {s.creator?.name ?? '—'} · {fmtDateTime(s.createdAt)}</p>
        </div>
      </div>

      {/* Timeline (full width) */}
      {s.status === 'draft' ? (
        <div className="card p-4 border-l-4 border-slate-300 bg-slate-50 mb-5">
          <div className="flex items-center gap-2 text-slate-500 font-semibold text-sm"><Clock size={15}/> Transaksi ini masih berstatus Draft</div>
          <p className="text-xs text-slate-400 mt-1">Klik "Ajukan Transaksi" di panel kanan untuk memulai proses.</p>
        </div>
      ) : s.status !== 'cancelled' ? (
        <div className="card p-5 mb-5">
          <StatusTimeline status={s.status} type={s.type} />
        </div>
      ) : (
        <div className="card p-4 border-l-4 border-red-400 bg-red-50 mb-5">
          <div className="flex items-center gap-2 text-red-700 font-semibold"><XCircle size={16}/> Pengiriman Dibatalkan</div>
          {s.cancelledReason && <p className="text-sm text-red-600 mt-1">{s.cancelledReason}</p>}
        </div>
      )}

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: main info (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Buyer / recipient info */}
          <div className="card p-5 space-y-3">
            <h2 className="font-semibold text-slate-700 text-sm">{s.type === 'sales' ? 'Info Pembeli' : 'Info Penerima'}</h2>
            {(s.type === 'sales' || s.buyerName) ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-400 text-xs">Nama</span><div className="font-medium text-slate-800 mt-0.5">{s.buyerName || '—'}</div></div>
                <div><span className="text-slate-400 text-xs">No. HP</span><div className="font-medium text-slate-800 mt-0.5">{s.buyerPhone || '—'}</div></div>
                <div className="col-span-2"><span className="text-slate-400 text-xs">Alamat</span><div className="font-medium text-slate-800 mt-0.5 leading-relaxed">{s.buyerAddress || '—'}</div></div>
              </div>
            ) : (
              <div className="text-sm">
                <span className="text-slate-400 text-xs">Penerima / Keterangan</span>
                <div className="font-medium text-slate-800 mt-0.5">{s.recipientInfo || '—'}</div>
              </div>
            )}
            <div className="flex gap-6 pt-2 border-t text-sm">
              <div><span className="text-slate-400 text-xs">Ekspedisi</span><div className="font-medium text-slate-800 mt-0.5">{s.expeditionName || '—'}</div></div>
              {s.courierResiNumber && (
                <div><span className="text-slate-400 text-xs">No. Resi Kurir</span><div className="font-mono font-semibold text-slate-800 mt-0.5">{s.courierResiNumber}</div></div>
              )}
            </div>
            {s.notes && <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3 italic">"{s.notes}"</div>}
          </div>

          {/* Items */}
          <div className="card p-5 space-y-3">
            <h2 className="font-semibold text-slate-700 text-sm">Produk ({s.items?.length ?? 0} item)</h2>
            <div className="space-y-2">
              {(s.items ?? []).map(item => (
                <div key={item.id} className="flex gap-3 items-start bg-slate-50 rounded-lg p-3">
                  {item.productImageUrl
                    ? <img src={item.productImageUrl} alt={item.productName} className="w-14 h-14 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
                    : <div className="w-14 h-14 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0"><Package size={18} className="text-slate-400" /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800">{item.productName}</div>
                    {item.variantName && <div className="text-xs text-slate-500">{item.variantName}</div>}
                    {item.sku && <div className="text-xs text-slate-400 font-mono">SKU: {item.sku}</div>}
                    <div className="text-xs text-slate-500 mt-1">{item.quantity} × {fmtRp(item.unitPrice)}</div>
                  </div>
                  <div className="text-sm font-bold text-slate-700 flex-shrink-0">{fmtRp(Number(item.subtotal))}</div>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{fmtRp(s.subtotal)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Ongkos Kirim</span><span>{fmtRp(s.shippingCost)}</span></div>
              <div className="flex justify-between text-base font-bold text-slate-800 border-t pt-2"><span>Total</span><span>{fmtRp(s.total)}</span></div>
            </div>
          </div>
        </div>

        {/* Right: action panel (1/3, sticky) */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {/* Guided next action */}
          {s.status !== 'cancelled' && s.status !== 'completed' && (
            <NextActionCard
              s={s} perm={perm}
              proofRef={proofRef}
              statusMut={statusMut} proofMut={proofMut}
            />
          )}

          {/* Payment proof (sales — view + re-upload) */}
          {s.type === 'sales' && (
            <div className="card p-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Bukti Transfer</h3>
              {s.paymentProofUrl ? (
                <div className="space-y-1">
                  <a href={s.paymentProofUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                    <ImageIcon size={14} /> Lihat Bukti <ExternalLink size={11} />
                  </a>
                  {s.paymentProofVerifiedBy && (
                    <div className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Dikonfirmasi {s.paymentVerifier?.name} · {fmtDateTime(s.paymentProofVerifiedAt)}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Belum ada bukti transfer</p>
              )}
              {['pending', 'paid'].includes(s.status) && perm('shipping.manual.approve_payment') && s.paymentProofUrl && (
                <>
                  <input type="file" ref={proofRef} accept="image/*" className="hidden"
                    onChange={e => e.target.files[0] && proofMut.mutate(e.target.files[0])} />
                  <button onClick={() => proofRef.current?.click()} disabled={proofMut.isPending}
                    className="w-full btn-secondary flex items-center gap-2 justify-center text-sm">
                    <Upload size={14} /> Ganti Bukti TF
                  </button>
                </>
              )}
            </div>
          )}

          {/* Courier resi */}
          {canUploadResi && (
            <div className="card p-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Resi Kurir</h3>
              {s.courierResiImageUrl && (
                <a href={s.courierResiImageUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <ImageIcon size={14} /> Lihat Foto Resi <ExternalLink size={11} />
                </a>
              )}
              <input value={resiNumber} onChange={e => setResiNumber(e.target.value)}
                placeholder="Nomor resi kurir…" className="input text-sm" />
              <input type="file" ref={resiFileRef} accept="image/*" className="hidden"
                onChange={e => setResiFile(e.target.files[0] || null)} />
              <button onClick={() => resiFileRef.current?.click()} className="w-full btn-secondary text-sm flex items-center gap-2 justify-center">
                <Upload size={14} /> {resiFile ? resiFile.name : 'Upload Foto Resi'}
              </button>
              <button
                onClick={() => resiMut.mutate({ courierResiNumber: resiNumber, file: resiFile })}
                disabled={resiMut.isPending || (!resiNumber.trim() && !resiFile)}
                className="w-full btn-primary text-sm">
                {resiMut.isPending ? 'Menyimpan…' : 'Simpan Resi'}
              </button>
            </div>
          )}

          {/* Print */}
          <div className="card p-4 space-y-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cetak</h3>
            <div className="space-y-1">
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Resi Sementara</p>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  disabled={markPrintedMut.isPending}
                  onClick={() => { printResiSementara(s, true); markPrintedMut.mutate('resi') }}
                  className={`flex items-center gap-1.5 justify-center text-xs py-2 px-2 rounded-lg font-medium transition-all ${s.resiPrintedAt ? 'border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'btn-secondary'}`}
                >
                  <Printer size={12} />
                  + Produk
                </button>
                <button
                  disabled={markPrintedMut.isPending}
                  onClick={() => { printResiSementara(s, false); markPrintedMut.mutate('resi') }}
                  className={`flex items-center gap-1.5 justify-center text-xs py-2 px-2 rounded-lg font-medium transition-all ${s.resiPrintedAt ? 'border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'btn-secondary'}`}
                >
                  <Printer size={12} />
                  Tanpa Produk
                </button>
              </div>
              {s.resiPrintedAt && <p className="text-[10px] text-emerald-500 font-medium text-center">✓ pernah dicetak</p>}
            </div>
            <button
              disabled={markPrintedMut.isPending}
              onClick={() => {
                const ok = printInvoice(s)
                if (!ok) { toast.error('Popup diblokir browser. Izinkan popup lalu coba lagi.'); return }
                markPrintedMut.mutate('invoice')
              }}
              className={`w-full flex items-center gap-2 justify-center text-sm ${s.invoicePrintedAt ? 'btn-ghost border border-emerald-300 text-emerald-700 hover:bg-emerald-50' : 'btn-secondary'}`}
            >
              <FileText size={15} />
              {s.invoicePrintedAt ? 'Cetak Ulang Invoice' : 'Cetak Invoice'}
              {s.invoicePrintedAt && <span className="ml-auto text-[10px] text-emerald-500 font-medium">✓ pernah dicetak</span>}
            </button>
          </div>

          {/* Edit / Cancel / Delete */}
          {(canEdit || canCancel || canDelete) && (
            <div className="card p-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Lainnya</h3>
              {canEdit && (
                <button onClick={() => navigate(`/shipping-manual/${id}/edit`)} className="w-full btn-secondary flex items-center gap-2 justify-center text-sm">
                  <Edit2 size={14} /> Edit Transaksi
                </button>
              )}
              {canCancel && (
                <button onClick={() => setShowCancel(true)} className="w-full btn-secondary flex items-center gap-2 justify-center text-sm text-amber-600 hover:bg-amber-50">
                  <XCircle size={14} /> Batalkan
                </button>
              )}
              {canDelete && (
                <button onClick={() => setShowDelete(true)} className="w-full btn-danger flex items-center gap-2 justify-center text-sm">
                  <Trash2 size={14} /> Hapus
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cancel modal */}
      {showCancel && (
        <CancelModal
          loading={statusMut.isPending}
          onClose={() => setShowCancel(false)}
          onConfirm={(reason) => { statusMut.mutate({ status: 'cancelled', cancelledReason: reason }); setShowCancel(false) }}
        />
      )}

      {/* Delete confirm */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">Hapus Shipping?</h3>
            <p className="text-sm text-slate-500">Tindakan ini tidak bisa dibatalkan.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDelete(false)} className="btn-secondary">Batal</button>
              <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending} className="btn-danger">
                {deleteMut.isPending ? 'Menghapus…' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
