// Batas beli per orang — dipakai kasir untuk mencegah lebih dari batas di keranjang.

export const isLimited = (limit, productId) => !!limit?.qty && (!limit.productIds?.length || limit.productIds.includes(productId))

// Pcs per artikel yang kena batas di keranjang
export function limitedNet(limit, cart) {
  const net = {}
  for (const l of cart) if (isLimited(limit, l.productId)) net[l.productId] = (net[l.productId] || 0) + l.qty
  return net
}
