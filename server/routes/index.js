const express = require("express");

const router = express.Router();

const userRouter = require("./user");
const categoryRouter = require("./category");
const productRouter = require("./product");
const stockRouter = require("./stock");
const supplierRouter = require("./supplier");
const warehouseRouter = require("./warehouse");
const stockInHeaderRouter = require("./stock_in_header");
const stockOutHeaderRouter = require("./stock_out_header");
const stockOpnameSessionRouter = require("./stock_opname_session");
const stockOpnameItemRouter = require("./stock_opname_item");
const stockMovementRouter = require("./stock_movement");

router.use("/users", userRouter);
router.use("/categories", categoryRouter);
router.use("/products", productRouter);
router.use("/stocks", stockRouter);
router.use("/suppliers", supplierRouter);
router.use("/warehouses", warehouseRouter);
router.use("/stock_in_headers", stockInHeaderRouter);
router.use("/stock_out_headers", stockOutHeaderRouter);
router.use("/stock_opname_sessions", stockOpnameSessionRouter);
router.use("/stock_opname_items", stockOpnameItemRouter);
router.use("/stock_movements", stockMovementRouter);

module.exports = router;
