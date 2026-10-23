'use strict';
const express = require('express');
const router  = express.Router();
const C       = require('../controllers/posController');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');
const requireCompany = require('../middlewares/requireCompany');

const canSell   = rpAny('pos.manage', 'pos.sell');
const canEvent  = rpAny('pos.manage', 'pos.event.manage');
const canVoid   = rpAny('pos.manage', 'pos.void');
const canReport = rpAny('pos.manage', 'pos.report', 'pos.event.manage');
const canSee    = rpAny('pos.manage', 'pos.sell', 'pos.event.manage', 'pos.report', 'pos.fulfill');
const canFulfill = rpAny('pos.manage', 'pos.sell', 'pos.fulfill');

router.get('/events',             canSee,    C.listEvents);
router.post('/events',            canEvent,  requireCompany, C.createEvent);
router.get('/events/:id',         canSee,    C.getEvent);
router.put('/events/:id',         canEvent,  C.updateEvent);
router.get('/events/:id/catalog', canSell,   C.catalog);
router.get('/events/:id/report',  canReport, C.report);

router.get('/shifts',             canSee,    C.listShifts);
router.post('/shifts',            canSell,   C.openShift);
router.get('/shifts/:id',         canSell,   C.getShift);
router.patch('/shifts/:id/close', canSell,   C.closeShift);

router.get('/orders',             canSee,    C.listOrders);
router.post('/orders',            canSell,   C.createOrder);
router.get('/orders/:id',         canSee,    C.getOrder);
router.post('/orders/:id/void',   canVoid,   C.voidOrder);
router.patch('/orders/:id/pickup', canFulfill, C.setPickup);

module.exports = router;
