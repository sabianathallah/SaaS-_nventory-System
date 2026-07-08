'use strict';
const { Op } = require('sequelize');
const { SkuChannelStock, ProductSKU, Product, ProductVariantOption, Channel } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');

exports.list = async (req, res, next) => {
  try {
    const { ChannelId, ProductSKUId } = req.query;
    const where = { ...companyFilter(req) };
    if (ChannelId) where.ChannelId = ChannelId;
    if (ProductSKUId) {
      where.ProductSKUId = String(ProductSKUId).includes(',')
        ? { [Op.in]: String(ProductSKUId).split(',').map(Number) }
        : ProductSKUId;
    }

    const rows = await SkuChannelStock.findAll({
      where,
      include: [
        {
          model: ProductSKU,
          attributes: ['id', 'sku_code', 'price', 'ProductId'],
          include: [
            { model: Product, attributes: ['id', 'name', 'imageUrl'] },
            { model: ProductVariantOption, attributes: ['id', 'value'], through: { attributes: [] } },
          ],
        },
        { model: Channel, attributes: ['id', 'name'] },
      ],
      order: [['ProductSKUId', 'ASC']],
    });
    res.json(rows);
  } catch (err) { next(err); }
};

exports.upsert = async (req, res, next) => {
  try {
    const { ProductSKUId, ChannelId, isListed } = req.body;
    if (!ProductSKUId || !ChannelId) throw { name: 'BadRequest', message: 'ProductSKUId dan ChannelId wajib diisi' };

    const sku = await ProductSKU.findOne({ where: { id: ProductSKUId, ...companyFilter(req) } });
    if (!sku) throw { name: 'NotFound', message: 'Product SKU not found' };

    const [row] = await SkuChannelStock.findOrCreate({
      where: { ProductSKUId, ChannelId },
      defaults: { isListed: !!isListed, companyId: sku.companyId ?? companyId(req) },
    });
    await row.update({ isListed: !!isListed });
    res.status(200).json(row);
  } catch (err) { next(err); }
};
