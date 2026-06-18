'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/manualShipmentController');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');
const { uploadSingle } = require('../helpers/cloudinary');

const canView            = rpAny('shipping.manual.manage', 'shipping.manual.view', 'shipping.manual.create');
const canCreate          = rpAny('shipping.manual.manage', 'shipping.manual.create');
const canEdit            = rpAny('shipping.manual.manage', 'shipping.manual.edit');
const canCancel          = rpAny('shipping.manual.manage', 'shipping.manual.cancel', 'shipping.manual.approve_payment');
const canApprovePayment  = rpAny('shipping.manual.manage', 'shipping.manual.approve_payment');
const canUploadResi      = rpAny('shipping.manual.manage', 'shipping.manual.upload_resi');
const canDelete          = rpAny('shipping.manual.manage', 'shipping.manual.delete');

const uploadProof = uploadSingle('paymentProof', 'saas-inventory/shipping/payment-proofs');
const uploadResi  = uploadSingle('courierResiImage', 'saas-inventory/shipping/resi');

router.get('/expedition-presets',          canView,           ctrl.expeditionPresets);
router.get('/',                            canView,           ctrl.list);
router.get('/:id',                         canView,           ctrl.get);
router.post('/',                           canCreate,         ctrl.create);
router.put('/:id',                         canEdit,           ctrl.update);
router.patch('/:id/status',                canCancel,         ctrl.changeStatus);
router.post('/:id/payment-proof', uploadProof, canApprovePayment, ctrl.uploadPaymentProof);
router.post('/:id/courier-resi',  uploadResi,  canUploadResi,     ctrl.uploadCourierResi);
router.delete('/:id',                      canDelete,         ctrl.destroy);

module.exports = router;
