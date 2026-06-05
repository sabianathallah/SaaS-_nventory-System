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

            if (req.query.name) {
                const term = req.query.name.replace(/'/g, "''");
                filter[Op.or] = [
                    { name: { [Op.iLike]: `%${term}%` } },
                    sequelize.where(
                        sequelize.literal(`(SELECT COUNT(*) FROM "ProductSKUs" WHERE "ProductSKUs"."ProductId" = "Product"."id" AND "ProductSKUs"."sku_code" ILIKE '%${term}%')`),
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

            // Warehouse filter — products that have stock in the given warehouse
            const warehouseId = req.query.WarehouseId ? parseInt(req.query.WarehouseId) : null;
            const extraWhere  = warehouseId
                ? { [Op.and]: sequelize.literal(`EXISTS (SELECT 1 FROM "Stocks" s WHERE s."ProductId" = "Product"."id" AND s."WarehouseId" = ${warehouseId})`) }
                : {};

            // When filtering by warehouse, totalStock reflects only that warehouse's stock
            const stockSubquery = warehouseId
                ? `(SELECT COALESCE(SUM(s."quantity"),0) FROM "Stocks" s WHERE s."ProductId" = "Product"."id" AND s."WarehouseId" = ${warehouseId})`
                : `(SELECT COALESCE(SUM(s."quantity"),0) FROM "Stocks" s WHERE s."ProductId" = "Product"."id")`;

            const { rows, count } = await Product.findAndCountAll({
                where: { ...companyFilter(req), ...filter, ...extraWhere },
                attributes: {
                    include: [
                        [sequelize.literal(stockSubquery), 'totalStock'],
                        [sequelize.literal(`(SELECT COALESCE(SUM(sku."qty" * sku."price"), 0) FROM "ProductSKUs" sku WHERE sku."ProductId" = "Product"."id")`), 'totalValue'],
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
                        sequelize.literal('(SELECT COALESCE(SUM("Stocks"."quantity"),0) FROM "Stocks" WHERE "Stocks"."ProductId" = "Product"."id")'),
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
