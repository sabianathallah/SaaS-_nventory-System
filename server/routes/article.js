'use strict';
const express = require('express');
const router = express.Router();
const ArticleController = require('../controllers/articleController');
const requireCompany    = require('../middlewares/requireCompany');

router.get('/',    ArticleController.getAll);
router.get('/:id', ArticleController.getById);
router.post('/',   requireCompany, ArticleController.create);
router.put('/:id', ArticleController.update);
router.delete('/:id', ArticleController.delete);

module.exports = router;
