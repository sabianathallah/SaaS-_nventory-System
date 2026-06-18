import { useState, useEffect } from 'react'
import ProfileModal from './ProfileModal'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePageVisibility } from '../context/PageVisibilityContext'
import CompanySwitcher from './CompanySwitcher'
import { useCompanyGuard } from '../hooks/useCompanyGuard'
import {
  LayoutDashboard, Package, Warehouse, Truck,
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Repeat2,
  ClipboardList, Users, Building2, BookOpen, LogOut, Bell,
  PackageOpen, Layers, ClipboardCheck, Menu, X, Eye, EyeOff,
  PackageCheck, Link2, BarChart2, BookMarked, ChevronDown, SendHorizonal,
} from 'lucide-react'
import logoPreface from '../assets/logo-preface.jpeg'

const BRAND = '#C8102E'

const NAV_GROUPS = [
  {
    label: 'Ringkasan',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/sop',       icon: BookMarked,      label: 'SOP' },
      { to: '/laporan',   icon: BarChart2,        label: 'Laporan', pageKey: 'laporan' },
    ],
  },
  {
    label: 'Inventori',
    items: [
      { to: '/products',   icon: Package,   label: 'Produk',              pageKey: 'products', staffVisible: true },
      { to: '/catalog',    icon: BookOpen,  label: 'Kategori dan Koleksi', pageKey: 'catalog' },
      { to: '/warehouses', icon: Warehouse, label: 'Gudang',              pageKey: 'warehouses' },
      { to: '/suppliers',  icon: Truck,     label: 'Vendor',              pageKey: 'suppliers' },
    ],
  },
  {
    label: 'Transaksi',
    items: [
      { to: '/stock-in',  icon: ArrowDownToLine, label: 'Penerimaan Stock', pageKey: 'stock-in' },
      { to: '/stock-out', icon: ArrowUpFromLine,  label: 'Pengeluaran Stock', pageKey: 'stock-out' },
      { to: '/movements', icon: ArrowLeftRight,   label: 'Pergerakan',       pageKey: 'movements' },
      { to: '/transfers', icon: Repeat2,          label: 'Transfer Stok',    pageKey: 'transfers', requirePermission: 'stock.transfer.view' },
      { to: '/opname',    icon: ClipboardList,    label: 'Stock Opname',     pageKey: 'opname' },
      { to: '/handover',         icon: PackageCheck,    label: 'Handover',         pageKey: 'handover' },
      { to: '/shipping-manual', icon: SendHorizonal,   label: 'Shipping Manual',  pageKey: 'shipping-manual', requirePermission: 'shipping.manual.view' },
    ],
  },
  {
    label: 'Penerimaan Barang',
    items: [
      { to: '/vendors',        icon: Truck,       label: 'Vendors',      pageKey: 'vendors' },
      { to: '/incoming-goods', icon: PackageOpen, label: 'Barang Masuk', pageKey: 'incoming-goods' },
    ],
  },
  {
    label: 'Packing',
    items: [
      { to: '/packing-jobs',      icon: Layers,         label: 'Packing Jobs',      pageKey: 'packing-jobs' },
      { to: '/form-anak-packing', icon: ClipboardCheck, label: 'Form Anak Packing', pageKey: 'form-anak-packing' },
    ],
  },
  {
    label: 'Umum',
    items: [
      { to: '/database-links', icon: Link2, label: 'Database Links', pageKey: 'database-links' },
    ],
  },
  {
    label: 'Administrasi',
    items: [
      { to: '/users',           icon: Users,     label: 'Pengguna',            pageKey: 'users' },
      { to: '/companies',       icon: Building2, label: 'Perusahaan',          pageKey: 'companies', superOnly: true },
      { to: '/page-visibility', icon: Eye,       label: 'Visibilitas Halaman',                       superOnly: true },
    ],
  },
]

const PAGE_TITLES = {
  '/dashboard': 'Dashboard', '/sop': 'SOP Operasional', '/products': 'Produk', '/catalog': 'Kategori dan Koleksi',
  '/warehouses': 'Gudang', '/suppliers': 'Vendor',
  '/stock-in': 'Penerimaan Stok', '/stock-in/new': 'Penerimaan Stok Baru', '/stock-out': 'Pengeluaran Stok', '/movements': 'Pergerakan',
  '/opname': 'Stock Opname', '/transfers': 'Transfer Stok', '/handover': 'Handover Pengiriman',
  '/shipping-manual': 'Shipping Manual', '/database-links': 'Database Links', '/users': 'Pengguna', '/companies': 'Perusahaan',
  '/vendors': 'Vendor', '/incoming-goods': 'Barang Masuk',
  '/packing-jobs': 'Pekerjaan Packing', '/form-anak-packing': 'Form Anak Packing',
  '/page-visibility': 'Visibilitas Halaman',
  '/laporan': 'Laporan Bulanan',
}

function groupHasActivePath(group, pathname) {
  return group.items.some(item => pathname === item.to || pathname.startsWith(item.to + '/'))
}

export default function Layout({ children }) {
  const { user, signOut, isSuperAdmin, hasPermission } = useAuth()
  const { needsCompany } = useCompanyGuard()
  const { isPageVisible } = usePageVisibility()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  // Init open groups: only the group with the active page
  const [openGroups, setOpenGroups] = useState(() => {
    const active = NAV_GROUPS.find(g => groupHasActivePath(g, location.pathname))
    return new Set([active?.label ?? NAV_GROUPS[0].label])
  })

  // Auto-open group when navigating to a new page
  useEffect(() => {
    const active = NAV_GROUPS.find(g => groupHasActivePath(g, location.pathname))
    if (active) {
      setOpenGroups(prev => {
        if (prev.has(active.label)) return prev
        const next = new Set(prev)
        next.add(active.label)
        return next
      })
    }
  }, [location.pathname])

  const toggleGroup = (label) => {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })
  }

  const handleSignOut = () => { signOut(); navigate('/login') }
  const closeSidebar  = () => setSidebarOpen(false)
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Preface Inventory System'

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}

      {/* ── Mobile backdrop ────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────── */}
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
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {NAV_GROUPS.map((group) => {
            const navItems = group.items.reduce((acc, item) => {
              if (item.superOnly && !isSuperAdmin) return acc
              if (item.requirePermission && !isSuperAdmin && !hasPermission(item.requirePermission)) return acc
              const hidden = !!(item.pageKey && !isPageVisible(item.pageKey))
              if (hidden && !isSuperAdmin) return acc
              acc.push({ ...item, hidden })
              return acc
            }, [])

            if (!navItems.length) return null

            const isOpen    = openGroups.has(group.label)
            const isActive  = groupHasActivePath(group, location.pathname)

            return (
              <div key={group.label} className="mb-1">
                {/* Group header — clickable */}
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={`
                    w-full flex items-center gap-2 px-2 py-1.5 rounded-md
                    transition-colors duration-100 group
                    ${isActive && !isOpen
                      ? 'text-slate-700 bg-slate-200/60'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/40'}
                  `}
                >
                  <span className={`flex-1 text-left text-[10px] font-bold uppercase tracking-widest transition-colors ${isActive ? 'text-slate-600' : 'text-slate-400 group-hover:text-slate-500'}`}>
                    {group.label}
                  </span>
                  <ChevronDown
                    size={11}
                    className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${isActive ? 'text-slate-500' : 'text-slate-300 group-hover:text-slate-400'}`}
                  />
                </button>

                {/* Items — accordion */}
                <div
                  style={{
                    maxHeight: isOpen ? '600px' : '0px',
                    overflow: 'hidden',
                    transition: 'max-height 220ms ease',
                  }}
                >
                  <div className="pt-0.5 pb-1 space-y-0.5">
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
                            `flex items-center gap-2.5 px-2.5 py-1.5 text-sm font-medium transition-colors duration-100
                            ${isActive ? '' : item.hidden
                              ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/60'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'}`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              {item.icon ? (
                                <Icon
                                  size={14}
                                  strokeWidth={isActive ? 2.5 : 2}
                                  className={`flex-shrink-0 ${item.hidden && !isActive ? 'opacity-50' : ''}`}
                                />
                              ) : (
                                <span className="flex-shrink-0 w-[14px]" />
                              )}
                              <span className={`flex-1 truncate text-[13px] ${item.hidden && !isActive ? 'opacity-60' : ''}`}>
                                {item.label}
                              </span>
                              {item.hidden && (
                                <EyeOff
                                  size={10}
                                  className="flex-shrink-0 opacity-40"
                                  title="Halaman disembunyikan"
                                />
                              )}
                            </>
                          )}
                        </NavLink>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </nav>

        {/* User footer */}
        <div style={{ borderTop: '1px solid #E0DDD7' }} className="p-3">
          <div
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-slate-200/50 transition-colors cursor-pointer group"
            onClick={() => setProfileOpen(true)}
            title="Edit profil"
          >
            {user?.avatar
              ? <img src={user.avatar} alt="avatar" className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-slate-200" />
              : (
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: BRAND }}>
                  <span className="text-xs font-bold text-white">{user?.name?.[0]?.toUpperCase()}</span>
                </div>
              )
            }
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-400 truncate">
                {user?.company?.name ?? user?.role}
              </p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); handleSignOut() }}
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
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 md:px-6 gap-3 flex-shrink-0 shadow-sm">
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
            <div
              className="flex items-center gap-2 pl-2 border-l border-slate-200 cursor-pointer"
              onClick={() => setProfileOpen(true)}
              title="Edit profil"
            >
              {user?.avatar
                ? <img src={user.avatar} alt="avatar" className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-slate-200" />
                : (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: BRAND }}>
                    <span className="text-xs font-bold text-white">{user?.name?.[0]?.toUpperCase()}</span>
                  </div>
                )
              }
              <div className="hidden sm:block min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate leading-tight">{user?.name}</p>
                {user?.company?.name && (
                  <p className="text-[10px] text-slate-400 truncate leading-tight">{user.company.name}</p>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Company warning */}
        {needsCompany && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 md:px-6 py-2 flex items-center gap-2 text-xs text-amber-700 flex-shrink-0">
            <span className="text-amber-500 font-bold">⚠</span>
            <span>
              Anda sedang melihat <strong>semua perusahaan</strong>. Pilih perusahaan spesifik di pojok kanan atas sebelum membuat transaksi, produk, gudang, atau vendor.
            </span>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  )
}
