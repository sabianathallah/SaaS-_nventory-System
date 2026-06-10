import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePageVisibility } from '../context/PageVisibilityContext'
import { systemApi } from '../api'
import {
  Package, BookOpen, Warehouse, Truck,
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
  ClipboardList, PackageOpen, Layers,
  ClipboardCheck, Users, Building2, Eye, EyeOff, Save, PackageCheck, Link2, BarChart2,
} from 'lucide-react'

const PAGE_GROUPS = [
  {
    label: 'Ringkasan',
    items: [
      { key: 'laporan', label: 'Laporan Bulanan', icon: BarChart2 },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { key: 'products',   label: 'Products',   icon: Package },
      { key: 'catalog',    label: 'Katalog',    icon: BookOpen },
      { key: 'warehouses', label: 'Warehouses', icon: Warehouse },
      { key: 'suppliers',  label: 'Vendor',  icon: Truck },
    ],
  },
  {
    label: 'Transactions',
    items: [
      { key: 'stock-in',   label: 'Stock In',       icon: ArrowDownToLine },
      { key: 'stock-out',  label: 'Stock Out',      icon: ArrowUpFromLine },
      { key: 'movements',  label: 'Movements',      icon: ArrowLeftRight },
      { key: 'opname',     label: 'Stock Opname',   icon: ClipboardList },
      { key: 'handover',   label: 'Handover',       icon: PackageCheck },
    ],
  },
  {
    label: 'Penerimaan Barang Vendor',
    items: [
      { key: 'vendors',        label: 'Vendors',      icon: Truck },
      { key: 'incoming-goods', label: 'Barang Masuk', icon: PackageOpen },
    ],
  },
  {
    label: 'Packing',
    items: [
      { key: 'packing-jobs',      label: 'Packing Jobs',      icon: Layers },
      { key: 'form-anak-packing', label: 'Form Anak Packing', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Umum',
    items: [
      { key: 'database-links', label: 'Database Links', icon: Link2 },
    ],
  },
  {
    label: 'Administration',
    items: [
      { key: 'users',     label: 'Users',     icon: Users },
      { key: 'companies', label: 'Companies', icon: Building2 },
    ],
  },
]

export default function PageVisibility() {
  const { isSuperAdmin } = useAuth()
  const { visibility, refresh } = usePageVisibility()
  const navigate = useNavigate()

  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  useEffect(() => {
    if (visibility) setDraft({ ...visibility })
  }, [visibility])

  useEffect(() => {
    if (!isSuperAdmin) navigate('/', { replace: true })
  }, [isSuperAdmin, navigate])

  const toggle = (key) => {
    setDraft(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await systemApi.updatePageVisibility(draft)
      refresh()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      alert(err?.response?.data?.message ?? 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  if (!visibility) {
    return (
      <div className="p-6 text-slate-400 text-sm">Memuat pengaturan…</div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Visibilitas Halaman</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Halaman yang disembunyikan tidak muncul di sidebar dan dialihkan ke Dashboard.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white transition-colors"
          style={{ background: saved ? '#16a34a' : '#C8102E', opacity: saving ? 0.7 : 1 }}
        >
          <Save size={12} />
          {saved ? 'Tersimpan!' : saving ? 'Menyimpan…' : 'Simpan Perubahan'}
        </button>
      </div>

      {PAGE_GROUPS.map((group) => (
        <div key={group.label} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{group.label}</p>
          </div>
          <div className="divide-y divide-slate-100">
            {group.items.map(({ key, label, icon: Icon }) => {
              const visible = draft[key] !== false
              return (
                <div key={key} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${visible ? 'bg-slate-100' : 'bg-slate-50'}`}>
                    <Icon size={14} className={visible ? 'text-slate-600' : 'text-slate-300'} />
                  </div>
                  <span className={`flex-1 text-sm font-medium ${visible ? 'text-slate-800' : 'text-slate-400'}`}>
                    {label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${visible ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {visible ? 'Visible' : 'Hidden'}
                    </span>
                    <button
                      onClick={() => toggle(key)}
                      title={visible ? 'Sembunyikan' : 'Tampilkan'}
                      className={`w-9 h-5 rounded-full relative transition-colors duration-200 focus:outline-none ${visible ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${visible ? 'translate-x-4' : 'translate-x-0.5'}`}
                      />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
