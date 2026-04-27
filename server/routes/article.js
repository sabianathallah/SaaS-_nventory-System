'use strict';
const express = require('express');
const router = express.Router();
const ArticleController = require('../controllers/articleController');

router.get('/',    ArticleController.getAll);
router.get('/:id', ArticleController.getById);
router.post('/',   ArticleController.create);
router.put('/:id', ArticleController.update);
router.delete('/:id', ArticleController.delete);

module.exports = router;
