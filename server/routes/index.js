'use strict';
const express = require('express');
const router = express.Router();

const authentication = require('../middlewares/authentication');
const isAdmin = require('../middlewares/authorization');
const LoginController = require('../controllers/loginController');

const companyRouter = require('./company');
const categoryRouter = require('./category');
const productRouter = require('./product');
const warehouseRouter = require('./warehouse');
const stockRouter = require('./stock');
const supplierRouter = require('./supplier');
const stockInHeaderRouter = require('./stock_in_header');
const stockOutHeaderRouter = require('./stock_out_header');
const stockMovementRouter = require('./stock_movement');
const stockOpnameSessionRouter = require('./stock_opname_session');
const stockOpnameItemRouter = require('./stock_opname_item');
const userRouter = require('./user');

// Public routes
router.post('/login', LoginController.login);
router.post('/refresh-token', LoginController.refreshToken);

// Protected routes
router.use(authentication);

router.use('/categories', categoryRouter);
router.use('/products', productRouter);
router.use('/warehouses', warehouseRouter);
router.use('/stocks', stockRouter);
router.use('/suppliers', supplierRouter);
router.use('/stock-in-headers', stockInHeaderRouter);
router.use('/stock-out-headers', stockOutHeaderRouter);
router.use('/stock-movements', stockMovementRouter);
router.use('/stock-opname-sessions', stockOpnameSessionRouter);
router.use('/stock-opname-items', stockOpnameItemRouter);

// Admin only routes
router.use('/users', isAdmin, userRouter);
router.use('/companies', isAdmin, companyRouter);

module.exports = router;
