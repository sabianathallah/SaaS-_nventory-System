import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Package, UserCog, BookOpen, ShieldCheck, ChevronRight } from 'lucide-react'

const BRAND = '#C8102E'

const INVENTORY_PERMISSIONS = [
  'inventory.view', 'inventory.manage', 'inventory.product.create', 'inventory.product.edit',
  'stock.in.view', 'stock.out.view', 'stock.view', 'stock.opname.view', 'stock.transfer.view',
  'shipping.manual.view', 'shipping.manual.create', 'shipping.manual.edit',
  'packing.manage', 'packing.incoming', 'packing.jobs', 'packing.view',
  'handover.view', 'db_link.view', 'reports.manage',
]

function ModuleCard({ icon: Icon, title, desc, to, accent = BRAND }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="card group flex items-center gap-4 px-5 py-5 text-left w-full hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: accent + '18' }}
      >
        <Icon size={22} style={{ color: accent }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-slate-800">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
      </div>
      <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
    </button>
  )
}

export default function Home() {
  const { user, isAdmin, hasPermission } = useAuth()

  const hasInventory = isAdmin || INVENTORY_PERMISSIONS.some((p) => hasPermission(p))
  const hasHris       = isAdmin || hasPermission('hris.view')
  const hasAdminModule = isAdmin || hasPermission('admin.users')

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
        Selamat datang, {user?.name?.split(' ')[0]}
      </p>
      <h1 className="text-2xl font-bold text-slate-800 mb-8">Mau buka yang mana?</h1>

      <div className="space-y-3">
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
  )
}
