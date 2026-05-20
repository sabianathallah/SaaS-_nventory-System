'use strict';
const { Product, ProductSKU, ProductVariantOption, ProductVariantType, ProductSKUVariantOption } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');

function generateSkuCode(productName, options = []) {
  const base = productName
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .map((w) => w.substring(0, 3).toUpperCase())
    .join('');
  if (!options.length) return `${base}-${Date.now().toString(36).toUpperCase()}`;
  const suffix = options.map((o) => o.value.replace(/\s+/g, '').toUpperCase()).join('-');
  return `${base}-${suffix}`;
}

class ProductSkuController {
  // GET /products/:productId/skus
  static async getSkus(req, res, next) {
    try {
      const product = await Product.findOne({ where: { id: req.params.productId, ...companyFilter(req) } });
      if (!product) throw { name: 'NotFound', message: 'Product not found' };

      const skus = await ProductSKU.findAll({
        where: { ProductId: req.params.productId },
        include: [{
          model: ProductVariantOption,
          through: { attributes: [] },
          include: [{ model: ProductVariantType, attributes: ['id', 'name'] }],
        }],
        order: [['createdAt', 'ASC']],
      });

      res.status(200).json(skus.map(s => s.toJSON()));
    } catch (err) { next(err); }
  }

  // POST /products/:productId/skus
  // body: { sku_code?, price, qty, variantOptionIds?: [] }
  static async createSku(req, res, next) {
    try {
      const product = await Product.findOne({ where: { id: req.params.productId, ...companyFilter(req) } });
      if (!product) throw { name: 'NotFound', message: 'Product not found' };

      const { price = 0, qty = 0, variantOptionIds = [] } = req.body;
      let { sku_code } = req.body;

      // Resolve options for auto SKU generation
      let options = [];
      if (variantOptionIds.length > 0) {
        options = await ProductVariantOption.findAll({ where: { id: variantOptionIds } });
        if (options.length !== variantOptionIds.length) {
          throw { name: 'BadRequest', message: 'One or more variant option IDs are invalid' };
        }
      }

      if (!sku_code) sku_code = generateSkuCode(product.name, options);

      const sku = await ProductSKU.create({
        ProductId: product.id,
        sku_code,
        price,
        qty,
        companyId: companyId(req),
      });

      // Link to variant options
      if (options.length > 0) {
        const links = options.map((o) => ({
          ProductSKUId: sku.id,
          ProductVariantOptionId: o.id,
        }));
        await ProductSKUVariantOption.bulkCreate(links);
      }

      // Return with options included
      const result = await ProductSKU.findByPk(sku.id, {
        include: [{
          model: ProductVariantOption,
          through: { attributes: [] },
          include: [{ model: ProductVariantType, attributes: ['id', 'name'] }],
        }],
      });
      res.status(201).json(result);
    } catch (err) { next(err); }
  }

  // PUT /products/:productId/skus/:skuId
  // body: { sku_code?, price?, qty? }
  static async updateSku(req, res, next) {
    try {
      const sku = await ProductSKU.findOne({
        where: { id: req.params.skuId, ProductId: req.params.productId },
      });
      if (!sku) throw { name: 'NotFound', message: 'SKU not found' };

      const { sku_code, price, qty } = req.body;
      const updates = {};
      if (sku_code !== undefined) updates.sku_code = sku_code;
      if (price   !== undefined) updates.price    = price;
      if (qty     !== undefined) updates.qty      = qty;

      await sku.update(updates);

      const result = await ProductSKU.findByPk(sku.id, {
        include: [{
          model: ProductVariantOption,
          through: { attributes: [] },
          include: [{ model: ProductVariantType, attributes: ['id', 'name'] }],
        }],
      });
      res.status(200).json(result);
    } catch (err) { next(err); }
  }

  // DELETE /products/:productId/skus/:skuId
  static async deleteSku(req, res, next) {
    try {
      const sku = await ProductSKU.findOne({
        where: { id: req.params.skuId, ProductId: req.params.productId },
      });
      if (!sku) throw { name: 'NotFound', message: 'SKU not found' };
      await sku.destroy();
      res.status(200).json({ message: 'SKU deleted successfully' });
    } catch (err) { next(err); }
  }
}

module.exports = ProductSkuController;
