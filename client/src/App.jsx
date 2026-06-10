import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PageVisibilityProvider, usePageVisibility } from './context/PageVisibilityContext'
import { SelectedCompanyProvider } from './context/SelectedCompanyContext'
import Layout from './components/Layout'
import NoPermission from './components/NoPermission'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import ProductEdit from './pages/ProductEdit'
import Warehouses from './pages/Warehouses'
import WarehouseProducts from './pages/WarehouseProducts'
import Suppliers from './pages/Suppliers'
import StockIn from './pages/StockIn'
import StockInDetail from './pages/StockInDetail'
import StockOut from './pages/StockOut'
import StockOutDetail from './pages/StockOutDetail'
import Movements from './pages/Movements'
import Opname from './pages/Opname'
import OpnameDetail from './pages/OpnameDetail'
import Users from './pages/Users'
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

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user } = useAuth()
  return !user ? children : <Navigate to="/" replace />
}

// Shows NoPermission UI instead of redirecting — user can see they lack access
function PermissionRoute({ permission, page, children }) {
  const { hasPermission } = useAuth()
  return hasPermission(permission) ? children : <NoPermission page={page} />
}

// Hard redirect — for pages that should be completely invisible to non-admins
function AdminRoute({ children }) {
  const { isAdmin } = useAuth()
  return isAdmin ? children : <Navigate to="/" replace />
}

function SuperRoute({ children }) {
  const { isSuperAdmin } = useAuth()
  return isSuperAdmin ? children : <Navigate to="/" replace />
}

function PageVisibleRoute({ pageKey, children }) {
  const { isSuperAdmin } = useAuth()
  const { isPageVisible } = usePageVisibility()
  if (!isSuperAdmin && !isPageVisible(pageKey)) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/*" element={
        <PrivateRoute>
          <PageVisibilityProvider>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />

                {/* ── Produk ── */}
                <Route path="/products"          element={<PageVisibleRoute pageKey="products"><PermissionRoute permission="inventory.view" page="Produk"><Products /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/products/new"      element={<PageVisibleRoute pageKey="products"><PermissionRoute permission="inventory.product.create" page="Tambah Produk"><ProductEdit /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/products/:id"      element={<PageVisibleRoute pageKey="products"><PermissionRoute permission="inventory.view" page="Produk"><ProductDetail /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/products/:id/edit" element={<PageVisibleRoute pageKey="products"><PermissionRoute permission="inventory.product.edit" page="Edit Produk"><ProductEdit /></PermissionRoute></PageVisibleRoute>} />

                {/* ── Katalog & Inventori ── */}
                <Route path="/catalog"                    element={<PageVisibleRoute pageKey="catalog"><PermissionRoute permission="inventory.manage" page="Kategori & Koleksi"><Catalog /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/warehouses"                 element={<PageVisibleRoute pageKey="warehouses"><PermissionRoute permission="inventory.manage" page="Gudang"><Warehouses /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/warehouses/:id/products"   element={<PageVisibleRoute pageKey="warehouses"><PermissionRoute permission="inventory.manage" page="Gudang"><WarehouseProducts /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/suppliers"                  element={<PageVisibleRoute pageKey="suppliers"><PermissionRoute permission="inventory.manage" page="Vendor"><Suppliers /></PermissionRoute></PageVisibleRoute>} />

                {/* ── Transaksi Stok ── */}
                <Route path="/stock-in"      element={<PageVisibleRoute pageKey="stock-in"><PermissionRoute permission="stock.in.view" page="Penerimaan Stock"><StockIn /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/stock-in/new"  element={<PageVisibleRoute pageKey="stock-in"><PermissionRoute permission="stock.in.create" page="Penerimaan Stock"><StockInDetail /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/stock-in/:id"  element={<PageVisibleRoute pageKey="stock-in"><PermissionRoute permission="stock.in.view" page="Penerimaan Stock"><StockInDetail /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/stock-out"     element={<PageVisibleRoute pageKey="stock-out"><PermissionRoute permission="stock.out.view" page="Pengeluaran Stock"><StockOut /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/stock-out/new" element={<PageVisibleRoute pageKey="stock-out"><PermissionRoute permission="stock.out.create" page="Pengeluaran Stock"><StockOutDetail /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/stock-out/:id" element={<PageVisibleRoute pageKey="stock-out"><PermissionRoute permission="stock.out.view" page="Pengeluaran Stock"><StockOutDetail /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/movements"     element={<PageVisibleRoute pageKey="movements"><PermissionRoute permission="stock.view" page="Pergerakan Stok"><Movements /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/opname"        element={<PageVisibleRoute pageKey="opname"><PermissionRoute permission="stock.opname.view" page="Stock Opname"><Opname /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/opname/:id"    element={<PageVisibleRoute pageKey="opname"><PermissionRoute permission="stock.opname.view" page="Stock Opname"><OpnameDetail /></PermissionRoute></PageVisibleRoute>} />

                {/* ── Handover ── */}
                <Route path="/handover"      element={<PageVisibleRoute pageKey="handover"><PermissionRoute permission="handover.view" page="Handover"><Handover /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/handover/:id"  element={<PageVisibleRoute pageKey="handover"><PermissionRoute permission="handover.view" page="Handover"><HandoverDetail /></PermissionRoute></PageVisibleRoute>} />

                {/* ── Packing ── */}
                <Route path="/vendors"              element={<PageVisibleRoute pageKey="vendors"><PermissionRoute permission="packing.manage" page="Vendors"><Vendors /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/incoming-goods"       element={<PageVisibleRoute pageKey="incoming-goods"><PermissionRoute permission="packing.incoming" page="Barang Masuk"><IncomingGoods /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/incoming-goods/new"   element={<PageVisibleRoute pageKey="incoming-goods"><PermissionRoute permission="packing.incoming" page="Barang Masuk"><IncomingGoodsDetail /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/incoming-goods/:id"   element={<PageVisibleRoute pageKey="incoming-goods"><PermissionRoute permission="packing.incoming" page="Barang Masuk"><IncomingGoodsDetail /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/packing-jobs"         element={<PageVisibleRoute pageKey="packing-jobs"><PermissionRoute permission="packing.jobs" page="Packing Jobs"><PackingJobs /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/form-anak-packing"    element={<PageVisibleRoute pageKey="form-anak-packing"><PermissionRoute permission="packing.view" page="Form Anak Packing"><FormAnakPacking /></PermissionRoute></PageVisibleRoute>} />

                {/* ── Umum ── */}
                <Route path="/database-links" element={<PageVisibleRoute pageKey="database-links"><PermissionRoute permission="db_link.view" page="Database Links"><DatabaseLinks /></PermissionRoute></PageVisibleRoute>} />
                <Route path="/laporan"        element={<PageVisibleRoute pageKey="laporan"><PermissionRoute permission="reports.manage" page="Laporan"><Laporan /></PermissionRoute></PageVisibleRoute>} />

                {/* ── Admin only (hard redirect) ── */}
                <Route path="/users"           element={<AdminRoute><PageVisibleRoute pageKey="users"><Users /></PageVisibleRoute></AdminRoute>} />
                <Route path="/companies"       element={<SuperRoute><PageVisibleRoute pageKey="companies"><Companies /></PageVisibleRoute></SuperRoute>} />
                <Route path="/page-visibility" element={<SuperRoute><PageVisibility /></SuperRoute>} />
              </Routes>
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
