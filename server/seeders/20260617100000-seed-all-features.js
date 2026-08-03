'use strict';

/**
 * Comprehensive reseed for all features:
 * - ShipmentCategories + ManualShipments (new)
 * - StockTransfers
 * - VendorDeliveries
 * Runs for both Preface Demo and Preface Demo 2 companies.
 */

module.exports = {
  async up(queryInterface) {
    const db  = queryInterface.sequelize;
    const now = new Date();

    const sel = async (sql) => {
      const [rows] = await db.query(sql);
      return rows;
    };
    const run = (sql) => db.query(sql);

    // ── Resolve company IDs ───────────────────────────────────────────────────
    const [co1] = await sel(`SELECT id FROM "Companies" WHERE slug = 'preface-demo'   LIMIT 1`);
    const [co2] = await sel(`SELECT id FROM "Companies" WHERE slug = 'preface-demo-2' LIMIT 1`);

    if (!co1 || !co2) {
      throw new Error('Companies preface-demo / preface-demo-2 not found. Run earlier seeders first.');
    }

    const cid1 = co1.id;
    const cid2 = co2.id;

    // ── Resolve user IDs ──────────────────────────────────────────────────────
    const users1 = await sel(`SELECT id, role FROM "Users" WHERE "companyId" = ${cid1} LIMIT 10`);
    const users2 = await sel(`SELECT id, role FROM "Users" WHERE "companyId" = ${cid2} LIMIT 10`);

    const adminId1 = (users1.find(u => u.role === 'COMPANY_ADMIN') || users1[0])?.id;
    const staffId1 = (users1.find(u => u.role === 'OPERASIONAL')   || users1[0])?.id;
    const adminId2 = (users2.find(u => u.role === 'COMPANY_ADMIN') || users2[0])?.id;
    const staffId2 = (users2.find(u => u.role === 'OPERASIONAL')   || users2[0])?.id;

    // ── Resolve warehouse IDs ─────────────────────────────────────────────────
    const whs1 = await sel(`SELECT id, name FROM "Warehouses" WHERE "companyId" = ${cid1} ORDER BY id LIMIT 5`);
    const whs2 = await sel(`SELECT id, name FROM "Warehouses" WHERE "companyId" = ${cid2} ORDER BY id LIMIT 5`);

    // ── Resolve a few ProductSKUs per company ─────────────────────────────────
    const skus1 = await sel(`
      SELECT ps.id, ps.sku_code AS "skuCode", p.name AS "productName", p.id AS "productId"
      FROM "ProductSKUs" ps
      JOIN "Products" p ON ps."ProductId" = p.id
      WHERE p."companyId" = ${cid1}
      LIMIT 20
    `);
    const skus2 = await sel(`
      SELECT ps.id, ps.sku_code AS "skuCode", p.name AS "productName", p.id AS "productId"
      FROM "ProductSKUs" ps
      JOIN "Products" p ON ps."ProductId" = p.id
      WHERE p."companyId" = ${cid2}
      LIMIT 20
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 1. SHIPMENT CATEGORIES
    // ─────────────────────────────────────────────────────────────────────────
    await run(`DELETE FROM "ShipmentCategories" WHERE "companyId" IN (${cid1}, ${cid2})`);

    const catNames = [
      'Donasi Internal',
      'Sample Marketing',
      'Retur ke Vendor',
      'Kirim ke Kantor Pusat',
      'Inventaris Acara',
    ];

    await queryInterface.bulkInsert('ShipmentCategories', [
      ...catNames.map(name => ({ companyId: cid1, name, createdAt: now, updatedAt: now })),
      ...catNames.map(name => ({ companyId: cid2, name, createdAt: now, updatedAt: now })),
    ]);

    const cats1 = await sel(`SELECT id, name FROM "ShipmentCategories" WHERE "companyId" = ${cid1} ORDER BY id`);
    const cats2 = await sel(`SELECT id, name FROM "ShipmentCategories" WHERE "companyId" = ${cid2} ORDER BY id`);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. MANUAL SHIPMENTS
    // ─────────────────────────────────────────────────────────────────────────
    await run(`
      DELETE FROM "ManualShipmentItems"
      WHERE "shipmentId" IN (SELECT id FROM "ManualShipments" WHERE "companyId" IN (${cid1}, ${cid2}))
    `);
    await run(`DELETE FROM "ManualShipments" WHERE "companyId" IN (${cid1}, ${cid2})`);

    // Build shipment definitions for company 1
    const buildShipments = (cid, adminId, staffId, cats, skus, prefix) => {
      if (!skus.length || !adminId) return { shipments: [], items: [] };

      const s0sku  = skus[0]  || {};
      const s1sku  = skus[1]  || skus[0] || {};
      const s2sku  = skus[2]  || skus[0] || {};
      const s3sku  = skus[3]  || skus[0] || {};
      const catId  = cats[1]?.id || null;

      const price = (n) => parseFloat((n * 1000).toFixed(2));

      const shipments = [
        // sales – completed
        {
          companyId: cid, invoiceNumber: `${prefix}-SLS-001`,
          type: 'sales', shipmentCategoryId: null,
          status: 'completed',
          buyerName: 'Ahmad Fauzi', buyerPhone: '081234567890',
          buyerAddress: 'Jl. Sudirman No. 12, Jakarta Selatan',
          recipientInfo: 'Terima di depan pos satpam',
          shippingCost: 15000, subtotal: price(3 * 185 + 2 * 529),
          total: price(3 * 185 + 2 * 529) + 15000,
          expeditionName: 'JNE REG', courierResiNumber: `JNE${prefix}001001`,
          paymentProofVerifiedBy: adminId, paymentProofVerifiedAt: new Date('2026-06-10T10:00:00Z'),
          notes: null, cancelledReason: null, createdBy: staffId,
          createdAt: new Date('2026-06-10'), updatedAt: new Date('2026-06-12'),
        },
        // sales – shipped
        {
          companyId: cid, invoiceNumber: `${prefix}-SLS-002`,
          type: 'sales', shipmentCategoryId: null,
          status: 'shipped',
          buyerName: 'Siti Rahayu', buyerPhone: '082345678901',
          buyerAddress: 'Jl. Gatot Subroto Kav. 5, Bandung',
          recipientInfo: null,
          shippingCost: 18000, subtotal: price(1 * 529),
          total: price(1 * 529) + 18000,
          expeditionName: 'SICEPAT', courierResiNumber: `SCP${prefix}002001`,
          paymentProofVerifiedBy: adminId, paymentProofVerifiedAt: new Date('2026-06-13T08:00:00Z'),
          notes: 'Bubble wrap extra', cancelledReason: null, createdBy: staffId,
          createdAt: new Date('2026-06-13'), updatedAt: new Date('2026-06-14'),
        },
        // sales – transferred (bukti transfer sudah diverif, belum kirim)
        {
          companyId: cid, invoiceNumber: `${prefix}-SLS-003`,
          type: 'sales', shipmentCategoryId: null,
          status: 'transferred',
          buyerName: 'Budi Santoso', buyerPhone: '083456789012',
          buyerAddress: 'Jl. Pemuda No. 88, Surabaya',
          recipientInfo: null,
          shippingCost: 20000, subtotal: price(2 * 185),
          total: price(2 * 185) + 20000,
          expeditionName: null, courierResiNumber: null,
          paymentProofVerifiedBy: adminId, paymentProofVerifiedAt: new Date('2026-06-15T09:00:00Z'),
          notes: null, cancelledReason: null, createdBy: staffId,
          createdAt: new Date('2026-06-15'), updatedAt: new Date('2026-06-15'),
        },
        // sales – in_progress (baru dibuat, menunggu transfer)
        {
          companyId: cid, invoiceNumber: `${prefix}-SLS-004`,
          type: 'sales', shipmentCategoryId: null,
          status: 'in_progress',
          buyerName: 'Dewi Lestari', buyerPhone: '084567890123',
          buyerAddress: 'Jl. Merdeka Timur No. 3, Yogyakarta',
          recipientInfo: 'Cod ke RT',
          shippingCost: 12000, subtotal: price(1 * 185 + 1 * 529),
          total: price(1 * 185 + 1 * 529) + 12000,
          expeditionName: null, courierResiNumber: null,
          paymentProofVerifiedBy: null, paymentProofVerifiedAt: null,
          notes: null, cancelledReason: null, createdBy: staffId,
          createdAt: new Date('2026-06-16'), updatedAt: new Date('2026-06-16'),
        },
        // sales – cancelled
        {
          companyId: cid, invoiceNumber: `${prefix}-SLS-005`,
          type: 'sales', shipmentCategoryId: null,
          status: 'cancelled',
          buyerName: 'Rizky Pratama', buyerPhone: '085678901234',
          buyerAddress: 'Jl. Diponegoro No. 21, Semarang',
          recipientInfo: null,
          shippingCost: 15000, subtotal: price(1 * 185),
          total: price(1 * 185) + 15000,
          expeditionName: null, courierResiNumber: null,
          paymentProofVerifiedBy: null, paymentProofVerifiedAt: null,
          notes: null, cancelledReason: 'Pembeli membatalkan pesanan',
          createdBy: staffId,
          createdAt: new Date('2026-06-11'), updatedAt: new Date('2026-06-11'),
        },
        // non-sales – donasi internal
        {
          companyId: cid, invoiceNumber: `${prefix}-NSL-001`,
          type: 'non_sales', shipmentCategoryId: cats[0]?.id || catId,
          status: 'completed',
          buyerName: null, buyerPhone: null, buyerAddress: null,
          recipientInfo: 'Donasi ke komunitas Preface',
          shippingCost: 0, subtotal: 0, total: 0,
          expeditionName: 'Antar Sendiri', courierResiNumber: null,
          paymentProofVerifiedBy: null, paymentProofVerifiedAt: null,
          notes: 'Donasi 10 pcs untuk event komunitas', cancelledReason: null,
          createdBy: adminId,
          createdAt: new Date('2026-06-08'), updatedAt: new Date('2026-06-09'),
        },
        // non-sales – sample marketing
        {
          companyId: cid, invoiceNumber: `${prefix}-NSL-002`,
          type: 'non_sales', shipmentCategoryId: cats[1]?.id || catId,
          status: 'shipped',
          buyerName: null, buyerPhone: null, buyerAddress: null,
          recipientInfo: 'Kirim ke influencer @stylebykevin',
          shippingCost: 25000, subtotal: 0, total: 25000,
          expeditionName: 'TIKI', courierResiNumber: `TKI${prefix}002001`,
          paymentProofVerifiedBy: null, paymentProofVerifiedAt: null,
          notes: 'Sample untuk konten TikTok', cancelledReason: null,
          createdBy: adminId,
          createdAt: new Date('2026-06-12'), updatedAt: new Date('2026-06-13'),
        },
      ];

      // Build items for each shipment
      const itemSets = [
        // SLS-001 items
        [
          { productId: s0sku.productId, productSkuId: s0sku.id, productName: s0sku.productName || 'Produk A', variantName: 'Black / M', sku: s0sku.skuCode, quantity: 3, unitPrice: 185000, subtotal: 555000 },
          { productId: s1sku.productId, productSkuId: s1sku.id, productName: s1sku.productName || 'Produk B', variantName: 'Cream / L', sku: s1sku.skuCode, quantity: 2, unitPrice: 529000, subtotal: 1058000 },
        ],
        // SLS-002 items
        [
          { productId: s1sku.productId, productSkuId: s1sku.id, productName: s1sku.productName || 'Produk B', variantName: 'Black / S', sku: s1sku.skuCode, quantity: 1, unitPrice: 529000, subtotal: 529000 },
        ],
        // SLS-003 items
        [
          { productId: s0sku.productId, productSkuId: s0sku.id, productName: s0sku.productName || 'Produk A', variantName: 'White / M', sku: s0sku.skuCode, quantity: 2, unitPrice: 185000, subtotal: 370000 },
        ],
        // SLS-004 items
        [
          { productId: s0sku.productId, productSkuId: s0sku.id, productName: s0sku.productName || 'Produk A', variantName: 'Blue / L',  sku: s0sku.skuCode, quantity: 1, unitPrice: 185000, subtotal: 185000 },
          { productId: s1sku.productId, productSkuId: s1sku.id, productName: s1sku.productName || 'Produk B', variantName: 'Cream / M', sku: s1sku.skuCode, quantity: 1, unitPrice: 529000, subtotal: 529000 },
        ],
        // SLS-005 items
        [
          { productId: s0sku.productId, productSkuId: s0sku.id, productName: s0sku.productName || 'Produk A', variantName: 'Navy / XL', sku: s0sku.skuCode, quantity: 1, unitPrice: 185000, subtotal: 185000 },
        ],
        // NSL-001 items
        [
          { productId: s2sku.productId, productSkuId: s2sku.id, productName: s2sku.productName || 'Produk C', variantName: 'Black / M', sku: s2sku.skuCode, quantity: 5,  unitPrice: 0, subtotal: 0 },
          { productId: s3sku.productId, productSkuId: s3sku.id, productName: s3sku.productName || 'Produk D', variantName: 'White / S', sku: s3sku.skuCode, quantity: 5,  unitPrice: 0, subtotal: 0 },
        ],
        // NSL-002 items
        [
          { productId: s2sku.productId, productSkuId: s2sku.id, productName: s2sku.productName || 'Produk C', variantName: 'Blue / M',  sku: s2sku.skuCode, quantity: 2,  unitPrice: 0, subtotal: 0 },
        ],
      ];

      return { shipments, itemSets };
    };

    const def1 = buildShipments(cid1, adminId1, staffId1, cats1, skus1, 'P1');
    const def2 = buildShipments(cid2, adminId2, staffId2, cats2, skus2, 'P2');

    const insertAndGetIds = async (records) => {
      if (!records.length) return [];
      await queryInterface.bulkInsert('ManualShipments', records.map(r => ({
        companyId: r.companyId, invoiceNumber: r.invoiceNumber,
        type: r.type, shipmentCategoryId: r.shipmentCategoryId || null,
        status: r.status,
        buyerName: r.buyerName || null, buyerAddress: r.buyerAddress || null,
        buyerPhone: r.buyerPhone || null, recipientInfo: r.recipientInfo || null,
        shippingCost: r.shippingCost, subtotal: r.subtotal, total: r.total,
        paymentProofUrls: JSON.stringify([]),
        paymentProofVerifiedBy: r.paymentProofVerifiedBy || null,
        paymentProofVerifiedAt: r.paymentProofVerifiedAt || null,
        expeditionName: r.expeditionName || null,
        courierResiNumber: r.courierResiNumber || null,
        courierResiImageUrl: null,
        notes: r.notes || null, cancelledReason: r.cancelledReason || null,
        createdBy: r.createdBy || null,
        createdAt: r.createdAt || now, updatedAt: r.updatedAt || now,
      })));

      const invoices = records.map(r => `'${r.invoiceNumber}'`).join(', ');
      return sel(`SELECT id, "invoiceNumber" FROM "ManualShipments" WHERE "invoiceNumber" IN (${invoices}) ORDER BY id`);
    };

    const ids1 = await insertAndGetIds(def1.shipments);
    const ids2 = await insertAndGetIds(def2.shipments);

    const buildItemRows = (ids, itemSets) => ids.flatMap((row, i) => {
      const set = itemSets[i] || [];
      return set.map(it => ({
        shipmentId: row.id,
        productId: it.productId || null,
        productSkuId: it.productSkuId || null,
        productName: it.productName,
        variantName: it.variantName || null,
        productImageUrl: null,
        sku: it.sku || null,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        subtotal: it.subtotal,
        createdAt: now, updatedAt: now,
      }));
    });

    const allItems = [
      ...buildItemRows(ids1, def1.itemSets || []),
      ...buildItemRows(ids2, def2.itemSets || []),
    ];
    if (allItems.length) {
      await queryInterface.bulkInsert('ManualShipmentItems', allItems);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. STOCK TRANSFERS
    // ─────────────────────────────────────────────────────────────────────────
    const insertTransfers = async (cid, whs, skus, userId) => {
      if (whs.length < 2 || !skus.length || !userId) return;

      const wh0 = whs[0].id;
      const wh1 = whs[1].id;
      const sku0 = skus[0];
      const sku1 = skus[1] || skus[0];

      await run(`
        DELETE FROM "StockTransferItems"
        WHERE "transferId" IN (SELECT id FROM "StockTransfers" WHERE "companyId" = ${cid})
      `);
      await run(`DELETE FROM "StockTransfers" WHERE "companyId" = ${cid}`);

      await queryInterface.bulkInsert('StockTransfers', [
        {
          companyId: cid, fromWarehouseId: wh0, toWarehouseId: wh1,
          transferType: 'TRANSFER',
          note: 'Transfer stok rutin antar gudang',
          date: '2026-06-05',
          createdBy: userId, createdAt: now, updatedAt: now,
        },
        {
          companyId: cid, fromWarehouseId: wh1, toWarehouseId: wh0,
          transferType: 'TRANSFER',
          note: 'Rebalancing stok awal bulan',
          date: '2026-06-10',
          createdBy: userId, createdAt: now, updatedAt: now,
        },
        {
          companyId: cid, fromWarehouseId: wh0, toWarehouseId: wh1,
          transferType: 'TRANSFER',
          note: null,
          date: '2026-06-15',
          createdBy: userId, createdAt: now, updatedAt: now,
        },
      ]);

      const transfers = await sel(`SELECT id FROM "StockTransfers" WHERE "companyId" = ${cid} ORDER BY id`);

      const itemRows = [];
      if (transfers[0]) {
        itemRows.push(
          { transferId: transfers[0].id, productSkuId: sku0.id, quantity: 10, createdAt: now, updatedAt: now },
          { transferId: transfers[0].id, productSkuId: sku1.id, quantity: 5,  createdAt: now, updatedAt: now },
        );
      }
      if (transfers[1]) {
        itemRows.push(
          { transferId: transfers[1].id, productSkuId: sku1.id, quantity: 8, createdAt: now, updatedAt: now },
        );
      }
      if (transfers[2]) {
        itemRows.push(
          { transferId: transfers[2].id, productSkuId: sku0.id, quantity: 15, createdAt: now, updatedAt: now },
          { transferId: transfers[2].id, productSkuId: sku1.id, quantity: 3,  createdAt: now, updatedAt: now },
        );
      }
      if (itemRows.length) await queryInterface.bulkInsert('StockTransferItems', itemRows);
    };

    await insertTransfers(cid1, whs1, skus1, adminId1 || staffId1);
    await insertTransfers(cid2, whs2, skus2, adminId2 || staffId2);

    // ─────────────────────────────────────────────────────────────────────────
    // 4. VENDORS + VENDOR DELIVERIES (Surat Jalan)
    // ─────────────────────────────────────────────────────────────────────────
    const insertVendorDeliveries = async (cid, userId) => {
      if (!userId) return;

      // Seed vendors for this company if none exist
      await run(`DELETE FROM "VendorDeliveryItems" WHERE "deliveryId" IN (SELECT id FROM "VendorDeliveries" WHERE "companyId" = ${cid})`);
      await run(`DELETE FROM "VendorDeliveries" WHERE "companyId" = ${cid}`);
      await run(`DELETE FROM "Vendors" WHERE "companyId" = ${cid}`);

      await queryInterface.bulkInsert('Vendors', [
        { name: 'PT Garmen Nusantara', vendorCode: `VND-${cid}-001`, companyId: cid, createdAt: now, updatedAt: now },
        { name: 'CV Tekstil Makmur',   vendorCode: `VND-${cid}-002`, companyId: cid, createdAt: now, updatedAt: now },
        { name: 'UD Bahan Kain Jaya',  vendorCode: `VND-${cid}-003`, companyId: cid, createdAt: now, updatedAt: now },
      ]);

      // Resolve vendors for this company
      const vendors = await sel(`SELECT id FROM "Vendors" WHERE "companyId" = ${cid} ORDER BY id LIMIT 3`);
      if (!vendors.length) return;

      await run(`
        DELETE FROM "VendorDeliveryItems"
        WHERE "deliveryId" IN (SELECT id FROM "VendorDeliveries" WHERE "companyId" = ${cid})
      `);
      await run(`DELETE FROM "VendorDeliveries" WHERE "companyId" = ${cid}`);

      const v0 = vendors[0].id;
      const v1 = (vendors[1] || vendors[0]).id;

      await queryInterface.bulkInsert('VendorDeliveries', [
        {
          companyId: cid, vendorId: v0,
          date: '2026-06-01', sjNumber: `SJ-${cid}-001`,
          sjPhotos: JSON.stringify([]),
          videoLink: null, notes: 'Pengiriman pertama bulan Juni',
          selisihStatus: null, status: 'closed',
          createdBy: userId, createdAt: now, updatedAt: now,
        },
        {
          companyId: cid, vendorId: v1,
          date: '2026-06-08', sjNumber: `SJ-${cid}-002`,
          sjPhotos: JSON.stringify([]),
          videoLink: null, notes: null,
          selisihStatus: 'ok', status: 'closed',
          createdBy: userId, createdAt: now, updatedAt: now,
        },
        {
          companyId: cid, vendorId: v0,
          date: '2026-06-16', sjNumber: `SJ-${cid}-003`,
          sjPhotos: JSON.stringify([]),
          videoLink: null, notes: 'Cek item dengan teliti',
          selisihStatus: null, status: 'open',
          createdBy: userId, createdAt: now, updatedAt: now,
        },
      ]);
    };

    await insertVendorDeliveries(cid1, adminId1 || staffId1);
    await insertVendorDeliveries(cid2, adminId2 || staffId2);

    console.log('✓ Seed selesai: ShipmentCategories, ManualShipments, StockTransfers, VendorDeliveries');
  },

  async down(queryInterface) {
    const db = queryInterface.sequelize;
    const sel = async (sql) => { const [rows] = await db.query(sql); return rows; };

    const cos = await sel(`SELECT id FROM "Companies" WHERE slug IN ('preface-demo','preface-demo-2')`);
    if (!cos.length) return;
    const ids = cos.map(c => c.id).join(',');

    await db.query(`
      DELETE FROM "ManualShipmentItems"
      WHERE "shipmentId" IN (SELECT id FROM "ManualShipments" WHERE "companyId" IN (${ids}))
    `);
    await db.query(`DELETE FROM "ManualShipments"     WHERE "companyId" IN (${ids})`);
    await db.query(`DELETE FROM "ShipmentCategories"  WHERE "companyId" IN (${ids})`);
    await db.query(`
      DELETE FROM "StockTransferItems"
      WHERE "transferId" IN (SELECT id FROM "StockTransfers" WHERE "companyId" IN (${ids}))
    `);
    await db.query(`DELETE FROM "StockTransfers" WHERE "companyId" IN (${ids})`);
    await db.query(`
      DELETE FROM "VendorDeliveryItems"
      WHERE "deliveryId" IN (SELECT id FROM "VendorDeliveries" WHERE "companyId" IN (${ids}))
    `);
    await db.query(`DELETE FROM "VendorDeliveries" WHERE "companyId" IN (${ids})`);
    await db.query(`DELETE FROM "Vendors"           WHERE "companyId" IN (${ids})`);
  },
};
