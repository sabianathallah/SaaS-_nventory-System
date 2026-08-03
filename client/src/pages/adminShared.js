import {
  LayoutDashboard, Package, Boxes, Truck, PackageCheck, ArrowLeftRight,
  BarChart2, Link2, Settings, Send, ClipboardList, UserCog, ListChecks,
} from 'lucide-react'

// Helper bersama untuk halaman Pengguna (Users.jsx) dan Roles & Permission
// (Roles.jsx) — dipisah dari 1 halaman jadi 2 halaman terpisah supaya
// pengelolaan permission (resiko tinggi, blast radius ke semua user dengan
// role itu) tidak berbagi ruang dengan CRUD user rutin.

export const GROUP_META = {
  'Dasbor':                { icon: LayoutDashboard, color: '#6366F1' },
  'Produk & Katalog':      { icon: Package,         color: '#F97316' },
  'Stok':                  { icon: Boxes,           color: '#10B981' },
  'Handover Pengiriman':   { icon: Truck,           color: '#06B6D4' },
  'Penerimaan & Packing':  { icon: PackageCheck,    color: '#8B5CF6' },
  'Shipping Manual':       { icon: Send,            color: '#3B82F6' },
  'Pengajuan':             { icon: ClipboardList,   color: '#A855F7' },
  'Transfer Stok':         { icon: ArrowLeftRight,  color: '#14B8A6' },
  'Laporan':               { icon: BarChart2,       color: '#F59E0B' },
  'Database Links':        { icon: Link2,           color: '#64748B' },
  'Administrasi':          { icon: Settings,        color: '#EF4444' },
  'HRIS':                  { icon: UserCog,         color: '#0EA5E9' },
  'Task Management':       { icon: ListChecks,      color: '#F43F5E' },
}

export const SYSTEM_ROLE_STYLE = {
  SUPER_ADMIN:   'bg-red-100 text-red-700',
  COMPANY_ADMIN: 'bg-blue-100 text-blue-700',
  OPERASIONAL:   'bg-teal-100 text-teal-700',
  TIM_PACKING:   'bg-violet-100 text-violet-700',
}

export const COLOR_PALETTE = ['#F97316','#10B981','#06B6D4','#8B5CF6','#EF4444','#F59E0B','#6366F1','#14B8A6','#84CC16','#EC4899']

export function roleColorIndex(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xFFFFFF
  return h % COLOR_PALETTE.length
}

export function roleColor(name) {
  const PRESET = { SUPER_ADMIN:'#EF4444', COMPANY_ADMIN:'#3B82F6', OPERASIONAL:'#14B8A6', TIM_PACKING:'#8B5CF6' }
  return PRESET[name] ?? COLOR_PALETTE[roleColorIndex(name)]
}
