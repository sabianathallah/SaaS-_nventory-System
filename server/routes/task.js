'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/taskController');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');

// Every authenticated user can view/manage tasks they created or are assigned
// to (enforced inside the controller); tasks.view/edit/delete widen scope to
// all company tasks. No route-level gate on list/create/update/destroy for
// that reason — only comments piggyback on the same task-level check.
router.get('/',                ctrl.list);
router.post('/',               ctrl.create);
router.put('/:id',             ctrl.update);
router.delete('/:id',          ctrl.destroy);
router.get('/:id/comments',    ctrl.listComments);
router.post('/:id/comments',   ctrl.addComment);

module.exports = router;
