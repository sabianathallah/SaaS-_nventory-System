'use strict';
const express = require('express');
const router = express.Router();

const authentication = require('../middlewares/authentication');
const isAdmin = require('../middlewares/authorization');
const LoginController = require('../controllers/loginController');

const dashboardRouter      = require('./dashboard');
const companyRouter        = require('./company');
const categoryRouter       = require('./category');
const articleRouter        = require('./article');
const productRouter        = require('./product');
const productVariantRouter = require('./product_variant');
const productSkuRouter     = require('./product_sku');
const warehouseRouter = require('./warehouse');
const stockRouter = require('./stock');
const supplierRouter = require('./supplier');
const stockInHeaderRouter = require('./stock_in_header');
const stockOutHeaderRouter = require('./stock_out_header');
const stockMovementRouter = require('./stock_movement');
const stockOpnameSessionRouter = require('./stock_opname_session');
const stockOpnameItemRouter = require('./stock_opname_item');
const userRouter = require('./user');

const vendorRouter          = require('./vendor');
const incomingGoodsRouter   = require('./incoming_goods');
const suratJalanRouter      = require('./surat_jalan');
const packingJobRouter      = require('./packing_job');
const formAnakPackingRouter = require('./form_anak_packing');

// Public routes
router.post('/login', LoginController.login);
router.post('/refresh-token', LoginController.refreshToken);

// Protected routes
router.use(authentication);

router.use('/dashboard',  dashboardRouter);
router.use('/categories', categoryRouter);
router.use('/articles',   articleRouter);
router.use('/products',   productRouter);
router.use('/products/:productId/variant-types', productVariantRouter);
router.use('/products/:productId/skus',          productSkuRouter);
router.use('/warehouses', warehouseRouter);
router.use('/stocks', stockRouter);
router.use('/suppliers', supplierRouter);
router.use('/stock-in-headers', stockInHeaderRouter);
router.use('/stock-out-headers', stockOutHeaderRouter);
router.use('/stock-movements', stockMovementRouter);
router.use('/stock-opname-sessions', stockOpnameSessionRouter);
router.use('/stock-opname-items', stockOpnameItemRouter);

// Packing module routes
router.use('/vendors',            vendorRouter);
router.use('/incoming-goods',     incomingGoodsRouter);
router.use('/surat-jalan',        suratJalanRouter);
router.use('/packing-jobs',       packingJobRouter);
router.use('/form-anak-packing',  formAnakPackingRouter);

// Admin only routes
router.use('/users', isAdmin, userRouter);
router.use('/companies', isAdmin, companyRouter);

module.exports = router;
