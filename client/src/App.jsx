import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
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

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user } = useAuth()
  return !user ? children : <Navigate to="/" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/*" element={
        <PrivateRoute>
          <Layout>
            <Routes>
              <Route path="/"           element={<Dashboard />} />
              <Route path="/products"            element={<Products />} />
              <Route path="/products/new"       element={<ProductEdit />} />
              <Route path="/products/:id"       element={<ProductDetail />} />
              <Route path="/products/:id/edit"  element={<ProductEdit />} />
              <Route path="/catalog"        element={<Catalog />} />
              <Route path="/warehouses"                    element={<Warehouses />} />
              <Route path="/warehouses/:id/products"    element={<WarehouseProducts />} />
              <Route path="/suppliers"  element={<Suppliers />} />
              <Route path="/stock-in"        element={<StockIn />} />
              <Route path="/stock-in/new"    element={<StockInDetail />} />
              <Route path="/stock-in/:id"    element={<StockInDetail />} />
              <Route path="/stock-out"  element={<StockOut />} />
              <Route path="/movements"  element={<Movements />} />
              <Route path="/opname"     element={<Opname />} />
              <Route path="/users"      element={<Users />} />
              <Route path="/companies"  element={<Companies />} />
              <Route path="/vendors"          element={<Vendors />} />
              <Route path="/incoming-goods"   element={<IncomingGoods />} />
              <Route path="/surat-jalan"      element={<SuratJalan />} />
              <Route path="/packing-jobs"     element={<PackingJobs />} />
              <Route path="/form-anak-packing" element={<FormAnakPacking />} />
            </Routes>
          </Layout>
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
