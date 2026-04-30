import { useRef, useState } from 'react'
import { QRCode } from 'react-qr-code'
import { X, QrCode, Printer } from 'lucide-react'

const PRESETS = [
  { id: '30x20', label: '30×20', w: 30, h: 20 },
  { id: '40x30', label: '40×30', w: 40, h: 30 },
  { id: '50x40', label: '50×40', w: 50, h: 40 },
  { id: '58x40', label: '58×40', w: 58, h: 40 },
  { id: '80x50', label: '80×50', w: 80, h: 50 },
]

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Compute layout values from label dimensions (mm)
function calcLayout(w, h) {
  const pad   = Math.max(1, +(Math.min(w, h) * 0.055).toFixed(1))  // mm
  const textH = Math.max(4, +(h * 0.30).toFixed(1))                 // mm for text below QR
  const qrMm  = Math.max(6, +(Math.min(w - pad * 2, h - pad * 2 - textH)).toFixed(1))
  const namePt = Math.max(4,   +(h * 0.135).toFixed(1))
  const codePt = Math.max(3.5, +(h * 0.110).toFixed(1))
  return { pad, qrMm, namePt, codePt }
}

export default function QrModal({ sku, skuName, onClose }) {
  const qrRef = useRef(null)
  const [sizeId,  setSizeId]  = useState('40x30')
  const [customW, setCustomW] = useState('')
  const [customH, setCustomH] = useState('')
  const [copies,  setCopies]  = useState(1)

  const isCustom = sizeId === 'custom'
  const preset   = PRESETS.find(s => s.id === sizeId)
  const w = isCustom ? (Number(customW) || 40) : (preset?.w ?? 40)
  const h = isCustom ? (Number(customH) || 30) : (preset?.h ?? 30)
  const count = Math.min(999, Math.max(1, Number(copies) || 1))

  const { pad, qrMm, namePt, codePt } = calcLayout(w, h)

  // Preview scale: fit in ~260px wide max
  const scale  = Math.min(3.6, 260 / w)
  const qrPx   = Math.max(20, Math.round(qrMm * scale))
  const padPx  = Math.max(2, Math.round(pad * scale))
  // 1pt = 0.353mm; scale mm→px
  const namePx = Math.max(7,  Math.round(namePt * 0.353 * scale))
  const codePx = Math.max(6,  Math.round(codePt * 0.353 * scale))

  const handlePrint = () => {
    const svgEl = qrRef.current?.querySelector('svg')
    if (!svgEl) return

    const svgClone = svgEl.cloneNode(true)
    svgClone.setAttribute('width',  '100%')
    svgClone.setAttribute('height', '100%')
    const svgHtml = svgClone.outerHTML

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
@page{size:${w}mm ${h}mm;margin:0;}
body{font-family:'Courier New',monospace;background:#fff;}
.label{
  width:${w}mm;height:${h}mm;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:${pad}mm;gap:1mm;
  page-break-after:always;
}
.label:last-child{page-break-after:avoid;}
.qr{width:${qrMm}mm;height:${qrMm}mm;flex-shrink:0;}
.qr svg{width:100%;height:100%;display:block;}
.info{width:100%;text-align:center;display:flex;flex-direction:column;gap:0.5mm;}
.name{font-size:${namePt}pt;font-weight:bold;color:#000;word-break:break-word;line-height:1.2;}
.code{font-size:${codePt}pt;color:#333;word-break:break-all;line-height:1.2;font-family:'Courier New',monospace;}
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
            className="flex flex-col items-center justify-center bg-white border-2 border-dashed border-slate-200 rounded-xl shadow-sm"
            style={{ width: Math.round(w * scale), height: Math.round(h * scale), padding: padPx, gap: Math.max(1, Math.round(scale)) }}
          >
            <div ref={qrRef} style={{ flexShrink: 0 }}>
              <QRCode value={sku.sku_code} size={qrPx} />
            </div>
            <div className="text-center w-full">
              {skuName && (
                <p style={{ fontSize: namePx, fontWeight: 'bold', lineHeight: 1.2, wordBreak: 'break-word' }} className="text-slate-800">{skuName}</p>
              )}
              <p style={{ fontSize: codePx, lineHeight: 1.2 }} className="font-mono text-slate-400 break-all">{sku.sku_code}</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400">Preview {w}×{h} mm</p>
        </div>

        {/* Preset picker */}
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">Ukuran Label</p>
          <div className="grid grid-cols-5 gap-1.5 mb-2.5">
            {PRESETS.map(s => (
              <button
                key={s.id}
                onClick={() => { setSizeId(s.id); setCustomW(''); setCustomH('') }}
                className={`py-2 px-1 rounded-lg border text-[10px] font-semibold transition-colors text-center leading-tight ${
                  sizeId === s.id
                    ? 'border-violet-400 bg-violet-50 text-violet-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {s.label}<span className="block text-[8px] font-normal opacity-50">mm</span>
              </button>
            ))}
          </div>

          {/* Custom size inputs */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-medium w-12 shrink-0">Custom</span>
            <input
              type="number" min="10" max="300" placeholder="Lebar"
              value={isCustom ? customW : (preset?.w ?? '')}
              onChange={e => { setSizeId('custom'); setCustomW(e.target.value) }}
              className="input w-[72px] text-center text-xs py-1"
            />
            <span className="text-slate-300 text-sm shrink-0">×</span>
            <input
              type="number" min="10" max="300" placeholder="Tinggi"
              value={isCustom ? customH : (preset?.h ?? '')}
              onChange={e => { setSizeId('custom'); setCustomH(e.target.value) }}
              className="input w-[72px] text-center text-xs py-1"
            />
            <span className="text-slate-400 text-[10px] shrink-0">mm</span>
          </div>
        </div>

        {/* Copies */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500 flex-1">Jumlah Copy</label>
          <input
            type="number" min={1} max={999}
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
