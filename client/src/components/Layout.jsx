import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Package, Tags, Warehouse, Truck,
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
  ClipboardList, Users, Building2, BoxesIcon, LogOut, Bell,
} from 'lucide-react'
import logoPreface from '../assets/logo-preface.jpeg'

const BRAND = '#C8102E'
const BRAND_HOVER = '#D93248'

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/', icon: LayoutDashboard, label: 'Dashboard' }],
  },
  {
    label: 'Inventory',
    items: [
      { to: '/products',   icon: Package,   label: 'Products' },
      { to: '/categories', icon: Tags,      label: 'Categories' },
      { to: '/warehouses', icon: Warehouse, label: 'Warehouses' },
      { to: '/suppliers',  icon: Truck,     label: 'Suppliers' },
      { to: '/stocks',     icon: BoxesIcon, label: 'Stock Levels' },
    ],
  },
  {
    label: 'Transactions',
    items: [
      { to: '/stock-in',  icon: ArrowDownToLine, label: 'Stock In' },
      { to: '/stock-out', icon: ArrowUpFromLine,  label: 'Stock Out' },
      { to: '/movements', icon: ArrowLeftRight,   label: 'Movements' },
      { to: '/opname',    icon: ClipboardList,    label: 'Stock Opname' },
    ],
  },
  {
    label: 'Administration',
    adminOnly: true,
    items: [
      { to: '/users',     icon: Users,     label: 'Users',     adminOnly: true },
      { to: '/companies', icon: Building2, label: 'Companies', superOnly: true },
    ],
  },
]

const PAGE_TITLES = {
  '/': 'Dashboard', '/products': 'Products', '/categories': 'Categories',
  '/warehouses': 'Warehouses', '/suppliers': 'Suppliers', '/stocks': 'Stock Levels',
  '/stock-in': 'Stock In', '/stock-out': 'Stock Out', '/movements': 'Movements',
  '/opname': 'Stock Opname', '/users': 'Users', '/companies': 'Companies',
}

export default function Layout({ children }) {
  const { user, signOut, isAdmin, isSuperAdmin } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  const handleSignOut = () => { signOut(); navigate('/login') }
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Preface Inventory System'

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">

      {/* ── Sidebar — broken white ─────────────────────────── */}
      <aside
        className="w-60 flex-shrink-0 flex flex-col"
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
            const visibleItems = group.items.filter(item => {
              if (item.adminOnly && !isAdmin) return false
              if (item.superOnly && !isSuperAdmin) return false
              return true
            })
            if (!visibleItems.length) return null
            return (
              <div key={group.label}>
                <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        style={({ isActive }) => isActive
                          ? { background: BRAND, color: '#fff', borderRadius: '6px' }
                          : { borderRadius: '6px' }
                        }
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium transition-colors duration-100
                          ${isActive ? '' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'}`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon size={15} strokeWidth={isActive ? 2.5 : 2} className="flex-shrink-0" />
                            {item.label}
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
              <p className="text-[10px] text-slate-400 truncate">{user?.role}</p>
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
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-6 gap-4 flex-shrink-0 shadow-sm">
          <div className="flex-1">
            <h1 className="text-sm font-bold text-slate-800">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <Bell size={15} />
            </button>
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: BRAND }}
              >
                <span className="text-xs font-bold text-white">{user?.name?.[0]?.toUpperCase()}</span>
              </div>
              <span className="text-xs font-semibold text-slate-700">{user?.name}</span>
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
