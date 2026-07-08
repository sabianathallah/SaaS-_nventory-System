import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PageVisibilityProvider, usePageVisibility } from './context/PageVisibilityContext'
import { SelectedCompanyProvider } from './context/SelectedCompanyContext'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import NoPermission from './components/NoPermission'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SOP from './pages/SOP'
import Handbook from './pages/Handbook'
import HRIS from './pages/HRIS'
import HrisAttendance from './pages/hris/Attendance'
import HrisLeave from './pages/hris/Leave'
import HrisReports from './pages/hris/Reports'
import HrisShifts from './pages/hris/admin/Shifts'
import HrisAttendanceReview from './pages/hris/admin/AttendanceReview'
import HrisLocations from './pages/hris/admin/Locations'
import HrisLeaveQuota from './pages/hris/admin/LeaveQuota'
import HrisWfa from './pages/hris/Wfa'
import HrisLateExcuse from './pages/hris/LateExcuse'
import HrisRequests from './pages/hris/Requests'
import HrisWfaQuota from './pages/hris/admin/WfaQuota'
import HrisPaymentAdjustments from './pages/hris/PaymentAdjustments'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import ProductEdit from './pages/ProductEdit'
import Warehouses from './pages/Warehouses'
import WarehouseProducts from './pages/WarehouseProducts'
import Channels from './pages/Channels'
import Suppliers from './pages/Suppliers'
import StockIn from './pages/StockIn'
import StockInDetail from './pages/StockInDetail'
import StockOut from './pages/StockOut'
import StockOutDetail from './pages/StockOutDetail'
import Movements from './pages/Movements'
import Opname from './pages/Opname'
import OpnameDetail from './pages/OpnameDetail'
import Users from './pages/Users'
import Roles from './pages/Roles'
import Companies from './pages/Companies'
import Catalog from './pages/Catalog'
import Vendors from './pages/Vendors'
import IncomingGoods from './pages/IncomingGoods'
import IncomingGoodsDetail from './pages/IncomingGoodsDetail'
import PackingJobs from './pages/PackingJobs'
import FormAnakPacking from './pages/FormAnakPacking'
import PageVisibility from './pages/PageVisibility'
import Handover from './pages/Handover'
import HandoverDetail from './pages/HandoverDetail'
import DatabaseLinks from './pages/DatabaseLinks'
import Laporan from './pages/Laporan'
import Transfers from './pages/Transfers'
import TransferDetail from './pages/TransferDetail'
import ManualShipments from './pages/ManualShipments'
import ManualShipmentForm from './pages/ManualShipmentForm'
import ManualShipmentDetail from './pages/ManualShipmentDetail'
import Landing from './pages/Landing'
import Home from './pages/Home'
import Pengajuan from './pages/Pengajuan'
import PengajuanBaru from './pages/PengajuanBaru'
import PengajuanDetail from './pages/PengajuanDetail'

// Permission yang menandakan user benar-benar memakai fitur Inventory (bukan
// cuma akses default seperti Dashboard/SOP/Pengajuan yang terbuka untuk semua
// user login). Dipakai untuk menentukan landing page setelah login.
const INVENTORY_PERMISSIONS = [
  'inventory.view', 'inventory.manage', 'inventory.product.create', 'inventory.product.edit',
  'stock.in.view', 'stock.out.view', 'stock.view', 'stock.opname.view', 'stock.transfer.view',
  'shipping.manual.view', 'shipping.manual.create', 'shipping.manual.edit',
  'packing.manage', 'packing.incoming', 'packing.jobs', 'packing.view',
  'handover.view', 'db_link.view', 'reports.manage',
]

// Module "utama" yang dihitung untuk landing decision. Handbook sengaja tidak
// dihitung karena selalu terbuka untuk semua user — kalau ikut dihitung, semua
// orang jadi punya >1 module dan selalu diarahkan ke Home, padahal tujuannya
// user dengan 1 module kerja tetap langsung ke module itu.
function getPrimaryModules({ isAdmin, hasPermission }) {
  const modules = []
  if (isAdmin || INVENTORY_PERMISSIONS.some((p) => hasPermission(p))) {
    modules.push({ key: 'inventory', to: '/dashboard' })
  }
  if (isAdmin || hasPermission('hris.view')) {
    modules.push({ key: 'hris', to: '/hris' })
  }
  return modules
}

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user } = useAuth()
  return !user ? children : <Navigate to="/" replace />
}

function RootRoute() {
  const { user, isAdmin, hasPermission } = useAuth()
  if (!user) return <Landing />

  const modules = getPrimaryModules({ isAdmin, hasPermission })
  if (modules.length > 1) return <Navigate to="/home" replace />
  return <Navigate to={modules[0]?.to ?? '/dashboard'} replace />
}

// Shows NoPermission UI instead of redirecting — user can see they lack access
function PermissionRoute({ permission, page, children }) {
  const { hasPermission } = useAuth()
  return hasPermission(permission) ? children : <NoPermission page={page} />
}

function SuperRoute({ children }) {
  const { isSuperAdmin } = useAuth()
  return isSuperAdmin ? children : <Navigate to="/dashboard" replace />
}

function PageVisibleRoute({ pageKey, children }) {
  const { isSuperAdmin } = useAuth()
  const { isPageVisible } = usePageVisibility()
  if (!isSuperAdmin && !isPageVisible(pageKey)) return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/*" element={
        <PrivateRoute>
          <PageVisibilityProvider>
            <Layout>
              <ErrorBoundary>
              <Routes>
                <Route path="/home"      element={<Home />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/sop"       element={<SOP />} />
                <Route path="/handbook/*" element={<Handbook />} />
                <Route path="/hris"               element={<PageVisibleRoute pageKey="hris"><PermissionRoute permission="hris.view" page="HRIS"><HRIS /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/hris/attendance"     element={<PageVisibleRoute pageKey="hris"><PermissionRoute permission="hris.view" page="Presensi"><HrisAttendance /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/hris/leave"          element={<PageVisibleRoute pageKey="hris"><PermissionRoute permission="hris.view" page="Cuti"><HrisLeave /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/hris/reports"        element={<PageVisibleRoute pageKey="hris"><PermissionRoute permission="hris.reports.view" page="Laporan HRIS"><HrisReports /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/hris/admin/shifts"   element={<PageVisibleRoute pageKey="hris"><PermissionRoute permission="hris.shift.manage" page="Kelola Shift"><HrisShifts /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/hris/admin/attendance-review" element={<PageVisibleRoute pageKey="hris"><PermissionRoute permission="hris.attendance.review" page="Persetujuan Presensi Lapangan"><HrisAttendanceReview /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/hris/admin/locations" element={<PageVisibleRoute pageKey="hris"><PermissionRoute permission="hris.location.manage" page="Lokasi Kantor"><HrisLocations /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/hris/admin/leave-quota" element={<PageVisibleRoute pageKey="hris"><PermissionRoute permission="hris.manage" page="Kuota Cuti"><HrisLeaveQuota /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/hris/wfa"             element={<PageVisibleRoute pageKey="hris"><PermissionRoute permission="hris.view" page="WFA"><HrisWfa /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/hris/late-excuse"     element={<PageVisibleRoute pageKey="hris"><PermissionRoute permission="hris.view" page="Izin Telat"><HrisLateExcuse /></PermissionRoute></PageVisibleRoute>} />
                {/* Hub gabungan Cuti+WFA+Izin Telat — eksperimen UX, route lama di atas sengaja dibiarkan supaya gampang revert */}
                <Route path="/hris/pengajuan"       element={<PageVisibleRoute pageKey="hris"><PermissionRoute permission="hris.view" page="Pengajuan"><HrisRequests /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/hris/admin/wfa-quota" element={<PageVisibleRoute pageKey="hris"><PermissionRoute permission="hris.manage" page="Kuota WFA"><HrisWfaQuota /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/hris/payment-adjustments" element={<PageVisibleRoute pageKey="hris"><PermissionRoute permission="hris.reports.view" page="Penyesuaian Payment"><HrisPaymentAdjustments /></PermissionRoute></PageVisibleRoute>} />

                {/* ── Produk ── */}
                <Route path="/products"          element={<PageVisibleRoute pageKey="products"><PermissionRoute permission="inventory.view" page="Produk"><Products /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/products/new"      element={<PageVisibleRoute pageKey="products"><PermissionRoute permission="inventory.product.create" page="Tambah Produk"><ProductEdit /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/products/:id"      element={<PageVisibleRoute pageKey="products"><PermissionRoute permission="inventory.view" page="Produk"><ProductDetail /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/products/:id/edit" element={<PageVisibleRoute pageKey="products"><PermissionRoute permission="inventory.product.edit" page="Edit Produk"><ProductEdit /></PermissionRoute></PageVisibleRoute>} />

                {/* ── Katalog & Inventori ── */}
                <Route path="/catalog"                    element={<PageVisibleRoute pageKey="catalog"><PermissionRoute permission="inventory.manage" page="Kategori & Koleksi"><Catalog /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/warehouses"                 element={<PageVisibleRoute pageKey="warehouses"><PermissionRoute permission="inventory.view" page="Gudang"><Warehouses /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/warehouses/:id/products"   element={<PageVisibleRoute pageKey="warehouses"><PermissionRoute permission="inventory.view" page="Gudang"><WarehouseProducts /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/channels"                   element={<PageVisibleRoute pageKey="channels"><PermissionRoute permission="channel.manage" page="Channel Jualan"><Channels /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/suppliers"                  element={<PageVisibleRoute pageKey="suppliers"><PermissionRoute permission="inventory.manage" page="Vendor"><Suppliers /></PermissionRoute></PageVisibleRoute>} />

                {/* ── Transaksi Stok ── */}
                <Route path="/stock-in"      element={<PageVisibleRoute pageKey="stock-in"><PermissionRoute permission="stock.in.view" page="Penerimaan Stock"><StockIn /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/stock-in/:id"  element={<PageVisibleRoute pageKey="stock-in"><PermissionRoute permission="stock.in.view" page="Penerimaan Stock"><StockInDetail /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/stock-out"     element={<PageVisibleRoute pageKey="stock-out"><PermissionRoute permission="stock.out.view" page="Pengeluaran Stock"><StockOut /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/stock-out/:id" element={<PageVisibleRoute pageKey="stock-out"><PermissionRoute permission="stock.out.view" page="Pengeluaran Stock"><StockOutDetail /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/movements"     element={<PageVisibleRoute pageKey="movements"><PermissionRoute permission="stock.view" page="Pergerakan Stok"><Movements /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/opname"        element={<PageVisibleRoute pageKey="opname"><PermissionRoute permission="stock.opname.view" page="Stock Opname"><Opname /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/opname/:id"    element={<PageVisibleRoute pageKey="opname"><PermissionRoute permission="stock.opname.view" page="Stock Opname"><OpnameDetail /></PermissionRoute></PageVisibleRoute>} />

                {/* ── Handover ── */}
                <Route path="/handover"      element={<PageVisibleRoute pageKey="handover"><PermissionRoute permission="handover.view" page="Handover"><Handover /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/handover/:id"  element={<PageVisibleRoute pageKey="handover"><PermissionRoute permission="handover.view" page="Handover"><HandoverDetail /></PermissionRoute></PageVisibleRoute>} />

                {/* ── Transfer Stok ── */}
                <Route path="/transfers"     element={<PageVisibleRoute pageKey="transfers"><PermissionRoute permission="stock.transfer.view" page="Transfer Stok"><Transfers /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/transfers/:id" element={<PageVisibleRoute pageKey="transfers"><PermissionRoute permission="stock.transfer.view" page="Transfer Stok"><TransferDetail /></PermissionRoute></PageVisibleRoute>} />

                {/* ── Shipping Manual ── */}
                <Route path="/shipping-manual"          element={<PageVisibleRoute pageKey="shipping-manual"><PermissionRoute permission="shipping.manual.view" page="Shipping Manual"><ManualShipments /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/shipping-manual/new"      element={<PageVisibleRoute pageKey="shipping-manual"><PermissionRoute permission="shipping.manual.create" page="Shipping Manual"><ManualShipmentForm /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/shipping-manual/:id"      element={<PageVisibleRoute pageKey="shipping-manual"><PermissionRoute permission="shipping.manual.view" page="Shipping Manual"><ManualShipmentDetail /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/shipping-manual/:id/edit" element={<PageVisibleRoute pageKey="shipping-manual"><PermissionRoute permission="shipping.manual.edit" page="Shipping Manual"><ManualShipmentForm /></PermissionRoute></PageVisibleRoute>} />

                {/* ── Packing ── */}
                <Route path="/vendors"              element={<PageVisibleRoute pageKey="vendors"><PermissionRoute permission="packing.manage" page="Vendors"><Vendors /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/incoming-goods"       element={<PageVisibleRoute pageKey="incoming-goods"><PermissionRoute permission="packing.incoming" page="Barang Masuk"><IncomingGoods /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/incoming-goods/:id"   element={<PageVisibleRoute pageKey="incoming-goods"><PermissionRoute permission="packing.incoming" page="Barang Masuk"><IncomingGoodsDetail /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/packing-jobs"         element={<PageVisibleRoute pageKey="packing-jobs"><PermissionRoute permission="packing.jobs" page="Packing Jobs"><PackingJobs /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/form-anak-packing"    element={<PageVisibleRoute pageKey="form-anak-packing"><PermissionRoute permission="packing.view" page="Form Anak Packing"><FormAnakPacking /></PermissionRoute></PageVisibleRoute>} />

                {/* ── Umum ── */}
                <Route path="/database-links" element={<PageVisibleRoute pageKey="database-links"><PermissionRoute permission="db_link.view" page="Database Links"><DatabaseLinks /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/laporan"        element={<PageVisibleRoute pageKey="laporan"><PermissionRoute permission="reports.manage" page="Laporan"><Laporan /></PermissionRoute></PageVisibleRoute>} />

                {/* ── Pengajuan ── */}
                <Route path="/pengajuan"         element={<Pengajuan />} />
                <Route path="/pengajuan/baru"    element={<PengajuanBaru />} />
                <Route path="/pengajuan/:id"     element={<PengajuanDetail />} />

                {/* ── Administrasi ── */}
                <Route path="/users"           element={<PageVisibleRoute pageKey="users"><PermissionRoute permission="admin.users" page="Pengguna"><Users /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/roles"           element={<PageVisibleRoute pageKey="users"><PermissionRoute permission="admin.users" page="Roles & Permission"><Roles /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/companies"       element={<SuperRoute><PageVisibleRoute pageKey="companies"><Companies /></PageVisibleRoute></SuperRoute>} />
                <Route path="/page-visibility" element={<SuperRoute><PageVisibility /></SuperRoute>} />
              </Routes>
              </ErrorBoundary>
            </Layout>
          </PageVisibilityProvider>
        </PrivateRoute>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SelectedCompanyProvider>
          <AppRoutes />
        </SelectedCompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
