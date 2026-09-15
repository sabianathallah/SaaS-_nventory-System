'use strict';
const router = require('express').Router();
const ctrl = require('../controllers/task-list.controller');

// Personal lists — always scoped to req.user.id inside the controller, no
// permission gate needed (same rationale as task.js: everyone manages their
// own stuff, ownership check happens at the row level).
router.get('/',        ctrl.list);
router.post('/',       ctrl.create);
router.put('/:id',     ctrl.update);
router.delete('/:id',  ctrl.destroy);

module.exports = router;
