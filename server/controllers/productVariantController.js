'use strict';
const { Product, ProductVariantType, ProductVariantOption } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');

class ProductVariantController {
  // GET /products/:productId/variant-types
  static async getVariantTypes(req, res, next) {
    try {
      const product = await Product.findOne({ where: { id: req.params.productId, ...companyFilter(req) } });
      if (!product) throw { name: 'NotFound', message: 'Product not found' };

      const types = await ProductVariantType.findAll({
        where: { ProductId: req.params.productId },
        include: [{ model: ProductVariantOption, attributes: ['id', 'value'] }],
        order: [['createdAt', 'ASC'], [ProductVariantOption, 'value', 'ASC']],
      });
      res.status(200).json(types);
    } catch (err) { next(err); }
  }

  // POST /products/:productId/variant-types
  static async createVariantType(req, res, next) {
    try {
      const product = await Product.findOne({ where: { id: req.params.productId, ...companyFilter(req) } });
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
        where: { id: req.params.typeId, ProductId: req.params.productId },
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
        where: { id: req.params.typeId, ProductId: req.params.productId },
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
        where: { id: req.params.typeId, ProductId: req.params.productId },
      });
      if (!variantType) throw { name: 'NotFound', message: 'Variant type not found' };

      const option = await ProductVariantOption.create({
        ProductVariantTypeId: variantType.id,
        value: req.body.value,
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
      if (!option) throw { name: 'NotFound', message: 'Variant option not found' };
      await option.destroy();
      res.status(200).json({ message: 'Variant option deleted successfully' });
    } catch (err) { next(err); }
  }
}

module.exports = ProductVariantController;
