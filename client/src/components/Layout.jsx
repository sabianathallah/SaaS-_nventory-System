import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import ProfileModal from './ProfileModal'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePageVisibility } from '../context/PageVisibilityContext'
import CompanySwitcher from './CompanySwitcher'
import NotificationBell from './NotificationBell'
import { useCompanyGuard } from '../hooks/useCompanyGuard'
import { tasksApi } from '../api'
import {
  LayoutDashboard, Package, Warehouse, Truck,
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Repeat2,
  ClipboardList, Users, Building2, BookOpen, LogOut,
  PackageOpen, Layers, ClipboardCheck, Menu, X, Eye, EyeOff,
  PackageCheck, Link2, BarChart2, BookMarked, ChevronDown,
  SendHorizonal, FileText, PanelLeftClose, PanelLeftOpen, UserCog,
  Laptop, Wallet, CalendarClock, ShieldCheck, AlarmClock, Receipt, ListChecks,
  Star, CheckCircle2, Home,
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
      { to: '/catalog',    icon: BookOpen,  label: 'Data Master',         pageKey: 'catalog', requirePermission: ['inventory.manage', 'channel.manage'] },
      { to: '/warehouses', icon: Warehouse, label: 'Gudang',              pageKey: 'warehouses' },
      { to: '/suppliers',  icon: Truck,     label: 'Vendor',              pageKey: 'suppliers' },
    ],
  },
  {
    label: 'Transaksi',
    items: [
      { to: '/stock-in',        icon: ArrowDownToLine, label: 'Penerimaan Stock',  pageKey: 'stock-in' },
      { to: '/stock-out',       icon: ArrowUpFromLine,  label: 'Pengeluaran Stock', pageKey: 'stock-out' },
      { to: '/movements',       icon: ArrowLeftRight,   label: 'Pergerakan',        pageKey: 'movements' },
      { to: '/transfers',       icon: Repeat2,          label: 'Transfer Stok',     pageKey: 'transfers', requirePermission: 'stock.transfer.view' },
      { to: '/opname',          icon: ClipboardList,    label: 'Stock Opname',      pageKey: 'opname' },
      { to: '/handover',        icon: PackageCheck,     label: 'Handover',          pageKey: 'handover' },
      { to: '/shipping-manual', icon: SendHorizonal,    label: 'Shipping Manual',   pageKey: 'shipping-manual', requirePermission: 'shipping.manual.view' },
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
    label: 'Pengajuan',
    items: [
      { to: '/pengajuan', icon: FileText, label: 'Pengajuan Stok' },
    ],
  },
  {
    label: 'Umum',
    items: [
      { to: '/database-links',  icon: Link2,         label: 'Database Links', pageKey: 'database-links' },
    ],
  },
]

// Home (Personal Dashboard) — halaman tunggal tanpa sub-halaman, jadi tidak
// butuh nav group apa pun di bawah ModuleSwitcher (lihat isHome di Layout).
const HOME_NAV_GROUPS = []

// Task Management module — halaman /tasks sudah punya sidebar internalnya
// sendiri (view Important/Assigned/dst, lihat TasksSidebar.jsx), jadi nav
// group di sini cukup 1 entri yang jadi pintu masuk ke module-nya (sama pola
// dengan Handbook). Quick-links langsung ke view spesifik ada di
// TASKS_QUICK_LINKS di bawah — dirender terpisah (bukan NavLink) supaya
// nav-active-path matching yang berbasis pathname tidak perlu tahu soal
// query string ?view=.
const TASKS_NAV_GROUPS = [
  {
    label: 'Task Management',
    items: [
      { to: '/tasks', icon: ListChecks, label: 'Papan Tugas' },
    ],
  },
]

// Shortcut ke view spesifik dalam modul Tugas — diklik dari sidebar utama
// tanpa harus masuk dulu ke /tasks lalu pilih dari sidebar internalnya.
// `statKey` (opsional) menampilkan badge angka dari GET /tasks/stats.
const TASKS_QUICK_LINKS = [
  { view: 'important', icon: Star,           label: 'Penting' },
  { view: 'assigned',  icon: ClipboardList,  label: 'Ditugaskan ke Saya', statKey: 'pendingAssignments' },
  { view: 'created',   icon: ListChecks,     label: 'Dibuat Saya' },
  { view: 'completed', icon: CheckCircle2,   label: 'Selesai' },
]

// Handbook module — sidebar kiri di-swap total ke sini saat pathname mulai
// dengan /handbook (lihat isHandbook di Layout). Tanpa requirePermission/
// superOnly/pageKey — visible untuk semua user yang login, sama seperti /sop.
const HANDBOOK_NAV_GROUPS = [
  {
    label: 'Company Handbook',
    items: [
      { to: '/handbook',           icon: BookOpen,  label: 'Beranda' },
      { to: '/handbook/kebijakan', icon: BookMarked, label: 'Kebijakan' },
      { to: '/handbook/struktur',  icon: Building2, label: 'Struktur Organisasi' },
    ],
  },
]

// HRIS module — presensi, cuti, lembur, dan pengaturan HR.
const HRIS_NAV_GROUPS = [
  {
    label: 'HRIS',
    items: [
      { to: '/hris',           icon: UserCog,       label: 'Beranda',   requirePermission: 'hris.view' },
      { to: '/hris/attendance', icon: ClipboardCheck, label: 'Presensi', requirePermission: 'hris.view' },
      // Eksperimen UX: Cuti+WFA+Izin Telat digabung jadi 1 nav "Pengajuan"
      // (mirip pola Mekari Talenta / Gusto). Kalau mau revert ke nav
      // terpisah, un-comment 3 baris di bawah & hapus baris /hris/pengajuan.
      { to: '/hris/pengajuan', icon: FileText,       label: 'Pengajuan', requirePermission: 'hris.view' },
      { to: '/hris/payslip',   icon: Receipt,        label: 'Slip Gaji', requirePermission: 'hris.view' },
      // { to: '/hris/leave',      icon: FileText,      label: 'Cuti',      requirePermission: 'hris.view' },
      // { to: '/hris/wfa',        icon: Laptop,        label: 'WFA',       requirePermission: 'hris.view' },
      // { to: '/hris/late-excuse', icon: AlarmClock,   label: 'Izin Telat', requirePermission: 'hris.view' },
      // Lembur disembunyikan sementara dari nav — route tetap ada di App.jsx
      // { to: '/hris/overtime', icon: ClipboardList, label: 'Lembur',    requirePermission: 'hris.view' },
    ],
  },
  {
    label: 'Pengaturan HR',
    items: [
      { to: '/hris/admin/shifts',       icon: CalendarClock, label: 'Shift',         requirePermission: 'hris.shift.manage' },
      { to: '/hris/admin/attendance-review', icon: ClipboardCheck, label: 'Persetujuan Presensi', requirePermission: 'hris.attendance.review' },
      { to: '/hris/admin/locations',    icon: Warehouse,     label: 'Lokasi Kantor', requirePermission: 'hris.location.manage' },
      { to: '/hris/admin/leave-quota',  icon: FileText,      label: 'Kuota Cuti',    requirePermission: 'hris.manage' },
      { to: '/hris/admin/wfa-quota',    icon: Laptop,        label: 'Kuota WFA',     requirePermission: 'hris.manage' },
      { to: '/hris/admin/work-policy',  icon: CalendarClock, label: 'Aturan Jam Kerja', requirePermission: 'hris.manage' },
      { to: '/hris/payment-adjustments', icon: Wallet,       label: 'Penyesuaian Payment', requirePermission: 'hris.reports.view' },
      { to: '/hris/admin/salary-profiles', icon: Wallet,     label: 'Profil Gaji',   requirePermission: 'hris.salary.manage' },
      { to: '/hris/admin/payslips',     icon: Receipt,       label: 'Slip Gaji (Admin)', requirePermission: 'hris.payslip.manage' },
      { to: '/hris/reports',            icon: BarChart2,     label: 'Laporan HRIS', requirePermission: 'hris.reports.view' },
    ],
  },
]

// Admin module — administrasi platform (pengguna, roles, perusahaan,
// visibilitas halaman). Cross-cutting, jadi dipisah dari Inventory & HRIS.
const ADMIN_NAV_GROUPS = [
  {
    label: 'Administrasi',
    items: [
      { to: '/users',           icon: Users,     label: 'Pengguna',            pageKey: 'users' },
      { to: '/roles',           icon: ShieldCheck, label: 'Roles & Permission', pageKey: 'users' },
      { to: '/companies',       icon: Building2, label: 'Perusahaan',          pageKey: 'companies', superOnly: true },
      { to: '/page-visibility', icon: Eye,       label: 'Visibilitas Halaman',                       superOnly: true },
    ],
  },
]

const PAGE_TITLES = {
  '/home': 'Beranda', '/dashboard': 'Dashboard', '/sop': 'SOP Operasional', '/products': 'Produk', '/catalog': 'Data Master',
  '/handbook': 'Company Handbook', '/handbook/kebijakan': 'Kebijakan Perusahaan', '/handbook/struktur': 'Struktur Organisasi',
  '/hris': 'HRIS', '/hris/attendance': 'Presensi', '/hris/leave': 'Cuti', '/hris/wfa': 'WFA', '/hris/late-excuse': 'Izin Telat', '/hris/pengajuan': 'Pengajuan',
  '/hris/admin/shifts': 'Kelola Shift', '/hris/admin/attendance-review': 'Persetujuan Presensi', '/hris/admin/locations': 'Kelola Lokasi Kantor', '/hris/reports': 'Laporan HRIS',
  '/hris/admin/leave-quota': 'Kuota Cuti', '/hris/admin/wfa-quota': 'Kuota WFA', '/hris/admin/work-policy': 'Aturan Jam Kerja', '/hris/payment-adjustments': 'Penyesuaian Payment',
  '/hris/payslip': 'Slip Gaji Saya', '/hris/admin/salary-profiles': 'Profil Gaji', '/hris/admin/payslips': 'Slip Gaji',
  '/warehouses': 'Gudang', '/suppliers': 'Vendor',
  '/stock-in': 'Penerimaan Stok', '/stock-in/new': 'Penerimaan Stok Baru', '/stock-out': 'Pengeluaran Stok', '/movements': 'Pergerakan',
  '/opname': 'Stock Opname', '/transfers': 'Transfer Stok', '/handover': 'Handover Pengiriman',
  '/shipping-manual': 'Shipping Manual', '/database-links': 'Database Links', '/users': 'Pengguna', '/roles': 'Roles & Permission', '/companies': 'Perusahaan',
  '/vendors': 'Vendor', '/incoming-goods': 'Barang Masuk',
  '/packing-jobs': 'Pekerjaan Packing', '/form-anak-packing': 'Form Anak Packing',
  '/page-visibility': 'Visibilitas Halaman',
  '/laporan': 'Laporan Bulanan',
  '/pengajuan': 'Pengajuan Stok', '/pengajuan/baru': 'Buat Pengajuan',
  '/tasks': 'Tugas',
}

function groupHasActivePath(group, pathname) {
  return group.items.some(item => pathname === item.to || pathname.startsWith(item.to + '/'))
}

// Tooltip wrapper untuk icon-only mode
function NavTooltip({ label, children }) {
  return (
    <div className="relative group/tooltip">
      {children}
      <div
        className="
          pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50
          px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap
          bg-slate-800 text-white shadow-lg
          opacity-0 group-hover/tooltip:opacity-100
          translate-x-1 group-hover/tooltip:translate-x-0
          transition-all duration-150
        "
      >
        {label}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800" />
      </div>
    </div>
  )
}

// Module switcher — toggle antara Personal Dashboard, HRIS, Tugas, Inventory,
// Handbook, dan Admin. Urutan kiri-ke-kanan/atas-ke-bawah sengaja mengikuti
// frekuensi pakai harian (Beranda & HRIS dulu, baru Inventory/Admin).
function ModuleSwitcher({ collapsed, activeModule, tasksBadge }) {
  const navigate = useNavigate()
  const { hasPermission, isSuperAdmin, isAdmin } = useAuth()
  const items = [
    { key: 'home',      label: 'Beranda',  icon: Home,       to: '/home',      active: activeModule === 'home' },
    ...(isSuperAdmin || hasPermission('hris.view')
      ? [{ key: 'hris', label: 'HRIS', icon: UserCog, to: '/hris', active: activeModule === 'hris' }]
      : []),
    { key: 'tasks',     label: 'Tugas',     icon: ListChecks, to: '/tasks',     active: activeModule === 'tasks', badge: tasksBadge },
    { key: 'inventory', label: 'Inventory', icon: Package,    to: '/dashboard', active: activeModule === 'inventory' },
    { key: 'handbook',  label: 'Handbook',   icon: BookOpen, to: '/handbook',  active: activeModule === 'handbook' },
    ...(isAdmin || hasPermission('admin.users')
      ? [{ key: 'admin', label: 'Admin', icon: ShieldCheck, to: '/users', active: activeModule === 'admin' }]
      : []),
  ]

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 py-2 flex-shrink-0" style={{ borderBottom: '1px solid #E0DDD7' }}>
        {items.map(item => {
          const Icon = item.icon
          return (
            <NavTooltip key={item.key} label={item.badge ? `${item.label} (${item.badge})` : item.label}>
              <button
                type="button"
                onClick={() => navigate(item.to)}
                className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                  item.active ? 'text-white' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/60'
                }`}
                style={item.active ? { background: BRAND } : undefined}
              >
                <Icon size={15} />
                {!!item.badge && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger ring-2 ring-white" />
                )}
              </button>
            </NavTooltip>
          )
        })}
      </div>
    )
  }

  return (
    <div className="px-3 pt-3 pb-2 flex-shrink-0" style={{ borderBottom: '1px solid #E0DDD7' }}>
      {/* grid (bukan flex 1-baris) — begitu item bertambah (mis. HRIS/Admin
          aktif buat user itu), otomatis lanjut ke baris ke-2/3 alih-alih
          jadi kepenyet berdempetan */}
      <div className="p-1 rounded-lg bg-slate-200/50 grid grid-cols-3 gap-1">
        {items.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate(item.to)}
              title={item.badge ? `${item.label} (${item.badge})` : item.label}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md text-[9px] font-semibold leading-none transition-colors ${
                item.active ? 'text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
              style={item.active ? { background: BRAND } : undefined}
            >
              <span className="relative">
                <Icon size={14} />
                {!!item.badge && (
                  <span className="absolute -top-0.5 -right-1.5 min-w-[12px] h-[12px] px-0.5 rounded-full bg-danger text-white text-[8px] font-bold flex items-center justify-center leading-none">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </span>
              <span className="truncate max-w-full">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Layout({ children }) {
  const { user, signOut, isSuperAdmin, hasPermission } = useAuth()
  const { needsCompany } = useCompanyGuard()
  const { isPageVisible } = usePageVisibility()
  const navigate  = useNavigate()
  const location  = useLocation()

  // Ringan & jarang berubah — dipakai buat badge "Ditugaskan ke Saya" di quick
  // links Tugas + titik merah di pill ModuleSwitcher, jadi kelihatan dari
  // module manapun kalau ada assignment yang menunggu respon.
  const { data: taskStats } = useQuery({
    queryKey: ['tasks-stats-badge'],
    queryFn: tasksApi.stats,
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  // Home (Personal Dashboard) — halaman mandiri tanpa sub-nav sendiri, jadi
  // sidebar di bawahnya sengaja kosong (lihat HOME_NAV_GROUPS) alih-alih
  // "jatuh" ke NAV_GROUPS Inventory seperti sebelumnya, yang bikin pill
  // Inventory ke-highlight padahal user lagi di halaman netral.
  const isHome      = location.pathname === '/home'
  const isHandbook  = location.pathname.startsWith('/handbook')
  const isHRIS      = location.pathname.startsWith('/hris')
  const isTasksModule = location.pathname.startsWith('/tasks')
  const isAdminModule = ['/users', '/roles', '/companies', '/page-visibility'].some(
    (p) => location.pathname === p || location.pathname.startsWith(p + '/')
  )
  const activeModule = isHome ? 'home' : isHandbook ? 'handbook' : isHRIS ? 'hris' : isTasksModule ? 'tasks' : isAdminModule ? 'admin' : 'inventory'
  const activeGroups = isHome ? HOME_NAV_GROUPS : isHandbook ? HANDBOOK_NAV_GROUPS : isHRIS ? HRIS_NAV_GROUPS : isTasksModule ? TASKS_NAV_GROUPS : isAdminModule ? ADMIN_NAV_GROUPS : NAV_GROUPS
  // Path yang punya "anak" (mis. /hris punya /hris/attendance, dst) butuh `end`
  // di NavLink, kalau tidak dia akan tetap ke-highlight walau lagi di sub-route.
  const allNavPaths = activeGroups.flatMap(g => g.items.map(i => i.to))
  const needsEndMatch = (to) => to === '/' || allNavPaths.some(p => p !== to && p.startsWith(to + '/'))

  // Mobile drawer
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Desktop collapse — persisted
  const [collapsed, setCollapsed] = useState(() =>
    localStorage.getItem('sidebar-collapsed') === 'true'
  )

  const [profileOpen, setProfileOpen] = useState(false)

  // Accordion groups (hanya relevan saat expanded) — default: buka semua group
  const [openGroups, setOpenGroups] = useState(() =>
    new Set([...NAV_GROUPS, ...HOME_NAV_GROUPS, ...HANDBOOK_NAV_GROUPS, ...HRIS_NAV_GROUPS, ...TASKS_NAV_GROUPS, ...ADMIN_NAV_GROUPS].map(g => g.label))
  )

  // Auto-open group saat navigasi
  useEffect(() => {
    const active = activeGroups.find(g => groupHasActivePath(g, location.pathname))
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

  const toggleCollapse = useCallback(() => {
    setCollapsed(v => {
      localStorage.setItem('sidebar-collapsed', String(!v))
      return !v
    })
  }, [])

  // ⌘B / Ctrl+B — toggle sidebar
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleCollapse()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleCollapse])

  const handleSignOut = () => { signOut(); navigate('/login') }
  const closeSidebar  = () => setSidebarOpen(false)
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Preface Inventory System'

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}

      {/* ── Mobile backdrop ──────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside
        className={[
          'fixed md:relative inset-y-0 left-0 z-30',
          'flex-shrink-0 flex flex-col',
          'transition-[width,transform] duration-300 ease-in-out',
          collapsed ? 'md:w-[60px]' : 'w-60',
          sidebarOpen ? 'translate-x-0 w-60' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
        style={{ background: '#F5F3EF', borderRight: '1px solid #E0DDD7', boxShadow: '2px 0 8px rgba(0,0,0,0.04)' }}
      >
        {/* ── Logo — klik buat balik ke Personal Dashboard (/home) ── */}
        <button
          type="button"
          onClick={() => navigate('/home')}
          title="Beranda"
          className="flex items-center h-14 flex-shrink-0 overflow-hidden hover:bg-slate-200/40 transition-colors"
          style={{ borderBottom: '1px solid #E0DDD7', padding: collapsed ? '0 12px' : '0 16px' }}
        >
          <img
            src={logoPreface}
            alt="Preface"
            className="w-7 h-7 rounded object-cover flex-shrink-0"
          />
          <div
            className="ml-3 min-w-0 overflow-hidden transition-all duration-300 text-left"
            style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto', maxWidth: collapsed ? 0 : 200 }}
          >
            <p className="font-bold text-sm text-slate-800 leading-tight whitespace-nowrap">Preface</p>
            <p className="text-[10px] text-slate-400 leading-tight whitespace-nowrap">
              {isHome ? 'Personal Dashboard' : isHandbook ? 'Company Handbook' : isHRIS ? 'HRIS' : isTasksModule ? 'Task Management' : isAdminModule ? 'Administrasi' : 'Inventory System'}
            </p>
          </div>
        </button>

        {/* ── Nav ── */}
        <ModuleSwitcher collapsed={collapsed} activeModule={activeModule} tasksBadge={taskStats?.pendingAssignments ?? 0} />

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3" style={{ padding: collapsed ? '12px 8px' : '12px 12px' }}>
          {/* Tugas: quick links langsung ke view spesifik + mini ringkasan —
              biar nav-nya nggak cuma 1 baris kosong ("Papan Tugas") begitu
              masuk ke module ini. Pakai onClick+navigate (bukan NavLink)
              karena target-nya query string (?view=), bukan path baru. */}
          {isTasksModule && !collapsed && (
            <div className="mb-3 p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm">
              <p className="px-0.5 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Akses Cepat</p>
              <div className="space-y-0.5">
                {TASKS_QUICK_LINKS.map(link => {
                  const Icon = link.icon
                  const badge = link.statKey ? taskStats?.[link.statKey] : null
                  return (
                    <button
                      key={link.view}
                      type="button"
                      onClick={() => navigate(`/tasks?view=${link.view}`)}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                    >
                      <span className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Icon size={12} strokeWidth={2.2} />
                      </span>
                      <span className="flex-1 text-left text-[13px] font-medium truncate">{link.label}</span>
                      {!!badge && (
                        <span className="flex-shrink-0 text-[10px] font-bold text-white bg-danger px-1.5 py-0.5 rounded-full leading-none">
                          {badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {activeGroups.map((group) => {
            const navItems = group.items.reduce((acc, item) => {
              if (item.superOnly && !isSuperAdmin) return acc
              if (item.requirePermission && !isSuperAdmin) {
                const perms = Array.isArray(item.requirePermission) ? item.requirePermission : [item.requirePermission]
                if (!perms.some(hasPermission)) return acc
              }
              const hidden = !!(item.pageKey && !isPageVisible(item.pageKey))
              if (hidden && !isSuperAdmin) return acc
              acc.push({ ...item, hidden })
              return acc
            }, [])

            if (!navItems.length) return null

            const isOpen   = openGroups.has(group.label)
            const isActive = groupHasActivePath(group, location.pathname)

            // ── COLLAPSED mode: icon-only, no accordion ──
            if (collapsed) {
              return (
                <div key={group.label} className="mb-3">
                  {/* Divider antar group */}
                  <div className="mx-1 mb-2 border-t border-slate-200/80" />
                  <div className="space-y-0.5">
                    {navItems.map((item) => {
                      const Icon = item.icon
                      return (
                        <NavTooltip key={item.to} label={item.label}>
                          <NavLink
                            to={item.to}
                            end={needsEndMatch(item.to)}
                            onClick={closeSidebar}
                            style={({ isActive }) => isActive
                              ? { background: BRAND, color: '#fff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 36, margin: '0 auto' }
                              : { borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 36, margin: '0 auto' }
                            }
                            className={({ isActive }) =>
                              `transition-colors duration-100 ${isActive ? '' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/70'}`
                            }
                          >
                            {({ isActive }) => (
                              <Icon size={16} strokeWidth={isActive ? 2.5 : 1.8} className={item.hidden && !isActive ? 'opacity-40' : ''} />
                            )}
                          </NavLink>
                        </NavTooltip>
                      )
                    })}
                  </div>
                </div>
              )
            }

            // ── EXPANDED mode: accordion groups ──
            return (
              <div key={group.label} className="mb-1">
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
                          end={needsEndMatch(item.to)}
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
                              <Icon
                                size={14}
                                strokeWidth={isActive ? 2.5 : 2}
                                className={`flex-shrink-0 ${item.hidden && !isActive ? 'opacity-50' : ''}`}
                              />
                              <span className={`flex-1 truncate text-[13px] ${item.hidden && !isActive ? 'opacity-60' : ''}`}>
                                {item.label}
                              </span>
                              {item.hidden && (
                                <EyeOff size={10} className="flex-shrink-0 opacity-40" title="Halaman disembunyikan" />
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

        {/* ── User footer ── */}
        <div style={{ borderTop: '1px solid #E0DDD7' }} className="p-2 flex-shrink-0">
          {collapsed ? (
            <NavTooltip label={user?.name ?? 'Profil'}>
              <button
                onClick={() => setProfileOpen(true)}
                className="w-full flex items-center justify-center py-2 rounded-md hover:bg-slate-200/50 transition-colors"
                title="Edit profil"
              >
                {user?.avatar
                  ? <img src={user.avatar} alt="avatar" className="w-7 h-7 rounded-full object-cover border border-slate-200" />
                  : (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: BRAND }}>
                      <span className="text-xs font-bold text-white">{user?.name?.[0]?.toUpperCase()}</span>
                    </div>
                  )
                }
              </button>
            </NavTooltip>
          ) : (
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
          )}
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 flex-shrink-0 shadow-sm">

          {/* Mobile hamburger */}
          <button
            className="md:hidden w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors flex-shrink-0"
            onClick={() => setSidebarOpen(v => !v)}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Desktop collapse toggle */}
          <button
            className="hidden md:flex w-8 h-8 items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors flex-shrink-0"
            onClick={toggleCollapse}
            title={collapsed ? 'Buka sidebar (⌘B)' : 'Sembunyikan sidebar (⌘B)'}
          >
            {collapsed
              ? <PanelLeftOpen size={16} />
              : <PanelLeftClose size={16} />
            }
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-slate-800 truncate">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-2">
            <CompanySwitcher />
            <NotificationBell />
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
