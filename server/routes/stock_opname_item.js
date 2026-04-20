const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({ resource: "stock_opname_items" });
});

module.exports = router;
