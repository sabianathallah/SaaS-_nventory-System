'use strict';
const router = require('express').Router();
const ctrl = require('../controllers/projectController');

// Projects are company-wide (cross-divisi), so viewing/creating needs no
// extra permission gate — editing/deleting is checked per-row inside the
// controller (owner/creator or a task admin), same pattern as task.js.
router.get('/',       ctrl.list);
router.get('/:id',    ctrl.show);
router.post('/',      ctrl.create);
router.put('/:id',    ctrl.update);
router.delete('/:id', ctrl.destroy);

module.exports = router;
