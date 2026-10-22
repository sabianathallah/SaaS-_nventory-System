// Struk thermal: dirender ke iframe tersembunyi lalu window.print().
// Jalan tanpa internet; printer thermal di Mac tampil sebagai printer biasa.
// Logo hitam-putih di-inline (data URI) supaya ikut tercetak walau offline.
import logo from '../assets/logo-preface-receipt.png?inline'

const rp = (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID')
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const METHOD = { CASH: 'Cash', QRIS: 'QRIS', TRANSFER: 'Transfer', EDC: 'EDC/Kartu', OTHER: 'Lainnya' }

// 80 mm = ukuran kertas struk POS standar (area cetak ± 72 mm); 58 mm untuk printer portabel
export const DEFAULT_RECEIPT = { widthMm: 80, fontPx: 12 }

export function receiptHtml(order, { event, settings = DEFAULT_RECEIPT, cashierName }) {
  const w = Number(settings.widthMm) || 80
  const f = Number(settings.fontPx) || 12
  const when = new Date(order.soldAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
  const lines = order.items.map(i => `
    <div class="it">${esc(i.name)}${i.variant ? ` (${esc(i.variant)})` : ''}</div>
    <div class="row"><span>${i.qty} x ${rp(i.unitPrice)}</span><span>${rp(i.qty * i.unitPrice)}</span></div>
    ${i.discount ? `<div class="row sm"><span>Diskon</span><span>-${rp(i.discount)}</span></div>` : ''}`).join('')
  const pays = order.payments.map(p => `<div class="row"><span>${METHOD[p.method] || p.method}</span><span>${rp(p.amount)}</span></div>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${w}mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 3mm 4mm; width: ${w}mm; font: ${f}px/1.35 ui-monospace, Menlo, monospace; color: #000; }
    .logo { display: block; width: ${Math.round(w * 0.7)}%; margin: 0 auto 2px; image-rendering: pixelated; }
    .brand { letter-spacing: 2px; font-size: ${f + 1}px; }
    .c { text-align: center; } .b { font-weight: 700; } .sm { font-size: ${f - 1}px; }
    .row { display: flex; justify-content: space-between; gap: 4px; }
    .it { margin-top: 3px; word-break: break-word; }
    hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
    .pre { white-space: pre-line; }
  </style></head><body>
    <img class="logo" src="${logo}" alt="PREFACE">
    <div class="c b brand">PREFACE WEARHOUSE</div>
    ${event?.receiptHeader ? `<div class="c sm pre">${esc(event.receiptHeader)}</div>` : ''}
    ${event?.name ? `<div class="c sm">${esc(event.name)}${event.location ? ` · ${esc(event.location)}` : ''}</div>` : ''}
    <hr>
    <div class="row sm"><span>${esc(order.orderNumber)}</span><span>${when}</span></div>
    ${cashierName ? `<div class="sm">Kasir: ${esc(cashierName)}</div>` : ''}
    <hr>${lines}<hr>
    <div class="row"><span>Subtotal</span><span>${rp(order.subtotal)}</span></div>
    ${order.itemDiscount + order.orderDiscount ? `<div class="row"><span>Total diskon</span><span>-${rp(order.itemDiscount + order.orderDiscount)}</span></div>` : ''}
    <div class="row b"><span>TOTAL</span><span>${rp(order.total)}</span></div>
    <hr>${pays}
    ${order.cashReceived != null ? `<div class="row"><span>Tunai diterima</span><span>${rp(order.cashReceived)}</span></div>
      <div class="row b"><span>Kembali</span><span>${rp(order.change)}</span></div>` : ''}
    <hr>
    <div class="c sm pre">${esc(event?.receiptFooter || 'Terima kasih!')}</div>
  </body></html>`
}

export function printReceipt(html) {
  const frame = document.createElement('iframe')
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  doc.open(); doc.write(html); doc.close()
  frame.onload = null
  setTimeout(() => {
    frame.contentWindow.focus()
    frame.contentWindow.print()
    setTimeout(() => frame.remove(), 1000)
  }, 50)
}
