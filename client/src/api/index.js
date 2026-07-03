import api from './axios'

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (data) => api.post('/login', data)

// ── Generic paginated fetcher ─────────────────────────────────────────────────
const list   = (url) => (params) => api.get(url, { params }).then(r => r.data)
const get    = (url) => (id)     => api.get(`${url}/${id}`).then(r => r.data)
const create = (url) => (data)   => api.post(url, data).then(r => r.data)
const update = (url) => (id, data) => api.put(`${url}/${id}`, data).then(r => r.data)
const remove = (url) => (id)     => api.delete(`${url}/${id}`).then(r => r.data)
const crud   = (url) => ({ list: list(url), get: get(url), create: create(url), update: update(url), remove: remove(url) })

// Convert an object (possibly containing a File) into FormData when an image
// is attached; otherwise fall back to plain JSON. Axios sets the right
// Content-Type automatically when given a FormData instance.
const toPayload = (data) => {
  if (!data || typeof data !== 'object') return data
  if (data instanceof FormData) return data
  const hasFile = Object.values(data).some(value => value instanceof File)
  if (!hasFile) return data
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue
    fd.append(k, v)
  }
  return fd
}

// ── Resources ─────────────────────────────────────────────────────────────────
export const dashboardApi  = { getStats: (params) => api.get('/dashboard/stats', { params }).then(r => r.data) }
export const categoriesApi = crud('/categories')
export const articlesApi   = crud('/articles')

export const productsApi = {
  ...crud('/products'),
  create: (data)     => api.post('/products', toPayload(data)).then(r => r.data),
  update: (id, data) => api.put(`/products/${id}`, toPayload(data)).then(r => r.data),
}

export const productVariantsApi = {
  getTypes:     (pid)           => api.get(`/products/${pid}/variant-types`).then(r => r.data),
  createType:   (pid, data)     => api.post(`/products/${pid}/variant-types`, data).then(r => r.data),
  deleteType:   (pid, tid)      => api.delete(`/products/${pid}/variant-types/${tid}`).then(r => r.data),
  createOption:  (pid, tid, data)  => api.post(`/products/${pid}/variant-types/${tid}/options`, data).then(r => r.data),
  deleteOption:  (pid, tid, oid)   => api.delete(`/products/${pid}/variant-types/${tid}/options/${oid}`).then(r => r.data),
  reorderOptions:(pid, tid, order) => api.patch(`/products/${pid}/variant-types/${tid}/options/reorder`, { order }).then(r => r.data),
  reorderTypes:  (pid, order)      => api.patch(`/products/${pid}/variant-types/reorder`, { order }).then(r => r.data),
}

export const productSkusApi = {
  list:   (pid, warehouseId) => api.get(`/products/${pid}/skus`, { params: warehouseId ? { WarehouseId: warehouseId } : {} }).then(r => r.data),
  create: (pid, data)   => api.post(`/products/${pid}/skus`, data).then(r => r.data),
  update: (pid, sid, d) => api.put(`/products/${pid}/skus/${sid}`, d).then(r => r.data),
  delete: (pid, sid)    => api.delete(`/products/${pid}/skus/${sid}`).then(r => r.data),
}
export const warehousesApi     = crud('/warehouses')
export const suppliersApi      = crud('/suppliers')
export const stocksApi              = crud('/stocks')
export const skuWarehouseStocksApi  = {
  list: (params) => api.get('/sku-warehouse-stocks', { params }).then(r => r.data),
}
export const stockInApi = {
  ...crud('/stock-in-headers'),
  resolveSku: (code)              => api.get('/stock-in-headers/resolve-sku', { params: { code } }).then(r => r.data),
  addItem:    (id, data)          => api.post(`/stock-in-headers/${id}/items`, data).then(r => r.data),
  updateItem: (id, itemId, data)  => api.put(`/stock-in-headers/${id}/items/${itemId}`, data).then(r => r.data),
  removeItem: (id, itemId)        => api.delete(`/stock-in-headers/${id}/items/${itemId}`).then(r => r.data),
}
export const stockOutApi       = crud('/stock-out-headers')
export const stockInDraftApi = {
  current:    ()                   => api.get('/stock-in-drafts/current').then(r => r.data),
  get:        (id)                 => api.get(`/stock-in-drafts/${id}`).then(r => r.data),
  create:     ()                   => api.post('/stock-in-drafts').then(r => r.data),
  ensure:     ()                   => api.post('/stock-in-drafts/ensure').then(r => r.data),
  update:     (id, data)           => api.put(`/stock-in-drafts/${id}`, data).then(r => r.data),
  addItem:    (id, data)           => api.post(`/stock-in-drafts/${id}/items`, data).then(r => r.data),
  updateItem: (id, itemId, data)   => api.put(`/stock-in-drafts/${id}/items/${itemId}`, data).then(r => r.data),
  removeItem: (id, itemId)         => api.delete(`/stock-in-drafts/${id}/items/${itemId}`).then(r => r.data),
  submit:     (id, data)           => api.post(`/stock-in-drafts/${id}/submit`, data).then(r => r.data),
  cancel:     (id)                 => api.delete(`/stock-in-drafts/${id}`).then(r => r.data),
}
export const stockOutDraftApi = {
  current:    ()                   => api.get('/stock-out-drafts/current').then(r => r.data),
  get:        (id)                 => api.get(`/stock-out-drafts/${id}`).then(r => r.data),
  create:     ()                   => api.post('/stock-out-drafts').then(r => r.data),
  ensure:     ()                   => api.post('/stock-out-drafts/ensure').then(r => r.data),
  update:     (id, data)           => api.put(`/stock-out-drafts/${id}`, data).then(r => r.data),
  addItem:    (id, data)           => api.post(`/stock-out-drafts/${id}/items`, data).then(r => r.data),
  updateItem: (id, itemId, data)   => api.put(`/stock-out-drafts/${id}/items/${itemId}`, data).then(r => r.data),
  removeItem: (id, itemId)         => api.delete(`/stock-out-drafts/${id}/items/${itemId}`).then(r => r.data),
  submit:     (id, data)           => api.post(`/stock-out-drafts/${id}/submit`, data).then(r => r.data),
  cancel:     (id)                 => api.delete(`/stock-out-drafts/${id}`).then(r => r.data),
}
export const movementsApi = {
  ...crud('/stock-movements'),
  summary: (params) => api.get('/stock-movements/summary', { params }).then(r => r.data),
  chart:   (params) => api.get('/stock-movements/chart',   { params }).then(r => r.data),
  exportCsv: (params) => api.get('/stock-movements/export/csv', { params, responseType: 'blob' }).then(r => r.data),
}
export const opnameSessionsApi = crud('/stock-opname-sessions')
export const opnameItemsApi    = crud('/stock-opname-items')
export const usersApi          = crud('/users')
export const companiesApi      = {
  ...crud('/companies'),
  create: (data) => api.post('/companies', toPayload(data)).then(r => r.data),
  update: (id, data) => api.put(`/companies/${id}`, toPayload(data)).then(r => r.data),
}

// ── Packing Module ────────────────────────────────────────────────────────────
export const vendorsApi = crud('/vendors')

export const incomingGoodsApi = {
  ...crud('/incoming-goods'),
  confirmVendor:    (id, data) => api.post(`/incoming-goods/${id}/confirm-vendor`, data).then(r => r.data),
  notifyProduction: (id, data) => api.post(`/incoming-goods/${id}/notify-production`, data).then(r => r.data),
  complete:         (id)       => api.post(`/incoming-goods/${id}/complete`).then(r => r.data),
  updateItem:       (id, itemId, data) => api.put(`/incoming-goods/${id}/items/${itemId}`, data).then(r => r.data),
}


export const packingJobsApi = {
  list:       (params)     => api.get('/packing-jobs', { params }).then(r => r.data),
  get:        (id)         => api.get(`/packing-jobs/${id}`).then(r => r.data),
  create:     (data)       => api.post('/packing-jobs', data).then(r => r.data),
  start:      (id)         => api.post(`/packing-jobs/${id}/start`).then(r => r.data),
  submit:     (id, data)   => api.post(`/packing-jobs/${id}/submit`, data).then(r => r.data),
  verify:     (id, data)   => api.post(`/packing-jobs/${id}/verify`, data).then(r => r.data),
  getWorkers: (params)     => api.get('/packing-jobs/workers', { params }).then(r => r.data),
}

export const formAnakPackingApi = {
  list: (params) => api.get('/form-anak-packing', { params }).then(r => r.data),
  get:  (id)     => api.get(`/form-anak-packing/${id}`).then(r => r.data),
}

export const permissionsApi = {
  getAll: () => api.get('/permissions').then(r => r.data),
}

export const handoverApi = {
  list:       (params)     => api.get('/handovers', { params }).then(r => r.data),
  get:        (id)         => api.get(`/handovers/${id}`).then(r => r.data),
  create:     (data)       => api.post('/handovers', data).then(r => r.data),
  update:     (id, data)   => api.put(`/handovers/${id}`, data).then(r => r.data),
  destroy:    (id)         => api.delete(`/handovers/${id}`).then(r => r.data),
  close:      (id)         => api.patch(`/handovers/${id}/close`).then(r => r.data),
  reopen:     (id)         => api.patch(`/handovers/${id}/reopen`).then(r => r.data),
  addResi:          (id, resi)   => api.post(`/handovers/${id}/items`, { resi }).then(r => r.data),
  removeResi:       (id, itemId) => api.delete(`/handovers/${id}/items/${itemId}`).then(r => r.data),
  setAttachmentUrl: (id, url) => api.post(`/handovers/${id}/attachment`, { url }).then(r => r.data),
  deleteAttachment: (id)     => api.delete(`/handovers/${id}/attachment`).then(r => r.data),
}

export const vendorDeliveriesApi = {
  list:       (params)            => api.get('/vendor-deliveries', { params }).then(r => r.data),
  get:        (id)                => api.get(`/vendor-deliveries/${id}`).then(r => r.data),
  create:     (data)              => api.post('/vendor-deliveries', toPayload(data)).then(r => r.data),
  update:     (id, data)          => api.put(`/vendor-deliveries/${id}`, toPayload(data)).then(r => r.data),
  remove:     (id)                => api.delete(`/vendor-deliveries/${id}`).then(r => r.data),
  addItem:           (id, data)         => api.post(`/vendor-deliveries/${id}/items`, data).then(r => r.data),
  updateItem:        (id, itemId, data) => api.put(`/vendor-deliveries/${id}/items/${itemId}`, data).then(r => r.data),
  removeItem:        (id, itemId)       => api.delete(`/vendor-deliveries/${id}/items/${itemId}`).then(r => r.data),
  patchSelisihStatus:(id, status)       => api.patch(`/vendor-deliveries/${id}/selisih-status`, { status }).then(r => r.data),
  patchStatus:       (id, status)       => api.patch(`/vendor-deliveries/${id}/status`, { status }).then(r => r.data),
  analytics:         (params)           => api.get('/vendor-deliveries/analytics', { params }).then(r => r.data),
}

export const rolesApi = {
  getAll:        (params)                    => api.get('/roles', { params }).then(r => r.data),
  create:        (name, displayName)         => api.post('/roles', { name, displayName }).then(r => r.data),
  update:        (id, displayName, perms)    => api.put(`/roles/${id}`, { displayName, permissions: perms }).then(r => r.data),
  resetDefaults: (id)                        => api.post(`/roles/${id}/reset`).then(r => r.data),
  destroy:       (id)                        => api.delete(`/roles/${id}`).then(r => r.data),
}

export const dbLinksApi = {
  listFolders:  ()             => api.get('/db-folders').then(r => r.data),
  createFolder: (data)         => api.post('/db-folders', data).then(r => r.data),
  updateFolder: (id, data)     => api.put(`/db-folders/${id}`, data).then(r => r.data),
  deleteFolder: (id)           => api.delete(`/db-folders/${id}`).then(r => r.data),
  listLinks:    (folderId)     => api.get(`/db-folders/${folderId}/links`).then(r => r.data),
  createLink:   (folderId, d)  => api.post(`/db-folders/${folderId}/links`, d).then(r => r.data),
  updateLink:   (folderId, linkId, d) => api.put(`/db-folders/${folderId}/links/${linkId}`, d).then(r => r.data),
  deleteLink:   (folderId, linkId)    => api.delete(`/db-folders/${folderId}/links/${linkId}`).then(r => r.data),
}

export const systemApi = {
  getPageVisibility:    ()     => api.get('/system/page-visibility').then(r => r.data),
  updatePageVisibility: (data) => api.put('/system/page-visibility', data).then(r => r.data),
}

export const stockTransfersApi = {
  list:    (params) => api.get('/stock-transfers', { params }).then(r => r.data),
  get:     (id)     => api.get(`/stock-transfers/${id}`).then(r => r.data),
  create:  (data)   => api.post('/stock-transfers', data).then(r => r.data),
  destroy: (id)     => api.delete(`/stock-transfers/${id}`).then(r => r.data),
}

export const shipmentCategoriesApi = {
  list:    ()           => api.get('/shipment-categories').then(r => r.data),
  create:  (data)       => api.post('/shipment-categories', data).then(r => r.data),
  update:  (id, data)   => api.put(`/shipment-categories/${id}`, data).then(r => r.data),
  destroy: (id)         => api.delete(`/shipment-categories/${id}`).then(r => r.data),
}

export const manualShipmentsApi = {
  list:             (params)        => api.get('/manual-shipments', { params }).then(r => r.data),
  get:              (id)            => api.get(`/manual-shipments/${id}`).then(r => r.data),
  create:           (data)          => api.post('/manual-shipments', data).then(r => r.data),
  update:           (id, data)      => api.put(`/manual-shipments/${id}`, data).then(r => r.data),
  changeStatus:     (id, data)      => api.patch(`/manual-shipments/${id}/status`, data).then(r => r.data),
  uploadPaymentProof: (id, file)    => {
    const fd = new FormData(); fd.append('paymentProof', file)
    return api.post(`/manual-shipments/${id}/payment-proof`, fd).then(r => r.data)
  },
  uploadCourierResi: (id, data)     => {
    const fd = new FormData()
    if (data.courierResiNumber) fd.append('courierResiNumber', data.courierResiNumber)
    if (data.file instanceof File) fd.append('courierResiImage', data.file)
    return api.post(`/manual-shipments/${id}/courier-resi`, fd).then(r => r.data)
  },
  markPrinted:      (id, type)      => api.post(`/manual-shipments/${id}/mark-printed`, { type }).then(r => r.data),
  destroy:          (id)            => api.delete(`/manual-shipments/${id}`).then(r => r.data),
  expeditionPresets: ()             => api.get('/manual-shipments/expedition-presets').then(r => r.data),
}

export const requestTypeApi = {
  list:    ()          => api.get('/request-types').then(r => r.data),
  create:  (data)      => api.post('/request-types', data).then(r => r.data),
  update:  (id, data)  => api.put(`/request-types/${id}`, data).then(r => r.data),
  destroy: (id)        => api.delete(`/request-types/${id}`).then(r => r.data),
}

export const requestApi = {
  list:            (params)     => api.get('/requests',               { params }).then(r => r.data),
  statusCounts:    (params)     => api.get('/requests/status-counts', { params }).then(r => r.data),
  get:             (id)         => api.get(`/requests/${id}`).then(r => r.data),
  create:          (data)       => api.post('/requests', data).then(r => r.data),
  update:          (id, data)   => api.put(`/requests/${id}`, data).then(r => r.data),
  destroy:         (id)         => api.delete(`/requests/${id}`).then(r => r.data),
  approve:         (id, data)   => api.post(`/requests/${id}/approve`, data ?? {}).then(r => r.data),
  reject:          (id, reason) => api.post(`/requests/${id}/reject`, { reason }).then(r => r.data),
  processShipment: (id)         => api.post(`/requests/${id}/process-shipment`).then(r => r.data),
  markSent:        (id, data)   => api.patch(`/requests/${id}/sent`, data).then(r => r.data),
  markReturned:    (id, data)   => api.patch(`/requests/${id}/returned`, data).then(r => r.data),
  shipRemaining:   (id)         => api.patch(`/requests/${id}/ship-remaining`).then(r => r.data),
  markDone:        (id)         => api.patch(`/requests/${id}/done`).then(r => r.data),
  exportData:      (params)     => api.get('/requests/export', { params }).then(r => r.data),
}

export const reportApi = {
  monthly:       (params) => api.get('/reports/monthly',        { params }).then(r => r.data),
  daily:         (params) => api.get('/reports/daily',          { params }).then(r => r.data),
  yearly:        (params) => api.get('/reports/yearly',         { params }).then(r => r.data),
  snapshot:      (params) => api.get('/reports/snapshot',       { params }).then(r => r.data),
  dailyActivity: (params) => api.get('/reports/daily-activity', { params }).then(r => r.data),
}

export const profileApi = {
  get:            ()           => api.get('/me').then(r => r.data),
  update:         (data)       => {
    const fd = new FormData()
    if (data.name) fd.append('name', data.name)
    if (data.avatar instanceof File) fd.append('avatar', data.avatar)
    return api.patch('/me', fd).then(r => r.data)
  },
  deleteAvatar:   ()           => api.delete('/me/avatar').then(r => r.data),
  changePassword: (currentPassword, newPassword) =>
    api.patch('/me/password', { currentPassword, newPassword }).then(r => r.data),
}
