const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({ resource: "stock_in_headers" });
});

module.exports = router;
