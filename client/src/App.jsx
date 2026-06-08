import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PageVisibilityProvider, usePageVisibility } from './context/PageVisibilityContext'
import { SelectedCompanyProvider } from './context/SelectedCompanyContext'
import Layout from './components/Layout'
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
import SuratJalan from './pages/SuratJalan'
import PackingJobs from './pages/PackingJobs'
import FormAnakPacking from './pages/FormAnakPacking'
import PageVisibility from './pages/PageVisibility'
import Handover from './pages/Handover'
import HandoverDetail from './pages/HandoverDetail'
import DatabaseLinks from './pages/DatabaseLinks'

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user } = useAuth()
  return !user ? children : <Navigate to="/" replace />
}

function StaffGuardRoute({ children }) {
  const { isStaff, hasPermission } = useAuth()
  if (isStaff && !hasPermission('inventory.manage')) return <Navigate to="/products" replace />
  return children
}

function PageVisibleRoute({ pageKey, children }) {
  const { isSuperAdmin } = useAuth()
  const { isPageVisible } = usePageVisibility()
  // SUPER_ADMIN can always access any page regardless of visibility setting
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
                <Route path="/"           element={<Dashboard />} />
                <Route path="/products"           element={<PageVisibleRoute pageKey="products"><Products /></PageVisibleRoute>} />
                <Route path="/products/new"       element={<StaffGuardRoute><PageVisibleRoute pageKey="products"><ProductEdit /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/products/:id"       element={<PageVisibleRoute pageKey="products"><ProductDetail /></PageVisibleRoute>} />
                <Route path="/products/:id/edit"  element={<StaffGuardRoute><PageVisibleRoute pageKey="products"><ProductEdit /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/catalog"            element={<StaffGuardRoute><PageVisibleRoute pageKey="catalog"><Catalog /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/warehouses"                  element={<StaffGuardRoute><PageVisibleRoute pageKey="warehouses"><Warehouses /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/warehouses/:id/products"     element={<StaffGuardRoute><PageVisibleRoute pageKey="warehouses"><WarehouseProducts /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/suppliers"          element={<StaffGuardRoute><PageVisibleRoute pageKey="suppliers"><Suppliers /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/stock-in"           element={<StaffGuardRoute><PageVisibleRoute pageKey="stock-in"><StockIn /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/stock-in/new"       element={<StaffGuardRoute><PageVisibleRoute pageKey="stock-in"><StockInDetail /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/stock-in/:id"       element={<StaffGuardRoute><PageVisibleRoute pageKey="stock-in"><StockInDetail /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/stock-out"          element={<StaffGuardRoute><PageVisibleRoute pageKey="stock-out"><StockOut /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/stock-out/new"      element={<StaffGuardRoute><PageVisibleRoute pageKey="stock-out"><StockOutDetail /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/stock-out/:id"      element={<StaffGuardRoute><PageVisibleRoute pageKey="stock-out"><StockOutDetail /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/movements"          element={<StaffGuardRoute><PageVisibleRoute pageKey="movements"><Movements /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/opname"             element={<StaffGuardRoute><PageVisibleRoute pageKey="opname"><Opname /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/opname/:id"         element={<StaffGuardRoute><PageVisibleRoute pageKey="opname"><OpnameDetail /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/users"              element={<StaffGuardRoute><PageVisibleRoute pageKey="users"><Users /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/companies"          element={<StaffGuardRoute><PageVisibleRoute pageKey="companies"><Companies /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/vendors"            element={<StaffGuardRoute><PageVisibleRoute pageKey="vendors"><Vendors /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/incoming-goods"        element={<StaffGuardRoute><PageVisibleRoute pageKey="incoming-goods"><IncomingGoods /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/incoming-goods/new"  element={<StaffGuardRoute><PageVisibleRoute pageKey="incoming-goods"><IncomingGoodsDetail /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/incoming-goods/:id"  element={<StaffGuardRoute><PageVisibleRoute pageKey="incoming-goods"><IncomingGoodsDetail /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/surat-jalan"         element={<StaffGuardRoute><PageVisibleRoute pageKey="surat-jalan"><SuratJalan /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/packing-jobs"       element={<StaffGuardRoute><PageVisibleRoute pageKey="packing-jobs"><PackingJobs /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/form-anak-packing"  element={<StaffGuardRoute><PageVisibleRoute pageKey="form-anak-packing"><FormAnakPacking /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/handover"           element={<StaffGuardRoute><PageVisibleRoute pageKey="handover"><Handover /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/handover/:id"       element={<StaffGuardRoute><PageVisibleRoute pageKey="handover"><HandoverDetail /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/database-links"     element={<StaffGuardRoute><PageVisibleRoute pageKey="database-links"><DatabaseLinks /></PageVisibleRoute></StaffGuardRoute>} />
                <Route path="/page-visibility"    element={<StaffGuardRoute><PageVisibility /></StaffGuardRoute>} />
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
