import { Building2 } from 'lucide-react'

export default function CompanyRequiredBanner({ action = 'melakukan operasi ini' }) {
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
      <Building2 size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-semibold text-amber-800">Pilih perusahaan terlebih dahulu</p>
        <p className="text-amber-600 text-xs mt-0.5">
          Gunakan <strong>Company Switcher</strong> di pojok kanan atas untuk memilih perusahaan sebelum {action}.
        </p>
      </div>
    </div>
  )
}
