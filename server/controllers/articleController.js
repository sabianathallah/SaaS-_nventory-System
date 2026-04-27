'use strict';
const { Article, Product, Category } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class ArticleController {
  static async getAll(req, res, next) {
    try {
      const { page, limit, offset } = paginate(req.query);
      const filter = buildFilter(req.query, { name: 'like' });
      const { rows, count } = await Article.findAndCountAll({
        where: { ...companyFilter(req), ...filter },
        order: [['name', 'ASC']],
        limit, offset,
        distinct: true,
      });
      res.status(200).json(paginatedResponse(rows, count, page, limit));
    } catch (err) { next(err); }
  }

  static async getById(req, res, next) {
    try {
      const article = await Article.findOne({
        where: { id: req.params.id, ...companyFilter(req) },
        include: [{
          model: Product,
          attributes: ['id', 'name', 'unit', 'imageUrl'],
          include: [{ model: Category, attributes: ['id', 'name'] }],
        }],
      });
      if (!article) throw { name: 'NotFound', message: 'Article not found' };
      res.status(200).json(article);
    } catch (err) { next(err); }
  }

  static async create(req, res, next) {
    try {
      const article = await Article.create({ ...req.body, companyId: companyId(req) });
      res.status(201).json(article);
    } catch (err) { next(err); }
  }

  static async update(req, res, next) {
    try {
      const article = await Article.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!article) throw { name: 'NotFound', message: 'Article not found' };
      await article.update(req.body);
      res.status(200).json(article);
    } catch (err) { next(err); }
  }

  static async delete(req, res, next) {
    try {
      const article = await Article.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!article) throw { name: 'NotFound', message: 'Article not found' };
      await article.destroy();
      res.status(200).json({ message: 'Article deleted successfully' });
    } catch (err) { next(err); }
  }
}

module.exports = ArticleController;
