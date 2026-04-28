import { useRef, useState } from 'react'
import { QRCode } from 'react-qr-code'
import { X, QrCode, Printer } from 'lucide-react'

// w, h = label size in mm; qrMm = QR block width in mm; qr = preview px size
const SIZES = [
  { id: '30x20', label: '30×20 mm', w: 30, h: 20, qrMm: 16, qr: 56 },
  { id: '40x30', label: '40×30 mm', w: 40, h: 30, qrMm: 24, qr: 72 },
  { id: '50x40', label: '50×40 mm', w: 50, h: 40, qrMm: 32, qr: 90 },
  { id: '58x40', label: '58×40 mm', w: 58, h: 40, qrMm: 34, qr: 90 },
  { id: '80x50', label: '80×50 mm', w: 80, h: 50, qrMm: 44, qr: 110 },
]

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default function QrModal({ sku, skuName, onClose }) {
  const qrRef = useRef(null)
  const [sizeId, setSizeId] = useState('40x30')
  const [copies, setCopies] = useState(1)

  const size  = SIZES.find(s => s.id === sizeId) ?? SIZES[1]
  const count = Math.min(999, Math.max(1, Number(copies) || 1))

  const handlePrint = () => {
    const svgEl = qrRef.current?.querySelector('svg')
    if (!svgEl) return

    const svgClone = svgEl.cloneNode(true)
    svgClone.setAttribute('width',  '100%')
    svgClone.setAttribute('height', '100%')
    const svgHtml = svgClone.outerHTML

    const namePt = size.h <= 20 ? '5.5pt' : '7pt'
    const codePt = size.h <= 20 ? '5pt'   : '6pt'
    const pad    = size.h <= 20 ? '1mm'   : '1.5mm'
    const gap    = size.h <= 20 ? '1mm'   : '2mm'

    const label = `<div class="label">
  <div class="qr">${svgHtml}</div>
  <div class="info">
    ${skuName ? `<div class="name">${esc(skuName)}</div>` : ''}
    <div class="code">${esc(sku.sku_code)}</div>
  </div>
</div>`

    const html = `<!DOCTYPE html><html><head>
<title>QR ${esc(sku.sku_code)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
@page{size:${size.w}mm ${size.h}mm;margin:0;}
body{font-family:'Courier New',monospace;background:#fff;}
.label{
  width:${size.w}mm;height:${size.h}mm;
  display:flex;flex-direction:row;align-items:center;
  padding:${pad};gap:${gap};
  overflow:hidden;
  page-break-after:always;
}
.label:last-child{page-break-after:avoid;}
.qr{width:${size.qrMm}mm;height:${size.qrMm}mm;flex-shrink:0;}
.qr svg{width:100%;height:100%;display:block;}
.info{flex:1;min-width:0;display:flex;flex-direction:column;gap:0.6mm;overflow:hidden;}
.name{font-size:${namePt};font-weight:bold;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.code{font-size:${codePt};color:#222;word-break:break-all;line-height:1.3;}
</style>
</head><body>${Array(count).fill(label).join('')}</body></html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm flex flex-col gap-5 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <QrCode size={14} className="text-violet-500" /> Print Label QR
          </h3>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X size={14} />
          </button>
        </div>

        {/* Preview */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="flex items-center gap-3 bg-white border-2 border-dashed border-slate-200 rounded-xl shadow-sm overflow-hidden"
            style={{ width: Math.min(size.w * 3.2, 300), height: size.h * 3.2 }}
          >
            <div className="flex-shrink-0 pl-3" ref={qrRef}>
              <QRCode value={sku.sku_code} size={size.qr} />
            </div>
            <div className="flex-1 min-w-0 pr-3 space-y-1 overflow-hidden">
              {skuName && (
                <p className="text-[10px] font-bold text-slate-800 truncate leading-tight">{skuName}</p>
              )}
              <p className="text-[9px] font-mono text-slate-400 break-all leading-snug">{sku.sku_code}</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400">Preview {size.label}</p>
        </div>

        {/* Size picker */}
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">Ukuran Label</p>
          <div className="grid grid-cols-5 gap-1.5">
            {SIZES.map(s => (
              <button
                key={s.id}
                onClick={() => setSizeId(s.id)}
                className={`py-2 px-1 rounded-lg border text-[10px] font-semibold transition-colors text-center leading-tight ${
                  sizeId === s.id
                    ? 'border-violet-400 bg-violet-50 text-violet-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {s.label.replace(' mm', '')}<span className="block text-[8px] font-normal opacity-50">mm</span>
              </button>
            ))}
          </div>
        </div>

        {/* Copies — direct input */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500 flex-1">Jumlah Copy</label>
          <input
            type="number"
            min={1}
            max={999}
            value={copies}
            onChange={e => setCopies(e.target.value)}
            onBlur={e => setCopies(Math.min(999, Math.max(1, Number(e.target.value) || 1)))}
            className="w-20 text-center text-sm font-bold text-slate-700 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 tabular-nums"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center text-xs">Tutup</button>
          <button onClick={handlePrint} className="btn-primary flex-1 justify-center text-xs">
            <Printer size={12} /> Print {count > 1 ? `${count} lembar` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
