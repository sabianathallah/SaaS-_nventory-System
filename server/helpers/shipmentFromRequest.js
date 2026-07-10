'use strict';
const { ManualShipment, ManualShipmentItem } = require('../models');
const manualShipmentCtrl = require('../controllers/manualShipmentController');

// Build a Shipping Manual draft from an approved Sales/Non-Sales pengajuan.
// Normally called after the staged Stock Out is submitted
// (stockOutDraftController.submit); with skippedStockOut=true it's the direct
// path from the pengajuan that bypasses Stock Out entirely — no Stock_Movement
// is recorded, so the shipment carries the flag for the detail page to warn.
// `request` must include requestType + items (with sku → Product).
async function createShipmentFromRequest(request, cid, userId, t, { skippedStockOut = false } = {}) {
  const shipmentType = request.requestType?.shipmentType === 'sales' ? 'sales' : 'non_sales';
  const invoiceNumber = await manualShipmentCtrl.generateInvoiceNumber(cid, t);

  let subtotal = 0;
  const itemsPayload = [];
  for (const item of request.items) {
    const skuPrice  = shipmentType === 'sales' ? Number(item.sku?.price ?? 0) : 0;
    const lineTotal = skuPrice * item.qty;
    subtotal += lineTotal;
    itemsPayload.push({
      productId:       item.sku?.ProductId ?? null,
      productSkuId:    item.ProductSKUId   ?? null,
      productName:     item.sku?.Product?.name ?? item.productName,
      variantName:     item.variantLabel    ?? null,
      sku:             item.sku?.sku_code   ?? null,
      productImageUrl: item.sku?.Product?.imageUrl ?? null,
      quantity:        item.qty,
      unitPrice:       skuPrice,
      subtotal:        lineTotal,
    });
  }

  const shipment = await ManualShipment.create({
    companyId:       cid,
    invoiceNumber,
    type:            shipmentType,
    status:          'draft',
    recipientName:    request.recipientName    || null,
    recipientPhone:   request.recipientPhone   || null,
    recipientAddress: request.recipientAddress || null,
    shippingCost:    0,
    subtotal,
    total:           subtotal,
    notes:           request.note || null,
    sourceRequestId: request.id,
    skippedStockOut,
    createdBy:       userId,
  }, { transaction: t });

  for (const item of itemsPayload) {
    await ManualShipmentItem.create({ shipmentId: shipment.id, ...item }, { transaction: t });
  }

  return shipment;
}

module.exports = { createShipmentFromRequest };
