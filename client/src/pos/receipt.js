// Struk thermal: dirender ke iframe tersembunyi lalu window.print().
// Jalan tanpa internet; printer thermal di Mac tampil sebagai printer biasa.
// Logo hitam-putih di-inline (data URI) supaya ikut tercetak walau offline.
// Printer thermal hanya hitam: semua garis/teks hitam pekat, tanpa abu-abu atau gradasi.
import logo from '../assets/logo-preface-receipt.png?inline'

const num = (n) => Number(n || 0).toLocaleString('id-ID')
const rp = (n) => 'Rp' + num(n)
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const METHOD = { CASH: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer', EDC: 'Kartu (EDC)', OTHER: 'Lainnya' }
const HANDLE = '@prefacewearhouse'
const STAR = '&#9733;'

// 80 mm = ukuran kertas struk POS standar (area cetak ± 72 mm); 58 mm untuk printer portabel
export const DEFAULT_RECEIPT = { widthMm: 80, fontPx: 12, style: 'minimal', showCashier: false }
export const RECEIPT_STYLES = [['minimal', 'Minimalis'], ['street', 'Streetwear']]

// "TSHIRT PREFACE - QUEENPIN" -> "TSHIRT \u00b7 QUEENPIN": merek sudah ada di logo, nama jadi muat satu baris
const shortName = (n) => String(n || '').replace(/[\u200b-\u200d\u2060\ufeff]/g, '').replace(/\s+PREFACE\s+-\s+/i, ' \u00b7 ').replace(/\s+PREFACE$/i, '').trim()
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || ''

// Barcode Code 39 dari nomor struk (huruf besar, angka, '-'); bisa di-scan untuk mencari transaksi.
const C39 = {
  0: '000110100', 1: '100100001', 2: '001100001', 3: '101100000', 4: '000110001', 5: '100110000', 6: '001110000',
  7: '000100101', 8: '100100100', 9: '001100100', A: '100001001', B: '001001001', C: '101001000', D: '000011001',
  E: '100011000', F: '001011000', G: '000001101', H: '100001100', I: '001001100', J: '000011100', K: '100000011',
  L: '001000011', M: '101000010', N: '000010011', O: '100010010', P: '001010010', Q: '000000111', R: '100000110',
  S: '001000110', T: '000010110', U: '110000001', V: '011000001', W: '111000000', X: '010010001', Y: '110010000',
  Z: '011010000', '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100',
}
export function code39Widths(text) {
  const chars = `*${String(text).toUpperCase().replace(/[^0-9A-Z.\- ]/g, '')}*`
  const out = [] // lebar modul berurutan: bar, spasi, bar, ... (1 = tipis, 3 = tebal)
  ;[...chars].forEach((ch, i) => {
    for (const bit of C39[ch]) out.push(bit === '1' ? 3 : 1)
    if (i < chars.length - 1) out.push(1) // jeda antar karakter
  })
  return out
}
function code39Svg(text, heightPx = 44) {
  const widths = code39Widths(text)
  let x = 10, rects = '' // 10 modul zona tenang kiri/kanan
  widths.forEach((w, i) => { if (i % 2 === 0) rects += `<rect x="${x}" y="0" width="${w}" height="${heightPx}"/>`; x += w })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x + 10} ${heightPx}" preserveAspectRatio="none" style="width:100%;height:${heightPx}px;display:block" shape-rendering="crispEdges">${rects}</svg>`
}

function ctx(order, event, settings) {
  const d = new Date(order.soldAt)
  const sold = order.items.filter(i => i.qty > 0)
  const back = order.items.filter(i => i.qty < 0)
  return {
    sold, back,
    // tukar barang: nomor struk asal (offline: exchangeOfNumber, dari server: exchangeOf.orderNumber)
    swapOf: order.exchangeOfNumber || order.exchangeOf?.orderNumber || '',
    refund: order.total < 0 ? -order.total : 0,
    w: Number(settings.widthMm) || 80,
    f: Number(settings.fontPx) || 12,
    date: d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    pcs: sold.reduce((s, i) => s + i.qty, 0),
    name: String(order.customerName || '').trim(),
    // baris "Terima kasih" sudah dicetak tetap, jangan dobel dari catatan event
    foot: String(event?.receiptFooter || '').split('\n').filter(l => !/^\s*terima kasih!?\s*$/i.test(l)).join('\n').trim(),
    pays: order.payments.map(p => `<div class="row"><span>${METHOD[p.method] || esc(p.method)}</span><span>${num(p.amount)}</span></div>`).join(''),
  }
}
const pageCss = (w, f, font) => `
  @page { size: ${w}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; width: ${w}mm; color: #000; font: ${f}px/1.5 ${font}; font-variant-numeric: tabular-nums;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .c { text-align: center; } .row { display: flex; justify-content: space-between; gap: 10px; }`

// ── Minimalis ────────────────────────────────────────────────────────────────
function minimal(order, { event, settings, cashierName }) {
  const { w, f, date, time, pcs, name, foot, pays, sold, back, swapOf, refund } = ctx(order, event, settings)
  const backItems = back.map(i => `
    <div class="item">
      <div class="row top"><span class="nm">${esc(shortName(i.name))}</span><span class="amt">-${num(-i.qty * i.unitPrice)}</span></div>
      <div class="sub">${i.variant ? `<span class="size">${esc(i.variant)}</span>` : ''}${-i.qty} &times; ${num(i.unitPrice)}</div>
    </div>`).join('')
  const items = sold.map(i => `
    <div class="item">
      <div class="row top"><span class="nm">${esc(shortName(i.name))}</span><span class="amt">${num(i.qty * i.unitPrice)}</span></div>
      <div class="sub">${i.variant ? `<span class="size">${esc(i.variant)}</span>` : ''}${i.qty} &times; ${num(i.unitPrice)}</div>
      ${i.discount ? `<div class="row sub"><span>&mdash; diskon</span><span>-${num(i.discount)}</span></div>` : ''}
    </div>`).join('')
  const meta = [['No. Struk', order.orderNumber], ['Tanggal', date], name && ['Atas nama', name], ['Jam', time],
    swapOf && ['Tukar dari', swapOf], settings.showCashier && cashierName && ['Kasir', cashierName]].filter(Boolean)
  return `<!doctype html><html><head><meta charset="utf-8"><style>${pageCss(w, f, '"Helvetica Neue", Helvetica, Arial, sans-serif')}
    body { padding: 6mm 5mm 8mm; }
    .logo { display: block; width: 54%; margin: 0 auto; image-rendering: pixelated; }
    .handle { margin-top: 6px; font-size: ${f - 1}px; letter-spacing: .12em; }
    .star { margin: 10px 0; display: flex; align-items: center; gap: 8px; font-size: ${f - 3}px; }
    .star::before, .star::after { content: ""; flex: 1; border-top: 1px solid #000; }
    .event { font-size: ${f - 1}px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; }
    .loc { font-size: ${f - 2}px; letter-spacing: .1em; text-transform: uppercase; margin-top: 1px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; margin: 10px 0 2px; }
    .meta div:nth-child(even) { text-align: right; }
    .k { display: block; font-size: ${f - 4}px; letter-spacing: .25em; text-transform: uppercase; }
    .v { font-weight: 700; }
    .label { font-size: ${f - 4}px; letter-spacing: .3em; margin: 12px 0 4px; }
    .item { padding: 6px 0; border-bottom: 1px dotted #000; } .item:last-child { border-bottom: 0; }
    .top { align-items: baseline; } .nm { font-weight: 700; letter-spacing: .02em; word-break: break-word; } .amt { white-space: nowrap; }
    .sub { font-size: ${f - 1}px; margin-top: 1px; }
    .size { display: inline-block; min-width: 18px; padding: 0 4px; margin-right: 6px; border: 1px solid #000;
            border-radius: 2px; font-size: ${f - 2}px; font-weight: 700; text-align: center; line-height: 1.35; }
    .sum .row { padding: 1px 0; }
    .grand { margin: 10px 0 4px; padding: 7px 0 6px; border-top: 3px double #000; border-bottom: 3px double #000;
             display: flex; justify-content: space-between; align-items: baseline; }
    .grand .k { font-size: ${f - 2}px; letter-spacing: .35em; font-weight: 700; }
    .grand .big { font-size: ${f + 9}px; font-weight: 800; letter-spacing: -.01em; }
    .bold { font-weight: 700; }
    .thanks { font-size: ${f + 2}px; font-weight: 800; letter-spacing: .4em; padding-left: .4em; }
    .for { font-size: ${f + 4}px; font-weight: 800; margin-top: 2px; }
    .foot { font-size: ${f - 2}px; white-space: pre-line; margin-top: 4px; }
    .bc { margin: 12px 6% 2px; } .bcn { font-size: ${f - 3}px; letter-spacing: .3em; }
    .pick { margin: 10px 0 2px; padding: 7px 6px; border: 2px solid #000; text-align: center; }
    .pick .code { display: block; font-size: ${f + 14}px; font-weight: 800; letter-spacing: .08em; line-height: 1.15; }
    .pick .hint { display: block; font-size: ${f - 3}px; letter-spacing: .05em; }
  </style></head><body>
    <img class="logo" src="${logo}" alt="PREFACE">
    <div class="c handle">${HANDLE}</div>
    <div class="star">${STAR}</div>
    ${event?.name ? `<div class="c event">${esc(event.name)}</div>` : ''}
    ${event?.location ? `<div class="c loc">${esc(event.location)}</div>` : ''}
    <div class="meta">${meta.map(([k, v]) => `<div><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join('')}</div>
    ${order.fulfillment === 'LATER' ? `<div class="pick"><span class="k">AMBIL DI BOOTH &middot; NOMOR AMBIL</span><span class="code">${esc(order.pickupCode || order.orderNumber)}</span><span class="hint">Tunjukkan struk ini saat mengambil barang</span></div>` : ''}

    ${back.length ? `<div class="label">DIKEMBALIKAN</div>${backItems}` : ''}
    ${sold.length ? `<div class="label">${back.length ? 'PENGGANTI' : 'PESANAN'} &middot; ${pcs} ITEM</div>${items}` : ''}
    <div class="sum" style="margin-top:8px">
      ${sold.length ? `<div class="row"><span>Subtotal</span><span>${num(order.subtotal)}</span></div>` : ''}
      ${order.itemDiscount ? `<div class="row"><span>Diskon item</span><span>-${num(order.itemDiscount)}</span></div>` : ''}
      ${order.orderDiscount ? `<div class="row"><span>Diskon tambahan</span><span>-${num(order.orderDiscount)}</span></div>` : ''}
      ${order.returnTotal ? `<div class="row"><span>Barang dikembalikan</span><span>-${num(order.returnTotal)}</span></div>` : ''}
    </div>
    <div class="grand"><span class="k">${refund ? 'UANG KEMBALI' : swapOf ? 'SELISIH' : 'TOTAL'}</span><span class="big">${rp(refund || order.total)}</span></div>
    <div class="sum">
      ${pays}
      ${order.cashReceived != null ? `<div class="row"><span>Uang diterima</span><span>${num(order.cashReceived)}</span></div>
        <div class="row bold"><span>Kembali</span><span>${rp(order.change)}</span></div>` : ''}
    </div>

    <div class="star">${STAR} ${STAR} ${STAR}</div>
    <div class="c thanks">TERIMA KASIH</div>
    ${name ? `<div class="c for">${esc(firstName(name))}!</div>` : ''}
    ${foot ? `<div class="c foot">${esc(foot)}</div>` : ''}
    <div class="bc">${code39Svg(order.orderNumber, 34)}</div>
    <div class="c bcn">${esc(order.orderNumber)}</div>
  </body></html>`
}

// ── Streetwear: blok hitam tebal, huruf condensed besar, nomor item 01/02, barcode ala hang tag ──
function street(order, { event, settings, cashierName }) {
  const { w, f, date, time, pcs, name, foot, pays, sold, back, swapOf, refund } = ctx(order, event, settings)
  const backItems = back.map(i => `
    <div class="item">
      <div class="no">&#8617;</div>
      <div class="body">
        <div class="nm">${esc(shortName(i.name))}</div>
        <div class="row tags"><span>${i.variant ? `<b class="chip">SIZE ${esc(i.variant)}</b>` : ''}<b class="chip">KEMBALI ${String(-i.qty).padStart(2, '0')}</b></span><span class="amt">-${num(-i.qty * i.unitPrice)}</span></div>
      </div>
    </div>`).join('')
  const items = sold.map((i, idx) => `
    <div class="item">
      <div class="no">${String(idx + 1).padStart(2, '0')}</div>
      <div class="body">
        <div class="nm">${esc(shortName(i.name))}</div>
        <div class="row tags"><span>${i.variant ? `<b class="chip">SIZE ${esc(i.variant)}</b>` : ''}<b class="chip">QTY ${String(i.qty).padStart(2, '0')}</b> @${num(i.unitPrice)}</span><span class="amt">${num(i.qty * i.unitPrice)}</span></div>
        ${i.discount ? `<div class="row tags"><span>DISKON</span><span>-${num(i.discount)}</span></div>` : ''}
      </div>
    </div>`).join('')
  const strip = Array(6).fill(`PREFACE ${STAR}`).join(' ')
  return `<!doctype html><html><head><meta charset="utf-8"><style>${pageCss(w, f, '"Helvetica Neue", Helvetica, Arial, sans-serif')}
    body { padding: 4mm 4mm 7mm; }
    .cond { font-family: Impact, "Haettenschweiler", "Arial Narrow", "Helvetica Neue", sans-serif; font-weight: 400; letter-spacing: .01em; }
    .logo { display: block; width: 86%; margin: 0 auto; image-rendering: pixelated; }
    .handle { font-size: ${f}px; font-weight: 800; letter-spacing: .08em; margin-top: 4px; }
    .strip { margin: 8px -4mm; padding: 3px 0; background: #000; color: #fff; white-space: nowrap; overflow: hidden;
             font-size: ${f - 2}px; font-weight: 800; letter-spacing: .3em; text-align: center; }
    .drop { display: flex; justify-content: space-between; align-items: flex-end; margin: 6px 0; }
    .drop .ev { font-size: ${f + 8}px; line-height: 1; text-transform: uppercase; }
    .drop .loc { font-size: ${f - 2}px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; }
    .drop .r { text-align: right; font-size: ${f - 2}px; font-weight: 700; line-height: 1.3; }
    .bar { border-top: 3px solid #000; margin: 6px 0; }
    .label { display: flex; justify-content: space-between; font-size: ${f - 3}px; font-weight: 800; letter-spacing: .25em; }
    .item { display: flex; gap: 8px; padding: 6px 0; border-bottom: 1.5px solid #000; }
    .no { font-family: Impact, "Arial Narrow", sans-serif; font-size: ${f + 12}px; line-height: .9; min-width: 30px; }
    .body { flex: 1; min-width: 0; }
    .nm { font-family: Impact, "Arial Narrow", sans-serif; font-size: ${f + 5}px; line-height: 1.05; text-transform: uppercase; word-break: break-word; }
    .tags { font-size: ${f - 2}px; margin-top: 3px; align-items: center; }
    .chip { display: inline-block; padding: 0 4px; margin-right: 4px; border: 1.5px solid #000; font-size: ${f - 3}px; letter-spacing: .08em; }
    .amt { font-weight: 800; font-size: ${f}px; white-space: nowrap; }
    .sum { margin-top: 6px; font-size: ${f - 1}px; } .sum .row { padding: 1px 0; } .up { text-transform: uppercase; }
    .total { margin: 8px -4mm 6px; padding: 6px 4mm 5px; background: #000; color: #fff; display: flex; justify-content: space-between; align-items: flex-end; }
    .total .k { font-size: ${f - 1}px; font-weight: 800; letter-spacing: .3em; }
    .total .big { font-family: Impact, "Arial Narrow", sans-serif; font-size: ${f + 16}px; line-height: 1; }
    .bold { font-weight: 800; }
    .ty { margin-top: 10px; border: 3px solid #000; padding: 8px 6px 6px; text-align: center; }
    .ty .s { font-size: ${f - 3}px; font-weight: 800; letter-spacing: .35em; }
    .ty .big { font-family: Impact, "Arial Narrow", sans-serif; font-size: ${f + 20}px; line-height: .95; text-transform: uppercase; word-break: break-word; }
    .foot { font-size: ${f - 2}px; white-space: pre-line; margin-top: 6px; }
    .pick { margin: 6px -4mm 4px; padding: 6px 4mm; background: #000; color: #fff; text-align: center; }
    .pick .k { font-size: ${f - 3}px; font-weight: 800; letter-spacing: .3em; }
    .pick .code { font-family: Impact, "Arial Narrow", sans-serif; font-size: ${f + 22}px; line-height: 1; letter-spacing: .04em; }
    .bc { margin: 10px 2% 0; } .bcn { display: flex; justify-content: space-between; font-size: ${f - 3}px; font-weight: 800; letter-spacing: .2em; margin-top: 2px; }
  </style></head><body>
    <img class="logo" src="${logo}" alt="PREFACE">
    <div class="c handle">${HANDLE}</div>
    <div class="strip">${strip}</div>
    <div class="drop">
      <div>${event?.name ? `<div class="ev cond">${esc(event.name)}</div>` : ''}${event?.location ? `<div class="loc">${esc(event.location)}</div>` : ''}</div>
      <div class="r">${date}<br>${time}${settings.showCashier && cashierName ? `<br>KASIR ${esc(firstName(cashierName)).toUpperCase()}` : ''}</div>
    </div>
    ${order.fulfillment === 'LATER' ? `<div class="pick"><div class="k">PICKUP NO.</div><div class="code">${esc(order.pickupCode || order.orderNumber)}</div><div class="k">AMBIL DI BOOTH &middot; TUNJUKKAN STRUK INI</div></div>` : ''}
    <div class="bar"></div>
    <div class="label"><span>ORDER ${esc(order.orderNumber)}</span><span>${String(pcs).padStart(2, '0')} PCS</span></div>
    ${swapOf ? `<div class="label" style="margin-top:3px"><span>TUKAR DARI ${esc(swapOf)}</span><span></span></div>` : ''}
    ${backItems}
    ${items}
    <div class="sum">
      ${sold.length ? `<div class="row"><span>SUBTOTAL</span><span>${num(order.subtotal)}</span></div>` : ''}
      ${order.itemDiscount ? `<div class="row"><span>DISKON ITEM</span><span>-${num(order.itemDiscount)}</span></div>` : ''}
      ${order.orderDiscount ? `<div class="row"><span>DISKON TAMBAHAN</span><span>-${num(order.orderDiscount)}</span></div>` : ''}
      ${order.returnTotal ? `<div class="row"><span>BARANG KEMBALI</span><span>-${num(order.returnTotal)}</span></div>` : ''}
    </div>
    <div class="total"><span class="k">${refund ? 'UANG KEMBALI' : swapOf ? 'SELISIH' : 'TOTAL'}</span><span class="big">${rp(refund || order.total)}</span></div>
    <div class="sum up">
      ${pays}
      ${order.cashReceived != null ? `<div class="row"><span>UANG DITERIMA</span><span>${num(order.cashReceived)}</span></div>
        <div class="row bold"><span>KEMBALI</span><span>${rp(order.change)}</span></div>` : ''}
    </div>
    <div class="ty">
      <div class="s">${STAR} THANK YOU ${STAR}</div>
      <div class="big">${name ? esc(firstName(name)) : 'FOR COPPING'}</div>
      <div class="s" style="margin-top:4px">${name ? 'FOR COPPING PREFACE' : 'PREFACE'}</div>
    </div>
    ${foot ? `<div class="c foot">${esc(foot)}</div>` : ''}
    <div class="bc">${code39Svg(order.orderNumber, 40)}</div>
    <div class="bcn"><span>${esc(order.orderNumber)}</span><span>${HANDLE.toUpperCase()}</span></div>
  </body></html>`
}

// ── Slip operasional (copy staff): diserahkan kasir ke tim gudang booth, tiap transaksi ──
function slip(order, { event, settings, cashierName }) {
  const { w, f, date, time, pcs, name, sold, back, swapOf, refund } = ctx(order, event, settings)
  const later = order.fulfillment === 'LATER'
  const items = sold.map(i => `
    <div class="it"><span class="box"></span><span class="q">${i.qty}&times;</span><span class="nm">${esc(shortName(i.name))}</span><span class="sz">${esc(i.variant || '-')}</span></div>`).join('')
  const backItems = back.map(i => `
    <div class="it"><span class="box"></span><span class="q">${-i.qty}&times;</span><span class="nm">${esc(shortName(i.name))}</span><span class="sz">${esc(i.variant || '-')}</span></div>`).join('')
  const paid = order.payments.map(p => METHOD[p.method] || p.method).join(' + ') || '-'
  return `<!doctype html><html><head><meta charset="utf-8"><style>${pageCss(w, f, '"Helvetica Neue", Helvetica, Arial, sans-serif')}
    body { padding: 4mm 4mm 7mm; }
    .copy { display: flex; justify-content: space-between; font-size: ${f - 3}px; font-weight: 800; letter-spacing: .25em; border-bottom: 2px solid #000; padding-bottom: 3px; }
    .mode { margin: 8px 0 6px; padding: 6px; text-align: center; font-size: ${f + 4}px; font-weight: 800; letter-spacing: .1em;
            ${later ? 'background:#000;color:#fff;' : 'border:2px dashed #000;'} }
    .code { text-align: center; font-family: Impact, "Arial Narrow", sans-serif; font-size: ${f + 26}px; line-height: 1; }
    .k { font-size: ${f - 3}px; font-weight: 800; letter-spacing: .2em; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; margin: 8px 0; font-size: ${f - 1}px; }
    .grid div:nth-child(even) { text-align: right; } .v { font-weight: 800; display: block; }
    .it { display: flex; align-items: center; gap: 6px; padding: 5px 0; border-bottom: 1px solid #000; }
    .box { width: 14px; height: 14px; border: 2px solid #000; flex: none; }
    .q { font-weight: 800; min-width: 22px; } .nm { flex: 1; font-weight: 700; text-transform: uppercase; }
    .sz { font-weight: 800; border: 1.5px solid #000; padding: 0 5px; min-width: 26px; text-align: center; }
    .sum { display: flex; justify-content: space-between; margin-top: 6px; font-weight: 800; }
    .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px; font-size: ${f - 3}px; text-align: center; }
    .sign div { border-top: 1px solid #000; padding-top: 2px; }
    .bc { margin: 10px 4% 0; }
  </style></head><body>
    <div class="copy"><span>SLIP OPERASIONAL</span><span>COPY STAFF</span></div>
    <div class="mode">${later ? 'AMBIL NANTI' : 'SERAHKAN SEKARANG'}</div>
    ${later ? `<div class="c k">NOMOR AMBIL</div><div class="code">${esc(order.pickupCode || order.orderNumber)}</div>` : ''}
    <div class="grid">
      <div><span class="k">ORDER</span><span class="v">${esc(order.orderNumber)}</span></div>
      <div><span class="k">WAKTU</span><span class="v">${date} ${time}</span></div>
      <div><span class="k">ATAS NAMA</span><span class="v">${esc(name || '-')}</span></div>
      <div><span class="k">JUMLAH</span><span class="v">${pcs} PCS</span></div>
      <div><span class="k">KASIR</span><span class="v">${esc(cashierName || '-')}</span></div>
      <div><span class="k">EVENT</span><span class="v">${esc(event?.name || '-')}</span></div>
    </div>
    ${swapOf ? `<div class="k" style="margin-bottom:2px">TUKAR DARI ${esc(swapOf)} &middot; BARANG KEMBALI MASUK STOK</div>${backItems}<div style="height:8px"></div>` : ''}
    ${sold.length ? `<div class="k">BARANG &middot; ${pcs} PCS</div>${items}` : ''}
    <div class="sum">${refund ? `<span>UANG DIKEMBALIKAN &middot; TUNAI</span><span>${rp(refund)}</span>` : `<span>LUNAS &middot; ${esc(paid)}</span><span>${rp(order.total)}</span>`}</div>
    <div class="sign"><div>Disiapkan</div><div>Diserahkan</div></div>
    <div class="bc">${code39Svg(order.orderNumber, 34)}</div>
  </body></html>`
}

// Gabungkan beberapa dokumen struk jadi satu job print (tiap dokumen = 1 halaman / 1 potongan kertas).
function combine(docs, w) {
  const parts = docs.map((html, i) => {
    const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || ''
    const body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/) || [])[1] || ''
    // CSS tiap dokumen di-scope ke <section> miliknya (CSS nesting); aturan body pindah ke section
    const scoped = css.replace(/@page\s*{[^}]*}/g, '').replace(/(^|[\s}])body\s*{/g, '$1& {')
    return { style: `.doc-${i} { ${scoped} }`, html: `<section class="doc doc-${i}">${body}</section>` }
  })
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${w}mm auto; margin: 0; } body { margin: 0; }
    .doc + .doc { break-before: page; }
    ${parts.map(p => p.style).join('\n')}
  </style></head><body>${parts.map(p => p.html).join('')}</body></html>`
}

// ── Rekap kasir: 1 lembar per shift untuk serah terima uang laci ─────────────
// summary dari server (shiftSummary); countedCash/closedAt kosong = rekap sementara (shift masih buka).
export function shiftRecapHtml(shift, summary, { event, settings, cashierName, countedCash, closedAt } = {}) {
  const s = { ...DEFAULT_RECEIPT, ...(settings || {}) }
  const w = Number(s.widthMm) || 80, f = Number(s.fontPx) || 12
  const dt = (v) => v ? new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'
  const final = countedCash != null
  const diff = final ? countedCash - summary.expectedCash : null
  const row = (l, v, strong) => `<div class="row${strong ? ' b' : ''}"><span>${l}</span><span>${v}</span></div>`
  const methods = Object.entries(summary.byMethod || {}).filter(([, v]) => v).map(([k, v]) => row(METHOD[k] || esc(k), rp(v))).join('') || row('Belum ada pembayaran', '-')
  return `<!doctype html><html><head><meta charset="utf-8"><style>${pageCss(w, f, '"Helvetica Neue", Helvetica, Arial, sans-serif')}
    body { padding: 4mm 4mm 7mm; }
    .copy { display: flex; justify-content: space-between; font-size: ${f - 3}px; font-weight: 800; letter-spacing: .25em; border-bottom: 2px solid #000; padding-bottom: 3px; }
    .mode { margin: 8px 0 6px; padding: 6px; text-align: center; font-size: ${f + 4}px; font-weight: 800; letter-spacing: .1em;
            ${final ? 'background:#000;color:#fff;' : 'border:2px dashed #000;'} }
    .k { font-size: ${f - 3}px; font-weight: 800; letter-spacing: .2em; margin-top: 8px; border-bottom: 1px solid #000; padding-bottom: 2px; }
    .row { padding: 1px 0; } .b { font-weight: 800; }
    .big { font-size: ${f + 4}px; font-weight: 800; border-top: 2px solid #000; margin-top: 4px; padding-top: 3px; }
    .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 26px; font-size: ${f - 3}px; text-align: center; }
    .sign div { border-top: 1px solid #000; padding-top: 2px; }
  </style></head><body>
    <div class="copy"><span>REKAP KASIR</span><span>SHIFT #${esc(shift.id)}</span></div>
    <div class="mode">${final ? 'TUTUP SHIFT' : 'REKAP SEMENTARA'}</div>
    ${row('Event', esc(event?.name || '-'))}
    ${row('Laptop', esc(shift.deviceName || '-'))}
    ${row('Kasir', esc(cashierName || '-'))}
    ${row('Dibuka', dt(shift.openedAt))}
    ${row(final ? 'Ditutup' : 'Dicetak', dt(closedAt || new Date()))}
    <div class="k">PENJUALAN</div>
    ${row('Transaksi', `${summary.orderCount}${summary.laterCount ? ` (${summary.laterCount} ambil nanti)` : ''}`)}
    ${row('Barang terjual', `${summary.pcs ?? '-'} pcs`)}
    ${summary.discount ? row('Diskon diberikan', `-${rp(summary.discount)}`) : ''}
    ${row('Total penjualan', rp(summary.total), true)}
    ${summary.voidCount ? row(`Dibatalkan (${summary.voidCount})`, rp(summary.voidTotal)) : ''}
    <div class="k">METODE BAYAR</div>
    ${methods}
    <div class="k">KAS TUNAI DI LACI</div>
    ${row('Modal awal', rp(shift.openingCash))}
    ${row('Tunai masuk (bersih)', rp(summary.byMethod?.CASH || 0))}
    <div class="row big"><span>Seharusnya</span><span>${rp(summary.expectedCash)}</span></div>
    ${final ? row('Dihitung', rp(countedCash), true) + row('Selisih', diff ? `${diff > 0 ? '+' : '-'}${rp(Math.abs(diff))}` : 'Rp0 (pas)', true) : row('Dihitung', '..................')}
    <div class="sign"><div>Kasir</div><div>Supervisor</div></div>
  </body></html>`
}

// Beberapa dokumen dalam satu kali print (tiap dokumen = 1 lembar)
export const combinePrint = (docs, settings) => combine(docs, Number({ ...DEFAULT_RECEIPT, ...(settings || {}) }.widthMm) || 80)

export function staffSlipHtml(order, opts) {
  return slip(order, { ...opts, settings: { ...DEFAULT_RECEIPT, ...(opts.settings || {}) } })
}

// Struk pelanggan + slip staff dalam satu kali print (printer sama, keluar 2 lembar).
export function orderPrintHtml(order, opts, { customer = true, staff = true } = {}) {
  const settings = { ...DEFAULT_RECEIPT, ...(opts.settings || {}) }
  const docs = [customer && receiptHtml(order, opts), staff && staffSlipHtml(order, opts)].filter(Boolean)
  return docs.length === 1 ? docs[0] : combine(docs, Number(settings.widthMm) || 80)
}

export function receiptHtml(order, opts) {
  const settings = { ...DEFAULT_RECEIPT, ...(opts.settings || {}) }
  return (settings.style === 'street' ? street : minimal)(order, { ...opts, settings })
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
