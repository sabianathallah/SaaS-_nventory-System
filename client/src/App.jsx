import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Categories from './pages/Categories'
import Warehouses from './pages/Warehouses'
import Suppliers from './pages/Suppliers'
import Stocks from './pages/Stocks'
import StockIn from './pages/StockIn'
import StockOut from './pages/StockOut'
import Movements from './pages/Movements'
import Opname from './pages/Opname'
import Users from './pages/Users'
import Companies from './pages/Companies'
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
              <Route path="/products"   element={<Products />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/warehouses" element={<Warehouses />} />
              <Route path="/suppliers"  element={<Suppliers />} />
              <Route path="/stocks"     element={<Stocks />} />
              <Route path="/stock-in"   element={<StockIn />} />
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
