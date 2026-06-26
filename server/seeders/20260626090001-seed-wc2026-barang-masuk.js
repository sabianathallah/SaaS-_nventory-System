'use strict';

// ── Name normalization: Excel label → DB product name ────────────────────────
const PRODUCT_NAME_MAP = {
  'joga zip hoodie':            'Joga Zip Hoodie',
  'joga tracktop':              'Joga Tracktop',
  'joga trackpants':            'Joga Trackpants',
  'yamato flame blue jersey':   'Yamato Flame Blue Jersey',
  'yamato flame white jersey':  'Yamato Flame White Jersey',
  'jersey japan blue':          'Yamato Flame Blue Jersey',
  'jersey japan white':         'Yamato Flame White Jersey',
  'ronaldo tee':                'Ronaldo Tee',
  'messi black tee':            'Messi Black Tee',
  'zidane white tee':           'Zidane White Tee',
  'three lions barrel denim':   'Three Lions Barrel Denim',
  'three lion barrel denim':    'Three Lions Barrel Denim',
  'hoodie spain':               'La Roja Sprayed Hoodie',
  'hoodie england':             'Three Lions Sprayed Hoodie',
  'preface soccer ball':        'PREFACE Soccer Ball',
  'espana baby polo':           'Espana Baby Polo',
};

// ── Vendor per DB product name ───────────────────────────────────────────────
const PRODUCT_VENDOR_MAP = {
  'Joga Zip Hoodie':            'Deni',
  'Joga Tracktop':              'Deni',
  'Joga Trackpants':            'Deni',
  'Yamato Flame Blue Jersey':   'Nots',
  'Yamato Flame White Jersey':  'Nots',
  'Ronaldo Tee':                'Ugey',
  'Messi Black Tee':            'Ugey',
  'Zidane White Tee':           'Ugey',
  'Three Lions Barrel Denim':   'Iwan',
  'La Roja Sprayed Hoodie':     'Ugey',
  'Three Lions Sprayed Hoodie': 'Ugey',
  'PREFACE Soccer Ball':        'Home Industry Bola',
  'Espana Baby Polo':           'Deni',
};

// ── Raw data parsed from Excel ────────────────────────────────────────────────
// qty=0 rows skipped (e.g. Joga Trackpants L 24 Juni qty:0)
const RAW_ROWS = [
  // 15 JUNI
  { date: '2026-06-15', product: 'Joga Zip Hoodie', size: 'S',  qty: 1,  ready: 1,    reject: 0    },
  { date: '2026-06-15', product: 'Joga Zip Hoodie', size: 'M',  qty: 2,  ready: 2,    reject: 0    },
  { date: '2026-06-15', product: 'Joga Zip Hoodie', size: 'L',  qty: 2,  ready: 1,    reject: 1    },
  { date: '2026-06-15', product: 'Joga Zip Hoodie', size: 'XL', qty: 1,  ready: null, reject: null },

  // 16 JUNI
  { date: '2026-06-16', product: 'Joga Tracktop',              size: 'S',  qty: 3, ready: 3,    reject: 0    },
  { date: '2026-06-16', product: 'Joga Tracktop',              size: 'M',  qty: 2, ready: 2,    reject: 0    },
  { date: '2026-06-16', product: 'Joga Tracktop',              size: 'XL', qty: 3, ready: 2,    reject: 1    },
  { date: '2026-06-16', product: 'Yamato Flame Blue Jersey',   size: 'S',  qty: 1, ready: 1,    reject: 0    },
  { date: '2026-06-16', product: 'Yamato Flame Blue Jersey',   size: 'M',  qty: 1, ready: 0,    reject: 1    },
  { date: '2026-06-16', product: 'Yamato Flame Blue Jersey',   size: 'L',  qty: 1, ready: 1,    reject: 0    },
  { date: '2026-06-16', product: 'Yamato Flame Blue Jersey',   size: 'XL', qty: 1, ready: 1,    reject: 0    },
  { date: '2026-06-16', product: 'Yamato Flame White Jersey',  size: 'S',  qty: 1, ready: 1,    reject: 0    },
  { date: '2026-06-16', product: 'Yamato Flame White Jersey',  size: 'M',  qty: 1, ready: 0,    reject: 1    },
  { date: '2026-06-16', product: 'Yamato Flame White Jersey',  size: 'L',  qty: 1, ready: 0,    reject: 1    },
  { date: '2026-06-16', product: 'Yamato Flame White Jersey',  size: 'XL', qty: 1, ready: 0,    reject: 1    },
  { date: '2026-06-16', product: 'Ronaldo Tee',                size: 'S',  qty: 3, ready: 3,    reject: 0    },
  { date: '2026-06-16', product: 'Ronaldo Tee',                size: 'M',  qty: 3, ready: 2,    reject: 1    },
  { date: '2026-06-16', product: 'Ronaldo Tee',                size: 'L',  qty: 2, ready: 2,    reject: 0    },
  { date: '2026-06-16', product: 'Ronaldo Tee',                size: 'XL', qty: 1, ready: 1,    reject: 0    },
  { date: '2026-06-16', product: 'Messi Black Tee',            size: 'S',  qty: 2, ready: 2,    reject: 0    },
  { date: '2026-06-16', product: 'Messi Black Tee',            size: 'M',  qty: 4, ready: 4,    reject: 0    },
  { date: '2026-06-16', product: 'Messi Black Tee',            size: 'L',  qty: 3, ready: 1,    reject: 1    },
  { date: '2026-06-16', product: 'Messi Black Tee',            size: 'XL', qty: 2, ready: 1,    reject: 1    },
  { date: '2026-06-16', product: 'Zidane White Tee',           size: 'S',  qty: 2, ready: 2,    reject: 0    },
  { date: '2026-06-16', product: 'Zidane White Tee',           size: 'M',  qty: 2, ready: 2,    reject: 0    },
  { date: '2026-06-16', product: 'Zidane White Tee',           size: 'L',  qty: 3, ready: 1,    reject: 2    },
  { date: '2026-06-16', product: 'Zidane White Tee',           size: 'XL', qty: 1, ready: 1,    reject: 0    },
  { date: '2026-06-16', product: 'Three Lions Barrel Denim',   size: 'S',  qty: 1, ready: 1,    reject: 0    },
  { date: '2026-06-16', product: 'La Roja Sprayed Hoodie',     size: 'S',  qty: 2, ready: null, reject: null },
  { date: '2026-06-16', product: 'La Roja Sprayed Hoodie',     size: 'M',  qty: 4, ready: null, reject: null },
  { date: '2026-06-16', product: 'La Roja Sprayed Hoodie',     size: 'L',  qty: 1, ready: null, reject: null },
  { date: '2026-06-16', product: 'La Roja Sprayed Hoodie',     size: 'XL', qty: 2, ready: null, reject: null },
  { date: '2026-06-16', product: 'Three Lions Sprayed Hoodie', size: 'S',  qty: 1, ready: null, reject: null },
  { date: '2026-06-16', product: 'Three Lions Sprayed Hoodie', size: 'M',  qty: 5, ready: null, reject: null },
  { date: '2026-06-16', product: 'Three Lions Sprayed Hoodie', size: 'L',  qty: 3, ready: null, reject: null },
  { date: '2026-06-16', product: 'Three Lions Sprayed Hoodie', size: 'XL', qty: 2, ready: null, reject: null },

  // 17 JUNI
  { date: '2026-06-17', product: 'Joga Tracktop',   size: 'L',  qty: 2, ready: 2, reject: 0 },
  { date: '2026-06-17', product: 'Joga Trackpants', size: 'S',  qty: 1, ready: 1, reject: 0 },
  { date: '2026-06-17', product: 'Joga Trackpants', size: 'M',  qty: 1, ready: 1, reject: 0 },
  { date: '2026-06-17', product: 'Joga Trackpants', size: 'L',  qty: 1, ready: 1, reject: 0 },
  { date: '2026-06-17', product: 'Joga Trackpants', size: 'XL', qty: 1, ready: 1, reject: 0 },

  // 19 JUNI
  { date: '2026-06-19', product: 'Zidane White Tee',          size: 'S',  qty: 1, ready: 1,    reject: 0    },
  { date: '2026-06-19', product: 'Zidane White Tee',          size: 'L',  qty: 1, ready: 1,    reject: 0    },
  { date: '2026-06-19', product: 'Ronaldo Tee',               size: 'S',  qty: 2, ready: 2,    reject: 0    },
  { date: '2026-06-19', product: 'Yamato Flame Blue Jersey',  size: 'S',  qty: 2, ready: null, reject: null },
  { date: '2026-06-19', product: 'Yamato Flame Blue Jersey',  size: 'M',  qty: 1, ready: null, reject: null },
  { date: '2026-06-19', product: 'Yamato Flame Blue Jersey',  size: 'L',  qty: 1, ready: null, reject: null },
  { date: '2026-06-19', product: 'Yamato Flame Blue Jersey',  size: 'XL', qty: 1, ready: null, reject: null },

  // 22 JUNI
  { date: '2026-06-22', product: 'Joga Zip Hoodie',          size: 'S',  qty: 1,  ready: 1,    reject: 0    },
  { date: '2026-06-22', product: 'Joga Zip Hoodie',          size: 'M',  qty: 3,  ready: 3,    reject: 0    },
  { date: '2026-06-22', product: 'Joga Zip Hoodie',          size: 'L',  qty: 1,  ready: 1,    reject: 0    },
  { date: '2026-06-22', product: 'Joga Zip Hoodie',          size: 'XL', qty: 1,  ready: 1,    reject: 0    },
  { date: '2026-06-22', product: 'Joga Tracktop',            size: 'L',  qty: 2,  ready: 0,    reject: 2    },
  { date: '2026-06-22', product: 'Joga Trackpants',          size: 'M',  qty: 3,  ready: 0,    reject: 3    },
  { date: '2026-06-22', product: 'PREFACE Soccer Ball',      size: null, qty: 30, ready: 25,   reject: 5    },
  { date: '2026-06-22', product: 'Yamato Flame Blue Jersey', size: 'M',  qty: 2,  ready: null, reject: null },
  { date: '2026-06-22', product: 'Yamato Flame White Jersey',size: 'S',  qty: 1,  ready: null, reject: null },
  { date: '2026-06-22', product: 'Yamato Flame White Jersey',size: 'M',  qty: 2,  ready: null, reject: null },

  // 23 JUNI
  { date: '2026-06-23', product: 'Joga Trackpants', size: 'M',  qty: 1,  ready: 0,  reject: 1  },
  { date: '2026-06-23', product: 'Joga Tracktop',   size: 'XL', qty: 1,  ready: 1,  reject: 0  },
  { date: '2026-06-23', product: 'Joga Zip Hoodie', size: 'S',  qty: 5,  ready: 3,  reject: 2  },
  { date: '2026-06-23', product: 'Joga Zip Hoodie', size: 'M',  qty: 15, ready: 15, reject: 15 },
  { date: '2026-06-23', product: 'Joga Zip Hoodie', size: 'L',  qty: 37, ready: 33, reject: 3  },
  { date: '2026-06-23', product: 'Joga Zip Hoodie', size: 'XL', qty: 2,  ready: 0,  reject: 2  },

  // 24 JUNI (Joga Trackpants L qty=0 → skip)
  { date: '2026-06-24', product: 'Joga Trackpants',      size: 'S',  qty: 1, ready: 1,    reject: 0    },
  { date: '2026-06-24', product: 'Joga Trackpants',      size: 'M',  qty: 2, ready: 0,    reject: 2    },
  { date: '2026-06-24', product: 'Joga Trackpants',      size: 'XL', qty: 1, ready: 0,    reject: 1    },
  { date: '2026-06-24', product: 'Espana Baby Polo',     size: 'S',  qty: 4, ready: 4,    reject: 0    },
  { date: '2026-06-24', product: 'Espana Baby Polo',     size: 'M',  qty: 2, ready: 1,    reject: 1    },
  { date: '2026-06-24', product: 'Espana Baby Polo',     size: 'L',  qty: 1, ready: 1,    reject: 0    },
  { date: '2026-06-24', product: 'La Roja Sprayed Hoodie', size: 'S', qty: 3, ready: null, reject: null },

  // 26 JUNI
  { date: '2026-06-26', product: 'Three Lions Barrel Denim', size: 'XS', qty: 2, ready: null, reject: null },
  { date: '2026-06-26', product: 'Three Lions Barrel Denim', size: 'S',  qty: 2, ready: null, reject: null },
  { date: '2026-06-26', product: 'Three Lions Barrel Denim', size: 'M',  qty: 1, ready: null, reject: null },
  { date: '2026-06-26', product: 'Three Lions Barrel Denim', size: 'L',  qty: 2, ready: null, reject: null },
  { date: '2026-06-26', product: 'Three Lions Barrel Denim', size: 'XL', qty: 1, ready: null, reject: null },
];

module.exports = {
  async up(queryInterface) {
    const db  = queryInterface.sequelize;
    const sel = async (sql) => { const [rows] = await db.query(sql); return rows; };

    // ── 1. Resolve company via user Sabian Athallah ──────────────────────────
    const [userRow] = await sel(`
      SELECT id, "companyId" FROM "Users"
      WHERE LOWER(name) LIKE '%sabian%' AND LOWER(name) LIKE '%athallah%'
      LIMIT 1
    `);
    if (!userRow) throw new Error('User Sabian Athallah tidak ditemukan');
    const userId = userRow.id;
    const cid    = userRow.companyId;
    console.log(`✓ User: id=${userId}, companyId=${cid}`);

    // ── 2. Resolve vendors ───────────────────────────────────────────────────
    const vendorNames = ['Deni', 'Nots', 'Ugey', 'Iwan', 'Home Industry Bola'];
    const vendorRows  = await sel(`
      SELECT id, name FROM "Vendors"
      WHERE "companyId" = ${cid}
        AND name IN (${vendorNames.map(n => `'${n}'`).join(', ')})
    `);
    const vendorMap = Object.fromEntries(vendorRows.map(v => [v.name, v.id]));
    const missingVendors = vendorNames.filter(n => !vendorMap[n]);
    if (missingVendors.length) throw new Error(`Vendor tidak ditemukan: ${missingVendors.join(', ')}`);
    console.log('✓ Vendors:', vendorMap);

    // ── 3. Resolve products ──────────────────────────────────────────────────
    const dbProductNames = [...new Set(Object.values(PRODUCT_VENDOR_MAP))];
    const productRows    = await sel(`
      SELECT id, name FROM "Products"
      WHERE "companyId" = ${cid}
        AND name IN (${dbProductNames.map(n => `'${n.replace(/'/g, "''")}'`).join(', ')})
    `);
    const productMap = Object.fromEntries(productRows.map(p => [p.name, p.id]));
    const missingProducts = dbProductNames.filter(n => !productMap[n]);
    if (missingProducts.length) throw new Error(`Produk tidak ditemukan di DB: ${missingProducts.join(', ')}`);
    console.log('✓ Products found:', Object.keys(productMap).length);

    // ── 4. Resolve SKUs (product + size → productSkuId) ──────────────────────
    const skuRows = await sel(`
      SELECT ps.id AS "skuId", p.name AS "productName", pvo.value AS size
      FROM "ProductSKUs" ps
      JOIN "Products" p ON p.id = ps."ProductId"
      LEFT JOIN "ProductSKUVariantOptions" psvo ON psvo."ProductSKUId" = ps.id
      LEFT JOIN "ProductVariantOptions" pvo ON pvo.id = psvo."ProductVariantOptionId"
      WHERE p."companyId" = ${cid}
        AND p.name IN (${dbProductNames.map(n => `'${n.replace(/'/g, "''")}'`).join(', ')})
    `);

    // skuLookup: 'ProductName|Size' → skuId
    const skuLookup = {};
    for (const row of skuRows) {
      const key = `${row.productName}|${row.size || ''}`;
      skuLookup[key] = row.skuId;
    }
    console.log('✓ SKU entries loaded:', Object.keys(skuLookup).length);

    // ── 5. Group rows by date + vendor ───────────────────────────────────────
    const deliveryMap = {}; // key: 'date|vendorName'
    for (const row of RAW_ROWS) {
      const dbName    = PRODUCT_NAME_MAP[row.product.toLowerCase().trim()];
      if (!dbName) throw new Error(`Produk tidak dikenali: "${row.product}"`);
      const vendorName = PRODUCT_VENDOR_MAP[dbName];
      const key        = `${row.date}|${vendorName}`;
      if (!deliveryMap[key]) deliveryMap[key] = { date: row.date, vendorName, items: [] };
      deliveryMap[key].items.push({ ...row, dbName });
    }

    const now = new Date();

    // ── 6. Insert VendorDeliveries + VendorDeliveryItems ────────────────────
    for (const { date, vendorName, items } of Object.values(deliveryMap)) {
      const vendorId = vendorMap[vendorName];

      // Insert header
      await db.query(`
        INSERT INTO "VendorDeliveries"
          ("vendorId", "date", "status", "createdBy", "companyId", "createdAt", "updatedAt")
        VALUES
          (${vendorId}, '${date}', 'closed', ${userId}, ${cid}, NOW(), NOW())
      `);

      const [deliveryRow] = await sel(`
        SELECT id FROM "VendorDeliveries"
        WHERE "vendorId" = ${vendorId} AND "date" = '${date}' AND "companyId" = ${cid}
        ORDER BY id DESC LIMIT 1
      `);
      const deliveryId = deliveryRow.id;

      // Insert items
      for (const item of items) {
        const productId = productMap[item.dbName];
        const skuKey    = `${item.dbName}|${item.size || ''}`;
        const skuId     = skuLookup[skuKey] ?? null;

        if (!skuId && item.size) {
          console.warn(`  ⚠ SKU tidak ditemukan: ${item.dbName} size=${item.size} — productSkuId akan null`);
        }

        const qtyReady  = item.ready  ?? 'NULL';
        const qtyReject = item.reject ?? 'NULL';

        await db.query(`
          INSERT INTO "VendorDeliveryItems"
            ("deliveryId", "productId", "productSkuId", "qtySJ", "qtyActual", "qtyReady", "qtyReject", "createdAt", "updatedAt")
          VALUES
            (${deliveryId}, ${productId}, ${skuId ?? 'NULL'}, ${item.qty}, ${item.qty}, ${qtyReady}, ${qtyReject}, NOW(), NOW())
        `);
      }

      console.log(`✓ ${date} | ${vendorName} → delivery #${deliveryId} (${items.length} items)`);
    }

    console.log('\n✅ Seed WC2026 barang masuk selesai.');
  },

  async down(queryInterface) {
    const db  = queryInterface.sequelize;
    const sel = async (sql) => { const [rows] = await db.query(sql); return rows; };

    const [userRow] = await sel(`
      SELECT "companyId" FROM "Users"
      WHERE LOWER(name) LIKE '%sabian%' AND LOWER(name) LIKE '%athallah%'
      LIMIT 1
    `);
    if (!userRow) return;

    const dates = ['2026-06-15','2026-06-16','2026-06-17','2026-06-19',
                   '2026-06-22','2026-06-23','2026-06-24','2026-06-26'];

    await db.query(`
      DELETE FROM "VendorDeliveries"
      WHERE "companyId" = ${userRow.companyId}
        AND "date" IN (${dates.map(d => `'${d}'`).join(', ')})
    `);
  },
};
