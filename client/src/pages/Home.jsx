import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Package, UserCog, BookOpen, ShieldCheck, ListChecks, ChevronRight } from 'lucide-react'
import MyDayToday from '../components/tasks/MyDayToday'
import CompletedHistory from '../components/tasks/CompletedHistory'
import PresensiWidget from '../components/hris/PresensiWidget'

const BRAND = '#C8102E'

const INVENTORY_PERMISSIONS = [
  'inventory.view', 'inventory.manage', 'inventory.product.create', 'inventory.product.edit',
  'stock.in.view', 'stock.out.view', 'stock.view', 'stock.opname.view', 'stock.transfer.view',
  'shipping.manual.view', 'shipping.manual.create', 'shipping.manual.edit',
  'packing.manage', 'packing.incoming', 'packing.jobs', 'packing.view',
  'handover.view', 'db_link.view', 'reports.manage',
]

const GREETINGS = ['Selamat pagi', 'Selamat siang', 'Selamat sore', 'Selamat malam']
function greeting() {
  const h = new Date().getHours()
  if (h < 11) return GREETINGS[0]
  if (h < 15) return GREETINGS[1]
  if (h < 19) return GREETINGS[2]
  return GREETINGS[3]
}

function ModuleCard({ icon: Icon, title, desc, to, accent = BRAND }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="card group flex items-center gap-3.5 px-4 py-4 text-left w-full hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: accent + '18' }}
      >
        <Icon size={18} style={{ color: accent }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-slate-800 text-sm">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{desc}</p>
      </div>
      <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
    </button>
  )
}

// Personal Dashboard — landing universal buat semua user setelah login
// (lihat RootRoute di App.jsx). Isinya khusus kepentingan personal: My Day +
// riwayat selesai, presensi, dan quick access ke modul yang dipunya user.
// Ringkasan data inventaris murni ada di /dashboard, terpisah dari sini.
export default function Home() {
  const { user, isAdmin, hasPermission } = useAuth()

  const hasInventory = isAdmin || INVENTORY_PERMISSIONS.some((p) => hasPermission(p))
  const hasHris       = isAdmin || hasPermission('hris.view')
  const hasAdminModule = isAdmin || hasPermission('admin.users')

  return (
    <div className="px-4 md:px-6 py-6 max-w-4xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
          {greeting()}, {user?.name?.split(' ')[0]}
        </p>
        <h1 className="text-xl font-bold text-slate-800">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </h1>
      </div>

      {hasHris && <PresensiWidget />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MyDayToday />
        <CompletedHistory />
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2.5">Akses Cepat</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {hasInventory && (
            <ModuleCard
              icon={Package}
              title="Inventory System"
              desc="Produk, gudang, stok, transaksi, dan laporan"
              to="/dashboard"
            />
          )}
          {hasHris && (
            <ModuleCard
              icon={UserCog}
              title="HRIS"
              desc="Presensi, cuti, WFA, dan pengaturan HR"
              to="/hris"
              accent="#3B82F6"
            />
          )}
          <ModuleCard
            icon={ListChecks}
            title="Tugas"
            desc="Kelola seluruh task — board, kalender, tabel"
            to="/tasks"
            accent="#7C3AED"
          />
          <ModuleCard
            icon={BookOpen}
            title="Company Handbook"
            desc="Kebijakan dan struktur organisasi perusahaan"
            to="/handbook"
            accent="#10B981"
          />
          {hasAdminModule && (
            <ModuleCard
              icon={ShieldCheck}
              title="Administrasi"
              desc="Pengguna, roles & permission, perusahaan, visibilitas halaman"
              to="/users"
              accent="#8B5CF6"
            />
          )}
        </div>
      </div>
    </div>
  )
}
