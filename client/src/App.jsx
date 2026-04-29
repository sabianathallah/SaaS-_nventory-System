import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PageVisibilityProvider, usePageVisibility } from './context/PageVisibilityContext'
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
import Movements from './pages/Movements'
import Opname from './pages/Opname'
import Users from './pages/Users'
import Companies from './pages/Companies'
import Catalog from './pages/Catalog'
import Vendors from './pages/Vendors'
import IncomingGoods from './pages/IncomingGoods'
import SuratJalan from './pages/SuratJalan'
import PackingJobs from './pages/PackingJobs'
import FormAnakPacking from './pages/FormAnakPacking'
import PageVisibility from './pages/PageVisibility'

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user } = useAuth()
  return !user ? children : <Navigate to="/" replace />
}

function PageVisibleRoute({ pageKey, children }) {
  const { isPageVisible } = usePageVisibility()
  if (!isPageVisible(pageKey)) return <Navigate to="/" replace />
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
                <Route path="/products/new"       element={<PageVisibleRoute pageKey="products"><ProductEdit /></PageVisibleRoute>} />
                <Route path="/products/:id"       element={<PageVisibleRoute pageKey="products"><ProductDetail /></PageVisibleRoute>} />
                <Route path="/products/:id/edit"  element={<PageVisibleRoute pageKey="products"><ProductEdit /></PageVisibleRoute>} />
                <Route path="/catalog"            element={<PageVisibleRoute pageKey="catalog"><Catalog /></PageVisibleRoute>} />
                <Route path="/warehouses"                  element={<PageVisibleRoute pageKey="warehouses"><Warehouses /></PageVisibleRoute>} />
                <Route path="/warehouses/:id/products"     element={<PageVisibleRoute pageKey="warehouses"><WarehouseProducts /></PageVisibleRoute>} />
                <Route path="/suppliers"          element={<PageVisibleRoute pageKey="suppliers"><Suppliers /></PageVisibleRoute>} />
                <Route path="/stock-in"           element={<PageVisibleRoute pageKey="stock-in"><StockIn /></PageVisibleRoute>} />
                <Route path="/stock-in/new"       element={<PageVisibleRoute pageKey="stock-in"><StockInDetail /></PageVisibleRoute>} />
                <Route path="/stock-in/:id"       element={<PageVisibleRoute pageKey="stock-in"><StockInDetail /></PageVisibleRoute>} />
                <Route path="/stock-out"          element={<PageVisibleRoute pageKey="stock-out"><StockOut /></PageVisibleRoute>} />
                <Route path="/movements"          element={<PageVisibleRoute pageKey="movements"><Movements /></PageVisibleRoute>} />
                <Route path="/opname"             element={<PageVisibleRoute pageKey="opname"><Opname /></PageVisibleRoute>} />
                <Route path="/users"              element={<PageVisibleRoute pageKey="users"><Users /></PageVisibleRoute>} />
                <Route path="/companies"          element={<PageVisibleRoute pageKey="companies"><Companies /></PageVisibleRoute>} />
                <Route path="/vendors"            element={<PageVisibleRoute pageKey="vendors"><Vendors /></PageVisibleRoute>} />
                <Route path="/incoming-goods"     element={<PageVisibleRoute pageKey="incoming-goods"><IncomingGoods /></PageVisibleRoute>} />
                <Route path="/surat-jalan"        element={<PageVisibleRoute pageKey="surat-jalan"><SuratJalan /></PageVisibleRoute>} />
                <Route path="/packing-jobs"       element={<PageVisibleRoute pageKey="packing-jobs"><PackingJobs /></PageVisibleRoute>} />
                <Route path="/form-anak-packing"  element={<PageVisibleRoute pageKey="form-anak-packing"><FormAnakPacking /></PageVisibleRoute>} />
                <Route path="/page-visibility"    element={<PageVisibility />} />
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
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
