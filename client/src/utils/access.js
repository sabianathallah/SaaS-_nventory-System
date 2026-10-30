// Izin yang membuka modul Inventory (Dashboard dkk). User tanpa satu pun (mis. kasir) tidak melihat modul ini.
export const INVENTORY_ACCESS = [
  'inventory.view', 'inventory.manage', 'inventory.product.create', 'inventory.product.edit',
  'stock.in.view', 'stock.out.view', 'stock.view', 'stock.opname.view', 'stock.transfer.view',
  'shipping.manual.view', 'shipping.manual.create', 'shipping.manual.edit',
  'packing.manage', 'packing.incoming', 'packing.jobs', 'packing.view',
  'handover.view', 'db_link.view', 'reports.manage',
  'dashboard.manage', 'dashboard.view_stock', 'dashboard.view_value', 'dashboard.view_analytics', 'dashboard.view_movements',
]
