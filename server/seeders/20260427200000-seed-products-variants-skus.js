'use strict';

// Cartesian product of multiple arrays
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

// Product definitions: name → { categoryName, articleName, price, variants, stock }
const PRODUCTS = [
  {
    name: 'Classic Oxford Shirt',
    unit: 'pcs', category: 'Tops', article: 'Kemeja', price: 185000,
    variants: [
      { name: 'Warna',  options: ['White', 'Blue', 'Navy'] },
      { name: 'Ukuran', options: ['S', 'M', 'L', 'XL'] },
    ],
    stockMain: 280, stockSec: 195,
  },
  {
    name: 'Crew Neck T-Shirt',
    unit: 'pcs', category: 'Tops', article: 'Kemeja', price: 95000,
    variants: [
      { name: 'Warna',  options: ['Black', 'Sand', 'White', 'Grey'] },
      { name: 'Ukuran', options: ['S', 'M', 'L', 'XL'] },
    ],
    stockMain: 340, stockSec: 230,
  },
  {
    name: 'Slim Fit Chinos',
    unit: 'pcs', category: 'Bottoms', article: 'Celana', price: 225000,
    variants: [
      { name: 'Warna',  options: ['Khaki', 'Black', 'Navy'] },
      { name: 'Ukuran', options: ['30', '32', '34'] },
    ],
    stockMain: 175, stockSec: 115,
  },
  {
    name: 'Denim Jeans',
    unit: 'pcs', category: 'Bottoms', article: 'Celana', price: 275000,
    variants: [
      { name: 'Warna',  options: ['Indigo', 'Black', 'Blue'] },
      { name: 'Ukuran', options: ['30', '32', '34'] },
    ],
    stockMain: 145, stockSec: 100,
  },
  {
    name: 'Lightweight Bomber Jacket',
    unit: 'pcs', category: 'Outerwear', article: 'Jaket', price: 375000,
    variants: [
      { name: 'Warna',  options: ['Olive', 'Black', 'Navy'] },
      { name: 'Ukuran', options: ['S', 'M', 'L'] },
    ],
    stockMain: 105, stockSec: 75,
  },
  {
    name: 'Canvas Tote Bag',
    unit: 'pcs', category: 'Accessories', article: 'Aksesoris', price: 145000,
    variants: [
      { name: 'Warna', options: ['Natural', 'Black', 'Cream'] },
    ],
    stockMain: 165, stockSec: 90,
  },
  {
    name: 'Beanie Knit',
    unit: 'pcs', category: 'Accessories', article: 'Aksesoris', price: 85000,
    variants: [
      { name: 'Warna', options: ['Black', 'Grey', 'Navy', 'Red'] },
    ],
    stockMain: 200, stockSec: 130,
  },
  {
    name: 'Leather Belt',
    unit: 'pcs', category: 'Accessories', article: 'Aksesoris', price: 125000,
    variants: [
      { name: 'Ukuran', options: ['S', 'M', 'L'] },
    ],
    stockMain: 115, stockSec: 70,
  },
]

// Fixed qty per SKU (indexed: productIndex × comboIndex → qty)
// Realistic spread: main colors/sizes sell more
const QTY_MATRIX = {
  'Classic Oxford Shirt': [30,38,42,35, 25,32,38,28, 20,28,33,22],      // 12 SKUs
  'Crew Neck T-Shirt':    [32,40,44,36, 24,30,36,26, 28,36,42,32, 20,26,30,20], // 16 SKUs
  'Slim Fit Chinos':      [22,28,20, 18,24,16, 15,20,12],               // 9 SKUs
  'Denim Jeans':          [18,24,18, 14,20,14, 12,16,10],               // 9 SKUs
  'Lightweight Bomber Jacket': [14,18,12, 12,16,10, 10,14,8],           // 9 SKUs
  'Canvas Tote Bag':      [60, 50, 45],                                  // 3 SKUs
  'Beanie Knit':          [55, 45, 50, 38],                              // 4 SKUs
  'Leather Belt':         [42, 50, 38],                                  // 3 SKUs
}

module.exports = {
  async up(queryInterface) {
    const db  = queryInterface.sequelize
    const run = (sql) => db.query(sql)
    const sel = (sql) => db.query(sql).then(([rows]) => rows)

    // ── Get demo company ────────────────────────────────────────────────────────
    const coRows = await sel(`SELECT id FROM "Companies" WHERE slug = 'preface-demo' LIMIT 1`)
    if (!coRows.length) throw new Error('Run 20260423000002 seeder first (demo company missing)')
    const cid = coRows[0].id

    // ── Clean all product-related data ──────────────────────────────────────────
    await run(`DELETE FROM "ProductSKUVariantOptions"`)
    await run(`DELETE FROM "ProductSKUs"`)
    await run(`DELETE FROM "ProductVariantOptions"`)
    await run(`DELETE FROM "ProductVariantTypes"`)
    await run(`DELETE FROM "Stock_Movements" WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Stocks"          WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Products"        WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Articles"`)

    // ── Get lookups ─────────────────────────────────────────────────────────────
    const cats = await sel(`SELECT id, name FROM "Categories" WHERE "companyId" = ${cid}`)
    const cat  = Object.fromEntries(cats.map(c => [c.name, c.id]))

    const whs    = await sel(`SELECT id, name FROM "Warehouses" WHERE "companyId" = ${cid}`)
    const mainWh = whs.find(w => w.name.includes('Main'))?.id
    const secWh  = whs.find(w => w.name.includes('Secondary'))?.id

    // ── Articles ────────────────────────────────────────────────────────────────
    const artRows = await sel(`
      INSERT INTO "Articles" (name, "companyId", "createdAt", "updatedAt") VALUES
        ('Kemeja',    ${cid}, NOW(), NOW()),
        ('Celana',    ${cid}, NOW(), NOW()),
        ('Jaket',     ${cid}, NOW(), NOW()),
        ('Aksesoris', ${cid}, NOW(), NOW())
      RETURNING id, name
    `)
    const art = Object.fromEntries(artRows.map(a => [a.name, a.id]))

    // ── Products ────────────────────────────────────────────────────────────────
    const prodValues = PRODUCTS.map(p =>
      `('${p.name}', '${p.unit}', ${cat[p.category]}, ${art[p.article]}, ${cid}, NOW(), NOW())`
    ).join(',\n      ')

    const prodRows = await sel(`
      INSERT INTO "Products" (name, unit, "CategoryId", "ArticleId", "companyId", "createdAt", "updatedAt")
      VALUES ${prodValues}
      RETURNING id, name
    `)
    const prodId = Object.fromEntries(prodRows.map(p => [p.name, p.id]))

    // ── Variants, SKUs, stock per product ───────────────────────────────────────
    const usedCodes = new Set()

    for (const p of PRODUCTS) {
      const pid = prodId[p.name]

      // Create variant types and collect option IDs
      const typeGroups = []   // [{ typeName, options: [{id, value}] }]

      for (const vt of p.variants) {
        const [typeRow] = await sel(`
          INSERT INTO "ProductVariantTypes" ("ProductId", name, "createdAt", "updatedAt")
          VALUES (${pid}, '${vt.name}', NOW(), NOW())
          RETURNING id
        `)
        const typeId = typeRow.id

        const optRows = await sel(`
          INSERT INTO "ProductVariantOptions" ("ProductVariantTypeId", value, "createdAt", "updatedAt")
          VALUES ${vt.options.map(o => `(${typeId}, '${o}', NOW(), NOW())`).join(', ')}
          RETURNING id, value
        `)
        typeGroups.push({ typeName: vt.name, options: optRows })
      }

      // Cartesian product → SKU combos
      const optionSets  = typeGroups.map(tg => tg.options)  // [[{id,value}], ...]
      const combos      = cartesian(optionSets)              // [[{id,value}, ...], ...]
      const qtyList     = QTY_MATRIX[p.name] ?? []

      for (let i = 0; i < combos.length; i++) {
        const combo     = combos[i]
        const optValues = combo.map(o => o.value)

        // Unique SKU code
        let code = skuCode(p.name, optValues)
        let attempt = 0
        while (usedCodes.has(code)) { code = `${skuCode(p.name, optValues)}-${++attempt}` }
        usedCodes.add(code)

        const qty = qtyList[i] ?? 20

        const [skuRow] = await sel(`
          INSERT INTO "ProductSKUs" ("ProductId", sku_code, price, qty, "companyId", "createdAt", "updatedAt")
          VALUES (${pid}, '${code}', ${p.price}, ${qty}, ${cid}, NOW(), NOW())
          RETURNING id
        `)
        const skuId = skuRow.id

        // Link SKU → variant options
        const linkValues = combo.map(o => `(${skuId}, ${o.id}, NOW(), NOW())`).join(', ')
        await run(`
          INSERT INTO "ProductSKUVariantOptions" ("ProductSKUId", "ProductVariantOptionId", "createdAt", "updatedAt")
          VALUES ${linkValues}
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

    // ── Stock movements (sample) ────────────────────────────────────────────────
    const MOVEMENTS = [
      { product: 'Classic Oxford Shirt',       wh: mainWh, type: 'IN',         qty: 60,  note: 'Inbound batch A' },
      { product: 'Crew Neck T-Shirt',          wh: mainWh, type: 'IN',         qty: 80,  note: 'Inbound batch A' },
      { product: 'Slim Fit Chinos',            wh: mainWh, type: 'OUT',        qty: 20,  note: 'Outbound ke toko' },
      { product: 'Denim Jeans',                wh: secWh,  type: 'IN',         qty: 30,  note: 'Inbound batch B' },
      { product: 'Lightweight Bomber Jacket',  wh: secWh,  type: 'OUT',        qty: 10,  note: 'Outbound pop-up' },
      { product: 'Canvas Tote Bag',            wh: mainWh, type: 'IN',         qty: 40,  note: 'Inbound batch C' },
      { product: 'Beanie Knit',                wh: mainWh, type: 'OUT',        qty: 25,  note: 'Outbound ke toko' },
      { product: 'Leather Belt',               wh: secWh,  type: 'ADJUSTMENT', qty: 5,   note: 'Koreksi stok opname' },
      { product: 'Classic Oxford Shirt',       wh: secWh,  type: 'IN',         qty: 35,  note: 'Inbound batch B' },
      { product: 'Crew Neck T-Shirt',          wh: secWh,  type: 'OUT',        qty: 15,  note: 'Outbound ke reseller' },
    ]

    for (const m of MOVEMENTS) {
      const pid = prodId[m.product]
      await run(`
        INSERT INTO "Stock_Movements" ("ProductId", "WarehouseId", type, quantity, note, "companyId", "createdAt", "updatedAt")
        VALUES (${pid}, ${m.wh}, '${m.type}', ${m.qty}, '${m.note}', ${cid}, NOW(), NOW())
      `)
    }
  },

  async down(queryInterface) {
    const db  = queryInterface.sequelize
    const run = (sql) => db.query(sql)
    const sel = (sql) => db.query(sql).then(([rows]) => rows)

    const coRows = await sel(`SELECT id FROM "Companies" WHERE slug = 'preface-demo' LIMIT 1`)
    const cid    = coRows[0]?.id

    await run(`DELETE FROM "ProductSKUVariantOptions"`)
    await run(`DELETE FROM "ProductSKUs"`)
    await run(`DELETE FROM "ProductVariantOptions"`)
    await run(`DELETE FROM "ProductVariantTypes"`)
    if (cid) {
      await run(`DELETE FROM "Stock_Movements" WHERE "companyId" = ${cid}`)
      await run(`DELETE FROM "Stocks"          WHERE "companyId" = ${cid}`)
      await run(`DELETE FROM "Products"        WHERE "companyId" = ${cid}`)
    }
    await run(`DELETE FROM "Articles"`)
  },
}
