// Struk thermal: dirender ke iframe tersembunyi lalu window.print().
// Jalan tanpa internet; printer thermal di Mac tampil sebagai printer biasa.
// Logo hitam-putih di-inline (data URI) supaya ikut tercetak walau offline.
import logo from '../assets/logo-preface-receipt.png?inline'

const num = (n) => Number(n || 0).toLocaleString('id-ID')
const rp = (n) => 'Rp' + num(n)
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const METHOD = { CASH: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer', EDC: 'Kartu (EDC)', OTHER: 'Lainnya' }

// 80 mm = ukuran kertas struk POS standar (area cetak ± 72 mm); 58 mm untuk printer portabel
export const DEFAULT_RECEIPT = { widthMm: 80, fontPx: 12 }

// Printer thermal hanya hitam: semua garis/teks hitam pekat, tanpa abu-abu.
// Gaya minimalis: banyak ruang kosong, label kecil berjarak, bintang PREFACE sebagai pemisah.
const STAR = '&#9733;'
// "TSHIRT PREFACE - QUEENPIN" -> "TSHIRT · QUEENPIN": merek sudah ada di logo, nama jadi muat satu baris
const shortName = (n) => String(n || '').replace(/[\u200b-\u200d\u2060\ufeff]/g, '').replace(/\s+PREFACE\s+-\s+/i, ' \u00b7 ').replace(/\s+PREFACE$/i, '').trim()
export function receiptHtml(order, { event, settings = DEFAULT_RECEIPT, cashierName }) {
  const w = Number(settings.widthMm) || 80
  const f = Number(settings.fontPx) || 12
  const d = new Date(order.soldAt)
  const date = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const pcs = order.items.reduce((s, i) => s + i.qty, 0)
  const saved = order.itemDiscount + order.orderDiscount
  // baris "Terima kasih" sudah dicetak tetap, jangan dobel dari catatan event
  const foot = String(event?.receiptFooter || '').split('\n').filter(l => !/^\s*terima kasih!?\s*$/i.test(l)).join('\n').trim()
  const items = order.items.map(i => `
    <div class="item">
      <div class="row top"><span class="name">${esc(shortName(i.name))}</span><span class="amt">${num(i.qty * i.unitPrice)}</span></div>
      <div class="sub">${i.variant ? `<span class="size">${esc(i.variant)}</span>` : ''}${i.qty} &times; ${num(i.unitPrice)}</div>
      ${i.discount ? `<div class="row sub"><span>&mdash; diskon</span><span>-${num(i.discount)}</span></div>` : ''}
    </div>`).join('')
  const pays = order.payments.map(p => `<div class="row"><span>${METHOD[p.method] || esc(p.method)}</span><span>${num(p.amount)}</span></div>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${w}mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 6mm 5mm 8mm; width: ${w}mm; color: #000;
           font: ${f}px/1.5 "Helvetica Neue", Helvetica, Arial, sans-serif; font-variant-numeric: tabular-nums; }
    .c { text-align: center; }
    .row { display: flex; justify-content: space-between; gap: 10px; }
    .logo { display: block; width: 54%; margin: 0 auto; image-rendering: pixelated; }
    .brand { margin-top: 6px; font-size: ${f - 3}px; letter-spacing: .55em; padding-left: .55em; }
    .tag { font-size: ${f - 2}px; letter-spacing: .04em; white-space: pre-line; margin-top: 2px; }
    .star { margin: 10px 0; display: flex; align-items: center; gap: 8px; font-size: ${f - 3}px; }
    .star::before, .star::after { content: ""; flex: 1; border-top: 1px solid #000; }
    .event { font-size: ${f - 1}px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; }
    .loc { font-size: ${f - 2}px; letter-spacing: .1em; text-transform: uppercase; margin-top: 1px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; margin: 10px 0 2px; }
    .meta div:nth-child(even) { text-align: right; }
    .k { display: block; font-size: ${f - 4}px; letter-spacing: .25em; text-transform: uppercase; }
    .v { font-weight: 700; }
    .label { font-size: ${f - 4}px; letter-spacing: .3em; margin: 12px 0 4px; }
    .item { padding: 6px 0; border-bottom: 1px dotted #000; }
    .item:last-child { border-bottom: 0; }
    .top { align-items: baseline; }
    .name { font-weight: 700; letter-spacing: .02em; word-break: break-word; }
    .amt { white-space: nowrap; }
    .sub { font-size: ${f - 1}px; margin-top: 1px; }
    .size { display: inline-block; min-width: 18px; padding: 0 4px; margin-right: 6px; border: 1px solid #000;
            border-radius: 2px; font-size: ${f - 2}px; font-weight: 700; text-align: center; line-height: 1.35; }
    .sum .row { padding: 1px 0; }
    .grand { margin: 10px 0 4px; padding: 7px 0 6px; border-top: 3px double #000; border-bottom: 3px double #000;
             display: flex; justify-content: space-between; align-items: baseline; }
    .grand .k { font-size: ${f - 2}px; letter-spacing: .35em; font-weight: 700; }
    .grand .big { font-size: ${f + 9}px; font-weight: 800; letter-spacing: -.01em; }
    .change { font-weight: 700; }
    .saved { margin-top: 10px; font-size: ${f - 1}px; letter-spacing: .06em; }
    .thanks { font-size: ${f + 2}px; font-weight: 800; letter-spacing: .4em; padding-left: .4em; }
    .foot { font-size: ${f - 2}px; white-space: pre-line; margin-top: 4px; }
    .tiny { font-size: ${f - 4}px; letter-spacing: .15em; text-transform: uppercase; margin-top: 10px; }
  </style></head><body>
    <img class="logo" src="${logo}" alt="PREFACE">
    <div class="c brand">PREFACE WEARHOUSE</div>
    ${event?.receiptHeader ? `<div class="c tag">${esc(event.receiptHeader)}</div>` : ''}

    <div class="star">${STAR}</div>
    ${event?.name ? `<div class="c event">${esc(event.name)}</div>` : ''}
    ${event?.location ? `<div class="c loc">${esc(event.location)}</div>` : ''}

    <div class="meta">
      <div><span class="k">No. Struk</span><span class="v">${esc(order.orderNumber)}</span></div>
      <div><span class="k">Tanggal</span><span class="v">${date}</span></div>
      <div><span class="k">Kasir</span><span class="v">${esc(cashierName || '-')}</span></div>
      <div><span class="k">Jam</span><span class="v">${time}</span></div>
    </div>

    <div class="label">PESANAN &middot; ${pcs} ITEM</div>
    ${items}

    <div class="sum" style="margin-top:8px">
      <div class="row"><span>Subtotal</span><span>${num(order.subtotal)}</span></div>
      ${order.itemDiscount ? `<div class="row"><span>Diskon item</span><span>-${num(order.itemDiscount)}</span></div>` : ''}
      ${order.orderDiscount ? `<div class="row"><span>Diskon tambahan</span><span>-${num(order.orderDiscount)}</span></div>` : ''}
    </div>
    <div class="grand"><span class="k">TOTAL</span><span class="big">${rp(order.total)}</span></div>

    <div class="sum">
      ${pays}
      ${order.cashReceived != null ? `<div class="row"><span>Uang diterima</span><span>${num(order.cashReceived)}</span></div>
        <div class="row change"><span>Kembali</span><span>${rp(order.change)}</span></div>` : ''}
    </div>
    ${saved ? `<div class="c saved">${STAR} Kamu hemat <b>${rp(saved)}</b> ${STAR}</div>` : ''}

    <div class="star">${STAR} ${STAR} ${STAR}</div>
    <div class="c thanks">TERIMA KASIH</div>
    ${foot ? `<div class="c foot">${esc(foot)}</div>` : ''}
    <div class="c tiny">Simpan struk ini sebagai bukti pembelian</div>
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
