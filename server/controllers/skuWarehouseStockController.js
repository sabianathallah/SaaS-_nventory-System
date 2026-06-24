'use strict';
const { SkuWarehouseStock, ProductSKU, Product, ProductVariantOption, Warehouse } = require('../models');
const { companyFilter } = require('../helpers/tenancy');

exports.list = async (req, res, next) => {
  try {
    const { WarehouseId } = req.query;
    const where = { ...companyFilter(req) };
    if (WarehouseId) where.WarehouseId = WarehouseId;

    const rows = await SkuWarehouseStock.findAll({
      where,
      include: [
        {
          model: ProductSKU,
          attributes: ['id', 'sku_code', 'price'],
          include: [
            { model: Product, attributes: ['id', 'name', 'imageUrl'] },
            { model: ProductVariantOption, attributes: ['id', 'value'], through: { attributes: [] } },
          ],
        },
        { model: Warehouse, attributes: ['id', 'name'] },
      ],
      order: [['ProductSKUId', 'ASC']],
    });
    res.json(rows);
  } catch (err) { next(err); }
};
