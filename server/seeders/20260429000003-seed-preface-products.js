'use strict';

function cartesian(arrays) {
  if (!arrays.length) return [[]]
  return arrays.reduce(
    (acc, curr) => acc.flatMap(a => curr.map(b => [...a, b])),
    [[]]
  )
}

function skuCode(productName, opts) {
  const base = productName
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .map(w => w.substring(0, 3).toUpperCase())
    .join('')
  if (!opts.length) return `${base}-${Date.now().toString(36).toUpperCase()}`
  return `${base}-${opts.map(o => o.replace(/\s+/g, '').substring(0, 3).toUpperCase()).join('-')}`
}

// ── Categories & Articles ─────────────────────────────────────────────────────
const CATEGORIES = ['Hoodie', 'Kaos', 'Outerwear', 'Knitwear', 'Aksesoris']
const ARTICLES   = ['Hoodie', 'Zip Hoodie', 'T-Shirt', 'Polo', 'Jaket', 'Knit', 'Bag']

// ── Products ──────────────────────────────────────────────────────────────────
// Real products from prefacewearhouse.com + known Preface collections
const PRODUCTS = [
  // ── Hoodie ────────────────────────────────────────────────────────────────
  {
    name: 'Reptile Starlined Hoodie',
    unit: 'pcs', category: 'Hoodie', article: 'Hoodie', price: 499000,
    variants: [
      { name: 'Warna',  options: ['Black', 'Pink'] },
      { name: 'Ukuran', options: ['S', 'M', 'L', 'XL'] },
    ],
    // per-SKU qty (Black row first, Pink row second)
    qty: [20, 28, 25, 15,  12, 18, 16, 10],
    stockMain: 180, stockSec: 120,
  },
  {
    name: 'BORN2WEAR Zip Hoodie',
    unit: 'pcs', category: 'Hoodie', article: 'Zip Hoodie', price: 579000,
    variants: [
      { name: 'Warna',  options: ['Black', 'White'] },
      { name: 'Ukuran', options: ['S', 'M', 'L', 'XL'] },
    ],
    qty: [18, 26, 24, 14,  14, 20, 18, 12],
    stockMain: 150, stockSec: 100,
  },
  {
    name: 'Aswad Zip Hoodie',
    unit: 'pcs', category: 'Hoodie', article: 'Zip Hoodie', price: 579000,
    variants: [
      { name: 'Warna',  options: ['Black', 'Olive'] },
      { name: 'Ukuran', options: ['S', 'M', 'L', 'XL'] },
    ],
    qty: [16, 22, 20, 12,  10, 16, 14, 10],
    stockMain: 120, stockSec: 80,
  },
  {
    name: 'Unfinished Zip Hoodie',
    unit: 'pcs', category: 'Hoodie', article: 'Zip Hoodie', price: 549000,
    variants: [
      { name: 'Warna',  options: ['Misty', 'Camo'] },
      { name: 'Ukuran', options: ['S', 'M', 'L', 'XL'] },
    ],
    qty: [18, 26, 24, 16,  14, 20, 18, 12],
    stockMain: 160, stockSec: 90,
  },
  {
    name: 'Club de Preface Hoodie',
    unit: 'pcs', category: 'Hoodie', article: 'Hoodie', price: 529000,
    variants: [
      { name: 'Warna',  options: ['Black', 'Grey', 'Cream'] },
      { name: 'Ukuran', options: ['S', 'M', 'L', 'XL'] },
    ],
    qty: [18, 26, 24, 14,  14, 20, 18, 12,  10, 16, 14, 10],
    stockMain: 200, stockSec: 130,
  },

  // ── Kaos ──────────────────────────────────────────────────────────────────
  {
    name: 'PREFACE Plus Mark Polo',
    unit: 'pcs', category: 'Kaos', article: 'Polo', price: 349000,
    variants: [
      { name: 'Warna',  options: ['Brown', 'Black', 'White'] },
      { name: 'Ukuran', options: ['S', 'M', 'L', 'XL'] },
    ],
    qty: [20, 30, 28, 18,  16, 26, 24, 14,  14, 22, 20, 12],
    stockMain: 220, stockSec: 140,
  },
  {
    name: 'PREFACE Realtree T-Shirt',
    unit: 'pcs', category: 'Kaos', article: 'T-Shirt', price: 249000,
    variants: [
      { name: 'Warna',  options: ['Black', 'Cream'] },
      { name: 'Ukuran', options: ['S', 'M', 'L', 'XL'] },
    ],
    qty: [28, 40, 36, 22,  22, 32, 28, 18],
    stockMain: 250, stockSec: 180,
  },
  {
    name: 'Daydream T-Shirt',
    unit: 'pcs', category: 'Kaos', article: 'T-Shirt', price: 249000,
    variants: [
      { name: 'Warna',  options: ['White', 'Sand', 'Black'] },
      { name: 'Ukuran', options: ['S', 'M', 'L', 'XL'] },
    ],
    qty: [24, 34, 30, 18,  20, 28, 26, 16,  22, 32, 28, 18],
    stockMain: 280, stockSec: 190,
  },
  {
    name: 'Oasis T-Shirt',
    unit: 'pcs', category: 'Kaos', article: 'T-Shirt', price: 269000,
    variants: [
      { name: 'Warna',  options: ['White', 'Sand', 'Dusty Blue'] },
      { name: 'Ukuran', options: ['S', 'M', 'L', 'XL'] },
    ],
    qty: [22, 32, 28, 16,  18, 26, 24, 14,  16, 24, 20, 12],
    stockMain: 240, stockSec: 160,
  },
  {
    name: 'Raya Polo',
    unit: 'pcs', category: 'Kaos', article: 'Polo', price: 379000,
    variants: [
      { name: 'Warna',  options: ['White', 'Navy', 'Brown'] },
      { name: 'Ukuran', options: ['S', 'M', 'L', 'XL'] },
    ],
    qty: [16, 24, 22, 14,  14, 20, 18, 12,  12, 18, 16, 10],
    stockMain: 180, stockSec: 110,
  },

  // ── Outerwear ─────────────────────────────────────────────────────────────
  {
    name: 'Racing Jacket',
    unit: 'pcs', category: 'Outerwear', article: 'Jaket', price: 699000,
    variants: [
      { name: 'Warna',  options: ['Black', 'Navy'] },
      { name: 'Ukuran', options: ['S', 'M', 'L', 'XL'] },
    ],
    qty: [10, 16, 14, 8,  8, 12, 11, 6],
    stockMain: 90, stockSec: 60,
  },

  // ── Knitwear ──────────────────────────────────────────────────────────────
  {
    name: 'PRFC Chenille Knit',
    unit: 'pcs', category: 'Knitwear', article: 'Knit', price: 429000,
    variants: [
      { name: 'Warna',  options: ['Black', 'Cream', 'Grey'] },
      { name: 'Ukuran', options: ['S', 'M', 'L'] },
    ],
    qty: [14, 20, 16,  12, 16, 14,  10, 14, 12],
    stockMain: 100, stockSec: 65,
  },

  // ── Aksesoris ─────────────────────────────────────────────────────────────
  {
    name: 'PRFC Loop Crossbody Bag',
    unit: 'pcs', category: 'Aksesoris', article: 'Bag', price: 299000,
    variants: [
      { name: 'Warna', options: ['Black', 'Brown', 'Cream'] },
    ],
    qty: [32, 26, 22],
    stockMain: 80, stockSec: 50,
  },
]

module.exports = {
  async up(queryInterface) {
    const db  = queryInterface.sequelize
    const run = (sql) => db.query(sql)
    const sel = (sql) => db.query(sql).then(([rows]) => rows)

    // ── Demo company ────────────────────────────────────────────────────────
    const coRows = await sel(`SELECT id FROM "Companies" WHERE slug = 'preface-demo' LIMIT 1`)
    if (!coRows.length) throw new Error('Demo company missing — run seeder 20260423000002 first')
    const cid = coRows[0].id

    // ── Warehouses ──────────────────────────────────────────────────────────
    const whs    = await sel(`SELECT id, name FROM "Warehouses" WHERE "companyId" = ${cid}`)
    const mainWh = whs.find(w => w.name.toLowerCase().includes('main'))?.id
    const secWh  = whs.find(w => w.name.toLowerCase().includes('secondary') || w.name.toLowerCase().includes('sec'))?.id

    // ── Clean product-related data ──────────────────────────────────────────
    await run(`DELETE FROM "ProductSKUVariantOptions"`)
    await run(`DELETE FROM "ProductSKUs"`)
    await run(`DELETE FROM "ProductVariantOptions"`)
    await run(`DELETE FROM "ProductVariantTypes"`)
    await run(`DELETE FROM "Stock_Movements" WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Stocks"          WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Products"        WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Articles"        WHERE "companyId" = ${cid}`)

    // Delete & recreate categories for this company (Preface-specific)
    await run(`DELETE FROM "Categories" WHERE "companyId" = ${cid}`)
    const catRows = await sel(`
      INSERT INTO "Categories" (name, "companyId", "createdAt", "updatedAt") VALUES
        ${CATEGORIES.map(c => `('${c}', ${cid}, NOW(), NOW())`).join(',\n        ')}
      RETURNING id, name
    `)
    const cat = Object.fromEntries(catRows.map(c => [c.name, c.id]))

    // ── Articles ────────────────────────────────────────────────────────────
    const artRows = await sel(`
      INSERT INTO "Articles" (name, "companyId", "createdAt", "updatedAt") VALUES
        ${ARTICLES.map(a => `('${a}', ${cid}, NOW(), NOW())`).join(',\n        ')}
      RETURNING id, name
    `)
    const art = Object.fromEntries(artRows.map(a => [a.name, a.id]))

    // ── Products + Variants + SKUs + Stocks ─────────────────────────────────
    const usedCodes = new Set()

    for (const p of PRODUCTS) {
      const catId = cat[p.category]
      const artId = art[p.article]
      if (!catId) throw new Error(`Category not found: ${p.category}`)
      if (!artId) throw new Error(`Article not found: ${p.article}`)

      // Insert product
      const [prodRow] = await sel(`
        INSERT INTO "Products" (name, unit, "CategoryId", "ArticleId", "companyId", "createdAt", "updatedAt")
        VALUES ('${p.name.replace(/'/g, "''")}', '${p.unit}', ${catId}, ${artId}, ${cid}, NOW(), NOW())
        RETURNING id
      `)
      const pid = prodRow.id

      // Variant types + options
      const typeGroups = []
      for (const vt of p.variants) {
        const [typeRow] = await sel(`
          INSERT INTO "ProductVariantTypes" ("ProductId", name, "createdAt", "updatedAt")
          VALUES (${pid}, '${vt.name}', NOW(), NOW())
          RETURNING id
        `)
        const optRows = await sel(`
          INSERT INTO "ProductVariantOptions" ("ProductVariantTypeId", value, "createdAt", "updatedAt")
          VALUES ${vt.options.map(o => `(${typeRow.id}, '${o}', NOW(), NOW())`).join(', ')}
          RETURNING id, value
        `)
        typeGroups.push({ options: optRows })
      }

      // SKUs
      const combos  = cartesian(typeGroups.map(tg => tg.options))
      const qtyList = p.qty ?? []

      for (let i = 0; i < combos.length; i++) {
        const combo     = combos[i]
        const optValues = combo.map(o => o.value)

        let code = skuCode(p.name, optValues)
        let n = 0
        while (usedCodes.has(code)) code = `${skuCode(p.name, optValues)}-${++n}`
        usedCodes.add(code)

        const qty = qtyList[i] ?? 15

        const [skuRow] = await sel(`
          INSERT INTO "ProductSKUs" ("ProductId", sku_code, price, qty, "companyId", "createdAt", "updatedAt")
          VALUES (${pid}, '${code}', ${p.price}, ${qty}, ${cid}, NOW(), NOW())
          RETURNING id
        `)

        await run(`
          INSERT INTO "ProductSKUVariantOptions" ("ProductSKUId", "ProductVariantOptionId", "createdAt", "updatedAt")
          VALUES ${combo.map(o => `(${skuRow.id}, ${o.id}, NOW(), NOW())`).join(', ')}
        `)
      }

      // Warehouse stocks
      if (mainWh) await run(`
        INSERT INTO "Stocks" ("ProductId", "WarehouseId", quantity, "companyId", "createdAt", "updatedAt")
        VALUES (${pid}, ${mainWh}, ${p.stockMain}, ${cid}, NOW(), NOW())
      `)
      if (secWh) await run(`
        INSERT INTO "Stocks" ("ProductId", "WarehouseId", quantity, "companyId", "createdAt", "updatedAt")
        VALUES (${pid}, ${secWh}, ${p.stockSec}, ${cid}, NOW(), NOW())
      `)
    }

    // ── Sample stock movements ───────────────────────────────────────────────
    const prodIds = await sel(`SELECT id, name FROM "Products" WHERE "companyId" = ${cid}`)
    const pid = Object.fromEntries(prodIds.map(p => [p.name, p.id]))

    const MOVEMENTS = [
      { product: 'BORN2WEAR Zip Hoodie',      wh: mainWh, type: 'IN',         qty: 60,  note: 'Inbound batch A' },
      { product: 'Club de Preface Hoodie',     wh: mainWh, type: 'IN',         qty: 80,  note: 'Inbound batch A' },
      { product: 'Oasis T-Shirt',              wh: mainWh, type: 'OUT',        qty: 30,  note: 'Outbound ke toko Bandung' },
      { product: 'Racing Jacket',              wh: secWh,  type: 'IN',         qty: 25,  note: 'Inbound batch B' },
      { product: 'Daydream T-Shirt',           wh: secWh,  type: 'OUT',        qty: 20,  note: 'Outbound pop-up event' },
      { product: 'PRFC Loop Crossbody Bag',    wh: mainWh, type: 'IN',         qty: 30,  note: 'Inbound batch C' },
      { product: 'Reptile Starlined Hoodie',   wh: mainWh, type: 'OUT',        qty: 15,  note: 'Outbound ke reseller' },
      { product: 'PRFC Chenille Knit',         wh: secWh,  type: 'ADJUSTMENT', qty: 5,   note: 'Koreksi stok opname' },
      { product: 'Raya Polo',                  wh: mainWh, type: 'IN',         qty: 50,  note: 'Inbound Raya batch' },
      { product: 'PREFACE Realtree T-Shirt',   wh: secWh,  type: 'OUT',        qty: 25,  note: 'Outbound ke toko Jakarta' },
      { product: 'Unfinished Zip Hoodie',      wh: mainWh, type: 'IN',         qty: 40,  note: 'Inbound batch D' },
      { product: 'PREFACE Plus Mark Polo',     wh: secWh,  type: 'IN',         qty: 35,  note: 'Inbound batch B' },
    ]

    for (const m of MOVEMENTS) {
      if (!pid[m.product] || !m.wh) continue
      await run(`
        INSERT INTO "Stock_Movements" ("ProductId", "WarehouseId", type, quantity, note, "companyId", "createdAt", "updatedAt")
        VALUES (${pid[m.product]}, ${m.wh}, '${m.type}', ${m.qty}, '${m.note}', ${cid}, NOW(), NOW())
      `)
    }
  },

  async down(queryInterface) {
    const db  = queryInterface.sequelize
    const run = (sql) => db.query(sql)
    const sel = (sql) => db.query(sql).then(([rows]) => rows)

    const coRows = await sel(`SELECT id FROM "Companies" WHERE slug = 'preface-demo' LIMIT 1`)
    const cid    = coRows[0]?.id
    if (!cid) return

    await run(`DELETE FROM "ProductSKUVariantOptions"`)
    await run(`DELETE FROM "ProductSKUs"`)
    await run(`DELETE FROM "ProductVariantOptions"`)
    await run(`DELETE FROM "ProductVariantTypes"`)
    await run(`DELETE FROM "Stock_Movements" WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Stocks"          WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Products"        WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Articles"        WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Categories"      WHERE "companyId" = ${cid}`)
  },
}
