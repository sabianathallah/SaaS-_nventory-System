'use strict';
const express = require('express');
const router = express.Router();
const CompanyController = require('../controllers/companyController');
const { uploadSingle } = require('../helpers/cloudinary');

router.get('/', CompanyController.getAll);
router.get('/:id', CompanyController.getById);
router.post('/', uploadSingle('logo', 'saas-inventory/companies'), CompanyController.create);
router.put('/:id', uploadSingle('logo', 'saas-inventory/companies'), CompanyController.update);
router.delete('/:id', CompanyController.delete);

module.exports = router;
