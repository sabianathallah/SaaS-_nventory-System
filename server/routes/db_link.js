'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/dbLinkController');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');
const rp = require('../middlewares/requirePermission');

const canView    = rpAny('db_link.manage', 'db_link.view', 'db_link.add_link');
const canManage  = rpAny('db_link.manage');
const canAddLink = rpAny('db_link.manage', 'db_link.add_link');

// Folders
router.get('/',          canView,   ctrl.listFolders);
router.post('/',         canManage, ctrl.createFolder);
router.put('/:id',       canManage, ctrl.updateFolder);
router.delete('/:id',    canManage, ctrl.deleteFolder);

// Links inside a folder
router.get('/:id/links',             canView,    ctrl.listLinks);
router.post('/:id/links',            canAddLink, ctrl.createLink);
router.put('/:id/links/:linkId',     canAddLink, ctrl.updateLink);
router.delete('/:id/links/:linkId',  canManage,  ctrl.deleteLink);

module.exports = router;
