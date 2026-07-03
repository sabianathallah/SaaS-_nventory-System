'use strict';
const { Op } = require('sequelize');
const { sequelize, Product, Category, Article, ProductVariantType, ProductVariantOption, ProductSKU, Stock } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');
const { destroyByUrl } = require('../helpers/cloudinary');

const VALID_SORT = ['name', 'createdAt', 'totalStock'];

class ProductController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                sku:        'like',
                CategoryId: 'exact',
                ArticleId:  'exact',
            });

            if (req.query.name || req.query.search) {
                const term = req.query.name || req.query.search;
                const escapedPattern = sequelize.escape(`%${term}%`);
                filter[Op.or] = [
                    { name: { [Op.iLike]: `%${term}%` } },
                    sequelize.where(
                        sequelize.literal(`(SELECT COUNT(*) FROM "ProductSKUs" WHERE "ProductSKUs"."ProductId" = "Product"."id" AND "ProductSKUs"."sku_code" ILIKE ${escapedPattern})`),
                        { [Op.gt]: 0 }
                    ),
                ];
            }

            // Sorting
            const sortBy    = VALID_SORT.includes(req.query.sortBy) ? req.query.sortBy : 'name';
            const sortOrder = req.query.sortOrder === 'desc' ? 'DESC' : 'ASC';
            const order = sortBy === 'totalStock'
                ? [[sequelize.literal('"totalStock"'), sortOrder]]
                : [[sortBy, sortOrder]];

            // WarehouseId only scopes totalStock/totalValue below — it no longer hides
            // products that have zero (or never-stocked) qty in that warehouse. Every
            // product belonging to the company shows in every warehouse view.
            const warehouseId = req.query.WarehouseId ? parseInt(req.query.WarehouseId) : null;

            // totalStock: always from SkuWarehouseStocks (the live per-warehouse ledger),
            // optionally scoped to a single warehouse. ProductSKU.qty is a legacy column
            // that stock movements no longer update — do not sum it.
            const stockSubquery = warehouseId
                ? `(SELECT COALESCE(SUM(sws."qty"),0) FROM "SkuWarehouseStocks" sws INNER JOIN "ProductSKUs" ps ON ps."id" = sws."ProductSKUId" WHERE ps."ProductId" = "Product"."id" AND sws."WarehouseId" = ${warehouseId})`
                : `(SELECT COALESCE(SUM(sws."qty"),0) FROM "SkuWarehouseStocks" sws INNER JOIN "ProductSKUs" ps ON ps."id" = sws."ProductSKUId" WHERE ps."ProductId" = "Product"."id")`;

            const valueSubquery = warehouseId
                ? `(SELECT COALESCE(SUM(sws."qty" * ps."price"),0) FROM "SkuWarehouseStocks" sws INNER JOIN "ProductSKUs" ps ON ps."id" = sws."ProductSKUId" WHERE ps."ProductId" = "Product"."id" AND sws."WarehouseId" = ${warehouseId})`
                : `(SELECT COALESCE(SUM(sws."qty" * ps."price"),0) FROM "SkuWarehouseStocks" sws INNER JOIN "ProductSKUs" ps ON ps."id" = sws."ProductSKUId" WHERE ps."ProductId" = "Product"."id")`;

            const { rows, count } = await Product.findAndCountAll({
                where: { ...companyFilter(req), ...filter },
                attributes: {
                    include: [
                        [sequelize.literal(stockSubquery), 'totalStock'],
                        [sequelize.literal(valueSubquery), 'totalValue'],
                    ],
                },
                include: [
                    { model: Category,   attributes: ['id', 'name'] },
                    { model: Article,    attributes: ['id', 'name'] },
                    { model: ProductSKU, attributes: ['id', 'sku_code', 'price', 'qty'] },
                    { model: ProductVariantType, attributes: ['id', 'name'],
                      include: [{ model: ProductVariantOption, attributes: ['id', 'value'] }] },
                ],
                order, limit, offset, distinct: true,
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const product = await Product.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                attributes: {
                    include: [[
                        sequelize.literal('(SELECT COALESCE(SUM(sws."qty"),0) FROM "SkuWarehouseStocks" sws INNER JOIN "ProductSKUs" ps ON ps."id" = sws."ProductSKUId" WHERE ps."ProductId" = "Product"."id")'),
                        'totalStock',
                    ]],
                },
                include: [
                    { model: Category, attributes: ['id', 'name'] },
                    { model: Article,  attributes: ['id', 'name'] },
                    {
                        model: ProductVariantType,
                        include: [{ model: ProductVariantOption, attributes: ['id', 'value'] }],
                    },
                    {
                        model: ProductSKU,
                        include: [{
                            model: ProductVariantOption,
                            through: { attributes: [] },
                            include: [{ model: ProductVariantType, attributes: ['id', 'name'] }],
                        }],
                    },
                ]
            });
            if (!product) throw { name: 'NotFound', message: 'Product not found' };
            res.status(200).json(product);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const payload = { ...req.body, companyId: companyId(req) };
            // SKU/barcode/qrString are managed at ProductSKU level — remove legacy fields
            delete payload.sku;
            delete payload.barcode;
            delete payload.qrString;
            delete payload.image; // not a DB column, only used as file upload key
            if (!payload.imageUrl) payload.imageUrl = null;
            if (req.file?.path) payload.imageUrl = req.file.path;
            const product = await Product.create(payload);
            res.status(201).json(product);
        } catch (err) {
            if (req.file?.path) destroyByUrl(req.file.path);
            next(err);
        }
    }

    static async update(req, res, next) {
        try {
            const product = await Product.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!product) throw { name: 'NotFound', message: 'Product not found' };
            const updates = { ...req.body };
            delete updates.sku;
            delete updates.barcode;
            delete updates.qrString;
            delete updates.image;
            let oldImage = null;
            if (req.file?.path) {
                oldImage = product.imageUrl;
                updates.imageUrl = req.file.path;
            } else if (updates.imageUrl === '' || updates.imageUrl === 'null') {
                // explicit "hapus gambar" from FE
                oldImage = product.imageUrl;
                updates.imageUrl = null;
            }
            await product.update(updates);
            if (oldImage) destroyByUrl(oldImage);
            res.status(200).json(product);
        } catch (err) {
            if (req.file?.path) destroyByUrl(req.file.path);
            next(err);
        }
    }

    static async delete(req, res, next) {
        try {
            const product = await Product.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!product) throw { name: 'NotFound', message: 'Product not found' };
            const oldImage = product.imageUrl;
            await product.destroy();
            if (oldImage) destroyByUrl(oldImage);
            res.status(200).json({ message: 'Product deleted successfully' });
        } catch (err) { next(err); }
    }
}

module.exports = ProductController;
