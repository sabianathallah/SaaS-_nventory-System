'use strict';
const { hashPassword } = require('../helpers/bcrypt');

// Subset of Preface products for Demo 2 — different stock to make data clearly distinct
function cartesian(arrays) {
  if (!arrays.length) return [[]]
  return arrays.reduce((acc, curr) => acc.flatMap(a => curr.map(b => [...a, b])), [[]])
}
function skuCode(name, opts) {
  const base = name.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/).map(w => w.substring(0, 3).toUpperCase()).join('')
  if (!opts.length) return `D2-${base}-${Date.now().toString(36).toUpperCase()}`
  return `D2-${base}-${opts.map(o => o.replace(/\s+/g, '').substring(0, 3).toUpperCase()).join('-')}`
}

const CATEGORIES = ['Hoodie', 'Kaos', 'Outerwear', 'Knitwear', 'Aksesoris']
const ARTICLES   = ['Hoodie', 'Zip Hoodie', 'T-Shirt', 'Polo', 'Jaket', 'Knit', 'Bag']

const PRODUCTS = [
  {
    name: 'Club de Preface Hoodie',
    unit: 'pcs', category: 'Hoodie', article: 'Hoodie', price: 529000,
    variants: [
      { name: 'Warna',  options: ['Black', 'Cream'] },
      { name: 'Ukuran', options: ['S', 'M', 'L', 'XL'] },
    ],
    qty: [10, 15, 12, 8,  8, 12, 10, 6],
    stockMain: 85, stockSec: 50,
  },
  {
    name: 'Reptile Starlined Hoodie',
    unit: 'pcs', category: 'Hoodie', article: 'Hoodie', price: 499000,
    variants: [
      { name: 'Warna',  options: ['Black', 'Pink'] },
      { name: 'Ukuran', options: ['S', 'M', 'L', 'XL'] },
    ],
    qty: [8, 12, 10, 6,  6, 9, 8, 5],
    stockMain: 65, stockSec: 40,
  },
  {
    name: 'Oasis T-Shirt',
    unit: 'pcs', category: 'Kaos', article: 'T-Shirt', price: 269000,
    variants: [
      { name: 'Warna',  options: ['White', 'Sand', 'Dusty Blue'] },
      { name: 'Ukuran', options: ['S', 'M', 'L', 'XL'] },
    ],
    qty: [10, 15, 12, 8,  8, 12, 10, 6,  7, 10, 9, 5],
    stockMain: 115, stockSec: 70,
  },
  {
    name: 'Daydream T-Shirt',
    unit: 'pcs', category: 'Kaos', article: 'T-Shirt', price: 249000,
    variants: [
      { name: 'Warna',  options: ['White', 'Black'] },
      { name: 'Ukuran', options: ['S', 'M', 'L', 'XL'] },
    ],
    qty: [12, 18, 15, 9,  10, 14, 12, 7],
    stockMain: 100, stockSec: 60,
  },
  {
    name: 'PREFACE Plus Mark Polo',
    unit: 'pcs', category: 'Kaos', article: 'Polo', price: 349000,
    variants: [
      { name: 'Warna',  options: ['Brown', 'Black'] },
      { name: 'Ukuran', options: ['S', 'M', 'L', 'XL'] },
    ],
    qty: [10, 14, 12, 8,  8, 12, 10, 6],
    stockMain: 80, stockSec: 50,
  },
  {
    name: 'Racing Jacket',
    unit: 'pcs', category: 'Outerwear', article: 'Jaket', price: 699000,
    variants: [
      { name: 'Warna',  options: ['Black', 'Navy'] },
      { name: 'Ukuran', options: ['S', 'M', 'L', 'XL'] },
    ],
    qty: [5, 8, 7, 4,  4, 6, 5, 3],
    stockMain: 40, stockSec: 22,
  },
  {
    name: 'PRFC Chenille Knit',
    unit: 'pcs', category: 'Knitwear', article: 'Knit', price: 429000,
    variants: [
      { name: 'Warna',  options: ['Black', 'Cream'] },
      { name: 'Ukuran', options: ['S', 'M', 'L'] },
    ],
    qty: [8, 12, 10,  6, 9, 7],
    stockMain: 55, stockSec: 30,
  },
  {
    name: 'PRFC Loop Crossbody Bag',
    unit: 'pcs', category: 'Aksesoris', article: 'Bag', price: 299000,
    variants: [
      { name: 'Warna', options: ['Black', 'Brown'] },
    ],
    qty: [18, 14],
    stockMain: 35, stockSec: 20,
  },
]

module.exports = {
  async up(queryInterface) {
    const now = new Date()
    const db  = queryInterface.sequelize
    const run = (sql) => db.query(sql)
    const sel = (sql) => db.query(sql).then(([rows]) => rows)

    // ── Company ─────────────────────────────────────────────────────────────
    await queryInterface.bulkInsert('Companies', [{
      name: 'Preface Demo 2', slug: 'preface-demo-2',
      status: 'active', subscriptionExpiresAt: new Date('2099-12-31'),
      createdAt: now, updatedAt: now,
    }], { ignoreDuplicates: true })

    const [[co]] = await db.query(`SELECT id FROM "Companies" WHERE slug = 'preface-demo-2' LIMIT 1`)
    const cid = co.id

    // ── Users ────────────────────────────────────────────────────────────────
    await db.query(`DELETE FROM "Users" WHERE email IN ('admin2@inventory.local','staff2@inventory.local')`)
    await queryInterface.bulkInsert('Users', [
      { name: 'Admin Demo 2',      email: 'admin2@inventory.local', password: hashPassword('password123'), role: 'COMPANY_ADMIN', companyId: cid, isActive: true, createdAt: now, updatedAt: now },
      { name: 'Staff Demo 2',      email: 'staff2@inventory.local', password: hashPassword('password123'), role: 'OPERASIONAL',   companyId: cid, isActive: true, createdAt: now, updatedAt: now },
    ])

    // ── Warehouses ───────────────────────────────────────────────────────────
    await db.query(`DELETE FROM "Warehouses" WHERE "companyId" = ${cid}`)
    const whRows = await sel(`
      INSERT INTO "Warehouses" (name, location, "companyId", "createdAt", "updatedAt") VALUES
        ('Main Warehouse D2',      'Jakarta Selatan', ${cid}, NOW(), NOW()),
        ('Secondary Warehouse D2', 'Bandung',         ${cid}, NOW(), NOW())
      RETURNING id, name
    `)
    const mainWh = whRows.find(w => w.name.includes('Main'))?.id
    const secWh  = whRows.find(w => w.name.includes('Secondary'))?.id

    // ── Clean existing product data for this company ──────────────────────────
    // SKU variant links are global (no companyId), clean via product cascade
    const existingProds = await sel(`SELECT id FROM "Products" WHERE "companyId" = ${cid}`)
    if (existingProds.length) {
      const pids = existingProds.map(p => p.id).join(',')
      await run(`DELETE FROM "ProductSKUVariantOptions" WHERE "ProductSKUId" IN (SELECT id FROM "ProductSKUs" WHERE "ProductId" IN (${pids}))`)
      await run(`DELETE FROM "ProductSKUs" WHERE "ProductId" IN (${pids})`)
      await run(`DELETE FROM "ProductVariantOptions" WHERE "ProductVariantTypeId" IN (SELECT id FROM "ProductVariantTypes" WHERE "ProductId" IN (${pids}))`)
      await run(`DELETE FROM "ProductVariantTypes" WHERE "ProductId" IN (${pids})`)
    }
    await run(`DELETE FROM "Stock_Movements" WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Stocks"          WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Products"        WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Articles"        WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Categories"      WHERE "companyId" = ${cid}`)

    // ── Categories & Articles ─────────────────────────────────────────────────
    const catRows = await sel(`
      INSERT INTO "Categories" (name, "companyId", "createdAt", "updatedAt") VALUES
        ${CATEGORIES.map(c => `('${c}', ${cid}, NOW(), NOW())`).join(', ')}
      RETURNING id, name
    `)
    const cat = Object.fromEntries(catRows.map(c => [c.name, c.id]))

    const artRows = await sel(`
      INSERT INTO "Articles" (name, "companyId", "createdAt", "updatedAt") VALUES
        ${ARTICLES.map(a => `('${a}', ${cid}, NOW(), NOW())`).join(', ')}
      RETURNING id, name
    `)
    const art = Object.fromEntries(artRows.map(a => [a.name, a.id]))

    // ── Products + Variants + SKUs + Stocks ───────────────────────────────────
    const usedCodes = new Set()

    for (const p of PRODUCTS) {
      const [prodRow] = await sel(`
        INSERT INTO "Products" (name, unit, "CategoryId", "ArticleId", "companyId", "createdAt", "updatedAt")
        VALUES ('${p.name.replace(/'/g, "''")}', '${p.unit}', ${cat[p.category]}, ${art[p.article]}, ${cid}, NOW(), NOW())
        RETURNING id
      `)
      const pid = prodRow.id

      const typeGroups = []
      for (const vt of p.variants) {
        const [typeRow] = await sel(`
          INSERT INTO "ProductVariantTypes" ("ProductId", name, "createdAt", "updatedAt")
          VALUES (${pid}, '${vt.name}', NOW(), NOW()) RETURNING id
        `)
        const optRows = await sel(`
          INSERT INTO "ProductVariantOptions" ("ProductVariantTypeId", value, "createdAt", "updatedAt")
          VALUES ${vt.options.map(o => `(${typeRow.id}, '${o}', NOW(), NOW())`).join(', ')}
          RETURNING id, value
        `)
        typeGroups.push({ options: optRows })
      }

      const combos  = cartesian(typeGroups.map(tg => tg.options))
      const qtyList = p.qty ?? []

      for (let i = 0; i < combos.length; i++) {
        const combo     = combos[i]
        const optValues = combo.map(o => o.value)
        let code = skuCode(p.name, optValues)
        let n = 0
        while (usedCodes.has(code)) code = `${skuCode(p.name, optValues)}-${++n}`
        usedCodes.add(code)

        const [skuRow] = await sel(`
          INSERT INTO "ProductSKUs" ("ProductId", sku_code, price, qty, "companyId", "createdAt", "updatedAt")
          VALUES (${pid}, '${code}', ${p.price}, ${qtyList[i] ?? 10}, ${cid}, NOW(), NOW())
          RETURNING id
        `)
        await run(`
          INSERT INTO "ProductSKUVariantOptions" ("ProductSKUId", "ProductVariantOptionId", "createdAt", "updatedAt")
          VALUES ${combo.map(o => `(${skuRow.id}, ${o.id}, NOW(), NOW())`).join(', ')}
        `)
      }

      if (mainWh) await run(`INSERT INTO "Stocks" ("ProductId","WarehouseId",quantity,"companyId","createdAt","updatedAt") VALUES (${pid},${mainWh},${p.stockMain},${cid},NOW(),NOW())`)
      if (secWh)  await run(`INSERT INTO "Stocks" ("ProductId","WarehouseId",quantity,"companyId","createdAt","updatedAt") VALUES (${pid},${secWh},${p.stockSec},${cid},NOW(),NOW())`)
    }

    // ── Sample movements ──────────────────────────────────────────────────────
    const prodIds = await sel(`SELECT id, name FROM "Products" WHERE "companyId" = ${cid}`)
    const pid = Object.fromEntries(prodIds.map(p => [p.name, p.id]))

    const MOVEMENTS = [
      { product: 'Club de Preface Hoodie', wh: mainWh, type: 'IN',         qty: 30, note: 'Inbound batch A' },
      { product: 'Oasis T-Shirt',          wh: mainWh, type: 'IN',         qty: 40, note: 'Inbound batch A' },
      { product: 'Daydream T-Shirt',       wh: secWh,  type: 'OUT',        qty: 10, note: 'Outbound ke toko' },
      { product: 'Racing Jacket',          wh: mainWh, type: 'IN',         qty: 15, note: 'Inbound batch B' },
      { product: 'PRFC Chenille Knit',     wh: secWh,  type: 'ADJUSTMENT', qty: 3,  note: 'Koreksi opname' },
    ]
    for (const m of MOVEMENTS) {
      if (!pid[m.product] || !m.wh) continue
      await run(`
        INSERT INTO "Stock_Movements" ("ProductId","WarehouseId",type,quantity,note,"companyId","createdAt","updatedAt")
        VALUES (${pid[m.product]},${m.wh},'${m.type}',${m.qty},'${m.note}',${cid},NOW(),NOW())
      `)
    }
  },

  async down(queryInterface) {
    const db  = queryInterface.sequelize
    const run = (sql) => db.query(sql)
    const [[co]] = await db.query(`SELECT id FROM "Companies" WHERE slug = 'preface-demo-2' LIMIT 1`).catch(() => [[null]])
    if (!co) return
    const cid = co.id

    const existingProds = await db.query(`SELECT id FROM "Products" WHERE "companyId" = ${cid}`).then(([r]) => r)
    if (existingProds.length) {
      const pids = existingProds.map(p => p.id).join(',')
      await run(`DELETE FROM "ProductSKUVariantOptions" WHERE "ProductSKUId" IN (SELECT id FROM "ProductSKUs" WHERE "ProductId" IN (${pids}))`)
      await run(`DELETE FROM "ProductSKUs" WHERE "ProductId" IN (${pids})`)
      await run(`DELETE FROM "ProductVariantOptions" WHERE "ProductVariantTypeId" IN (SELECT id FROM "ProductVariantTypes" WHERE "ProductId" IN (${pids}))`)
      await run(`DELETE FROM "ProductVariantTypes" WHERE "ProductId" IN (${pids})`)
    }
    await run(`DELETE FROM "Stock_Movements" WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Stocks"          WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Products"        WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Articles"        WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Categories"      WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Warehouses"      WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Users"           WHERE "companyId" = ${cid}`)
    await run(`DELETE FROM "Companies"       WHERE id = ${cid}`)
  },
}
