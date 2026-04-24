'use strict';
const { Product, Category } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');
const { destroyByUrl } = require('../helpers/cloudinary');

class ProductController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                name:       'like',
                sku:        'like',
                CategoryId: 'exact',
            });
            const { rows, count } = await Product.findAndCountAll({
                where: { ...companyFilter(req), ...filter },
                include: [{ model: Category, attributes: ['id', 'name'] }],
                order: [['name', 'ASC']],
                limit, offset,
                distinct: true
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const product = await Product.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                include: [{ model: Category, attributes: ['id', 'name'] }]
            });
            if (!product) throw { name: 'NotFound', message: 'Product not found' };
            res.status(200).json(product);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const payload = { ...req.body, companyId: companyId(req) };
            // FE treats barcode/qrString as optional — auto-fill from SKU so the
            // unique QR scan path still works.
            if (!payload.qrString) payload.qrString = payload.sku;
            if (!payload.barcode)  payload.barcode  = payload.sku;
            // Cloudinary middleware populates req.file when a photo is attached
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
