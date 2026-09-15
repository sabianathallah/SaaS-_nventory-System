'use strict';
const { Stock_Opname_Session } = require('../models');

module.exports = async (req, res, next) => {
  try {
    const warehouseId = req.body.WarehouseId ?? req.body.warehouseId;
    if (!warehouseId) return next();

    const active = await Stock_Opname_Session.findOne({
      where: {
        warehouseId,
        status: 'open',
        companyId: req.user.companyId ?? null,
      },
    });

    if (active) {
      return res.status(409).json({
        message: `Gudang ini sedang dalam sesi opname #${active.id}. Selesaikan atau batalkan opname sebelum melakukan transaksi stok.`,
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};
