// Batas beli per orang — dipakai kasir untuk mencegah lebih dari batas di keranjang.
// limit.per: 'SKU' = dihitung per size, selain itu per artikel (semua size digabung).

export const isLimited = (limit, productId) => !!limit?.qty && (!limit.productIds?.length || limit.productIds.includes(productId))

export const limitKey = (limit, productId, skuId) => limit?.per === 'SKU' ? skuId : productId

// Pcs per artikel / per SKU yang kena batas di keranjang
export function limitedNet(limit, cart) {
  const net = {}
  for (const l of cart) {
    if (!isLimited(limit, l.productId)) continue
    const k = limitKey(limit, l.productId, l.skuId)
    net[k] = (net[k] || 0) + l.qty
  }
  return net
}
