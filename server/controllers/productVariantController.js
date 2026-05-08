'use strict';
const { Product, ProductVariantType, ProductVariantOption } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');

// Express 5 nested routers don't always merge params — extract from URL as fallback
function pid(req) { return req.params.productId || req.originalUrl.match(/\/products\/(\d+)\//)?.[1]; }
function tid(req) { return req.params.typeId    || req.originalUrl.match(/\/variant-types\/(\d+)\//)?.[1]; }

class ProductVariantController {
  // GET /products/:productId/variant-types
  static async getVariantTypes(req, res, next) {
    try {
      const productId = pid(req);
      const product = await Product.findOne({ where: { id: productId, ...companyFilter(req) } });
      if (!product) throw { name: 'NotFound', message: 'Product not found' };

      const types = await ProductVariantType.findAll({
        where: { ProductId: productId },
        include: [{ model: ProductVariantOption, attributes: ['id', 'value', 'position'] }],
        order: [['position', 'ASC'], ['createdAt', 'ASC'], [ProductVariantOption, 'position', 'ASC']],
      });
      res.status(200).json(types);
    } catch (err) { next(err); }
  }

  // POST /products/:productId/variant-types
  static async createVariantType(req, res, next) {
    try {
      const productId = pid(req);
      const product = await Product.findOne({ where: { id: productId, ...companyFilter(req) } });
      if (!product) throw { name: 'NotFound', message: 'Product not found' };

      const variantType = await ProductVariantType.create({
        ProductId: product.id,
        name: req.body.name,
        companyId: companyId(req),
      });
      res.status(201).json(variantType);
    } catch (err) { next(err); }
  }

  // PUT /products/:productId/variant-types/:typeId
  static async updateVariantType(req, res, next) {
    try {
      const variantType = await ProductVariantType.findOne({
        where: { id: tid(req), ProductId: pid(req) },
      });
      if (!variantType) throw { name: 'NotFound', message: 'Variant type not found' };
      await variantType.update({ name: req.body.name });
      res.status(200).json(variantType);
    } catch (err) { next(err); }
  }

  // DELETE /products/:productId/variant-types/:typeId
  static async deleteVariantType(req, res, next) {
    try {
      const variantType = await ProductVariantType.findOne({
        where: { id: tid(req), ProductId: pid(req) },
      });
      if (!variantType) throw { name: 'NotFound', message: 'Variant type not found' };
      await variantType.destroy();
      res.status(200).json({ message: 'Variant type deleted successfully' });
    } catch (err) { next(err); }
  }

  // POST /products/:productId/variant-types/:typeId/options
  static async createVariantOption(req, res, next) {
    try {
      const variantType = await ProductVariantType.findOne({
        where: { id: tid(req), ProductId: pid(req) },
      });
      if (!variantType) throw { name: 'NotFound', message: 'Variant type not found' };

      const maxPosition = await ProductVariantOption.max('position', {
        where: { ProductVariantTypeId: variantType.id },
      });
      const option = await ProductVariantOption.create({
        ProductVariantTypeId: variantType.id,
        value: req.body.value,
        position: (maxPosition ?? -1) + 1,
      });
      res.status(201).json(option);
    } catch (err) { next(err); }
  }

  // PUT /products/:productId/variant-types/:typeId/options/:optionId
  static async updateVariantOption(req, res, next) {
    try {
      const option = await ProductVariantOption.findOne({
        where: { id: req.params.optionId, ProductVariantTypeId: req.params.typeId },
      });
      if (!option) throw { name: 'NotFound', message: 'Variant option not found' };
      await option.update({ value: req.body.value });
      res.status(200).json(option);
    } catch (err) { next(err); }
  }

  // DELETE /products/:productId/variant-types/:typeId/options/:optionId
  static async deleteVariantOption(req, res, next) {
    try {
      const option = await ProductVariantOption.findOne({
        where: { id: req.params.optionId, ProductVariantTypeId: req.params.typeId },
      });
      if (option) await option.destroy();
      res.status(200).json({ message: 'Variant option deleted successfully' });
    } catch (err) { next(err); }
  }

  // PATCH /products/:productId/variant-types/reorder
  // body: { order: [id, id, ...] }
  static async reorderTypes(req, res, next) {
    try {
      const productId = pid(req);
      const product = await Product.findOne({ where: { id: productId, ...companyFilter(req) } });
      if (!product) throw { name: 'NotFound', message: 'Product not found' };

      const { order } = req.body;
      if (!Array.isArray(order) || order.length === 0) {
        throw { name: 'BadRequest', message: 'order must be a non-empty array of ids' };
      }

      await Promise.all(
        order.map((id, index) =>
          ProductVariantType.update(
            { position: index },
            { where: { id, ProductId: productId } }
          )
        )
      );

      res.status(200).json({ message: 'Reordered successfully' });
    } catch (err) { next(err); }
  }

  // PATCH /products/:productId/variant-types/:typeId/options/reorder
  // body: { order: [id, id, id, ...] }
  static async reorderOptions(req, res, next) {
    try {
      const variantType = await ProductVariantType.findOne({
        where: { id: tid(req), ProductId: pid(req) },
      });
      if (!variantType) throw { name: 'NotFound', message: 'Variant type not found' };

      const { order } = req.body; // array of option ids in new order
      if (!Array.isArray(order) || order.length === 0) {
        throw { name: 'BadRequest', message: 'order must be a non-empty array of ids' };
      }

      await Promise.all(
        order.map((id, index) =>
          ProductVariantOption.update(
            { position: index },
            { where: { id, ProductVariantTypeId: variantType.id } }
          )
        )
      );

      res.status(200).json({ message: 'Reordered successfully' });
    } catch (err) { next(err); }
  }
}

module.exports = ProductVariantController;
