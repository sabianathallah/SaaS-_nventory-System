// Tukar barang & batas beli — dipakai kasir, rumusnya sama dengan server (posController.returnCredits)
// supaya transaksi tukar yang dibuat offline tetap cocok saat dikirim.

// Nilai kembali per pcs tiap SKU = harga setelah diskon item & bagian diskon transaksi asal.
export function returnCredits(order) {
  const sold = (order.items || []).filter(i => i.qty > 0)
  const lineNet = (i) => i.qty * i.unitPrice - (i.discount || 0)
  const base = sold.reduce((s, i) => s + lineNet(i), 0)
  const od = order.orderDiscount || 0
  const out = {}
  for (const i of sold) {
    if (out[i.ProductSKUId]) continue
    const net = lineNet(i) - (base ? Math.round(od * lineNet(i) / base) : 0)
    out[i.ProductSKUId] = { credit: Math.round(net / i.qty), qty: i.qty }
  }
  return out
}

// Pcs per SKU yang sudah dikembalikan dari transaksi asal oleh transaksi tukar di laptop ini
export function returnedLocally(orders, origClientId) {
  const out = {}
  for (const o of orders) {
    if (o.exchangeOfClientId !== origClientId) continue
    for (const i of o.items) if (i.qty < 0) out[i.ProductSKUId] = (out[i.ProductSKUId] || 0) - i.qty
  }
  return out
}

export const isLimited = (limit, productId) => !!limit?.qty && (!limit.productIds?.length || limit.productIds.includes(productId))

// Pcs bersih per artikel yang kena batas: barang baru - barang yang dikembalikan
export function limitedNet(limit, cart, returns = []) {
  const net = {}
  for (const l of cart) if (isLimited(limit, l.productId)) net[l.productId] = (net[l.productId] || 0) + l.qty
  for (const r of returns) if (isLimited(limit, r.productId)) net[r.productId] = (net[r.productId] || 0) - r.qty
  return net
}
