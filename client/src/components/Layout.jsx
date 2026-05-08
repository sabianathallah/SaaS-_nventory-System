import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePageVisibility } from '../context/PageVisibilityContext'
import CompanySwitcher from './CompanySwitcher'
import {
  LayoutDashboard, Package, Warehouse, Truck,
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
  ClipboardList, Users, Building2, BookOpen, LogOut, Bell,
  PackageOpen, FileText, Layers, ClipboardCheck, Menu, X, Eye, EyeOff,
} from 'lucide-react'
import logoPreface from '../assets/logo-preface.jpeg'

const BRAND = '#C8102E'
const BRAND_HOVER = '#D93248'

const NAV_GROUPS = [
  {
    label: 'Ringkasan',
    items: [{ to: '/', icon: LayoutDashboard, label: 'Dashboard' }],
  },
  {
    label: 'Inventori',
    items: [
      { to: '/products',   icon: Package,   label: 'Produk',   pageKey: 'products' },
      { to: '/catalog',    icon: BookOpen,  label: 'Kategori dan Koleksi',    pageKey: 'catalog' },
      { to: '/warehouses', icon: Warehouse, label: 'Gudang', pageKey: 'warehouses' },
      { to: '/suppliers',  icon: Truck,     label: 'Vendor',  pageKey: 'suppliers' },
    ],
  },
  {
    label: 'Transaksi',
    items: [
      { to: '/stock-in',  icon: ArrowDownToLine, label: 'Penerimaan Stock',      pageKey: 'stock-in' },
      { to: '/stock-out', icon: ArrowUpFromLine,  label: 'Pengeluaran Stock',    pageKey: 'stock-out' },
      { to: '/movements', icon: ArrowLeftRight,   label: 'Pergerakan', pageKey: 'movements' },
      { to: '/opname',    icon: ClipboardList,    label: 'Stock Opname', pageKey: 'opname' },
    ],
  },
  {
    label: 'Penerimaan Barang Vendor',
    packingOnly: true,
    items: [
      { to: '/vendors',        icon: Truck,       label: 'Vendors',      pageKey: 'vendors',          adminOnly: true },
      { to: '/incoming-goods', icon: PackageOpen, label: 'Barang Masuk', pageKey: 'incoming-goods',   operasionalOnly: true },
      { to: '/surat-jalan',    icon: FileText,    label: 'Surat Jalan',  pageKey: 'surat-jalan',      operasionalOnly: true },
    ],
  },
  {
    label: 'Packing',
    packingOnly: true,
    items: [
      { to: '/packing-jobs',      icon: Layers,         label: 'Packing Jobs',      pageKey: 'packing-jobs' },
      { to: '/form-anak-packing', icon: ClipboardCheck, label: 'Form Anak Packing', pageKey: 'form-anak-packing' },
    ],
  },
  {
    label: 'Administrasi',
    adminOnly: true,
    items: [
      { to: '/users',            icon: Users,     label: 'Pengguna',             pageKey: 'users',     adminOnly: true },
      { to: '/companies',        icon: Building2, label: 'Perusahaan',         pageKey: 'companies', superOnly: true },
      { to: '/page-visibility',  icon: Eye,       label: 'Visibilitas Halaman',                     superOnly: true },
    ],
  },
]

const PAGE_TITLES = {
  '/': 'Dashboard', '/products': 'Produk', '/catalog': 'Kategori dan Koleksi',
  '/warehouses': 'Gudang', '/suppliers': 'Vendor',
  '/stock-in': 'Penerimaan Stok', '/stock-in/new': 'Penerimaan Stok Baru', '/stock-out': 'Pengeluaran Stok', '/movements': 'Pergerakan',
  '/opname': 'Stock Opname', '/users': 'Pengguna', '/companies': 'Perusahaan',
  '/vendors': 'Vendor', '/incoming-goods': 'Barang Masuk', '/surat-jalan': 'Surat Jalan',
  '/packing-jobs': 'Pekerjaan Packing', '/form-anak-packing': 'Form Anak Packing',
  '/page-visibility': 'Visibilitas Halaman',
}

export default function Layout({ children }) {
  const { user, signOut, isAdmin, isSuperAdmin, isOperasional, isHeadPacking, canViewPacking } = useAuth()
  const { isPageVisible } = usePageVisibility()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = () => { signOut(); navigate('/login') }
  const closeSidebar  = () => setSidebarOpen(false)
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Preface Inventory System'

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">

      {/* ── Mobile backdrop ────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* ── Sidebar — broken white ─────────────────────────── */}
      <aside
        className={`
          fixed md:relative inset-y-0 left-0 z-30
          w-60 flex-shrink-0 flex flex-col
          transition-transform duration-250 ease-out
          ${sidebarOpen ? 'translate-x-0 animate-slide-in-left' : '-translate-x-full md:translate-x-0'}
        `}
        style={{ background: '#F5F3EF', borderRight: '1px solid #E0DDD7', boxShadow: '2px 0 8px rgba(0,0,0,0.04)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-14" style={{ borderBottom: '1px solid #E0DDD7' }}>
          <img src={logoPreface} alt="Preface" className="w-7 h-7 rounded object-cover flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-sm text-slate-800 leading-tight truncate">Preface</p>
            <p className="text-[10px] text-slate-400 leading-tight truncate">Inventory System</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {NAV_GROUPS.map((group) => {
            if (group.adminOnly && !isAdmin) return null
            if (group.packingOnly && !canViewPacking) return null

            const navItems = group.items.reduce((acc, item) => {
              if (item.adminOnly && !isAdmin) return acc
              if (item.superOnly && !isSuperAdmin) return acc
              if (item.operasionalOnly && !isOperasional) return acc
              if (item.headPackingOnly && !isHeadPacking) return acc

              const hidden = !!(item.pageKey && !isPageVisible(item.pageKey))
              // Non-SUPER_ADMIN: filter out hidden pages entirely
              if (hidden && !isSuperAdmin) return acc

              acc.push({ ...item, hidden })
              return acc
            }, [])

            if (!navItems.length) return null
            return (
              <div key={group.label}>
                <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        onClick={closeSidebar}
                        style={({ isActive }) => isActive
                          ? { background: BRAND, color: '#fff', borderRadius: '6px' }
                          : { borderRadius: '6px' }
                        }
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium transition-colors duration-100
                          ${isActive ? '' : item.hidden
                            ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/60'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'}`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon
                              size={15}
                              strokeWidth={isActive ? 2.5 : 2}
                              className={`flex-shrink-0 ${item.hidden && !isActive ? 'opacity-50' : ''}`}
                            />
                            <span className={`flex-1 truncate ${item.hidden && !isActive ? 'opacity-60' : ''}`}>
                              {item.label}
                            </span>
                            {item.hidden && (
                              <EyeOff
                                size={10}
                                className="flex-shrink-0 opacity-50"
                                title="Halaman disembunyikan dari pengguna"
                              />
                            )}
                          </>
                        )}
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* User footer */}
        <div style={{ borderTop: '1px solid #E0DDD7' }} className="p-3">
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-slate-200/50 transition-colors cursor-pointer group">
            {/* Avatar merah Preface */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: BRAND }}
            >
              <span className="text-xs font-bold text-white">{user?.name?.[0]?.toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-400 truncate">
                {user?.company?.name ?? user?.role}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-600 p-0.5"
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar — putih */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 md:px-6 gap-3 flex-shrink-0 shadow-sm">
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors flex-shrink-0"
            onClick={() => setSidebarOpen(v => !v)}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-slate-800 truncate">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <CompanySwitcher />
            <button className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <Bell size={15} />
            </button>
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: BRAND }}
              >
                <span className="text-xs font-bold text-white">{user?.name?.[0]?.toUpperCase()}</span>
              </div>
              <div className="hidden sm:block min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate leading-tight">{user?.name}</p>
                {user?.company?.name && (
                  <p className="text-[10px] text-slate-400 truncate leading-tight">{user.company.name}</p>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  )
}
