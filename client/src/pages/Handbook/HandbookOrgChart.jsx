function NodeBox({ title, subtitle, name, accent }) {
  return (
    <div className={`rounded-lg px-4 py-3 text-center w-full ${
      accent
        ? 'bg-brand-50 border-2 border-brand text-brand-dark'
        : 'bg-white border-2 border-slate-300 shadow-card'
    }`}>
      <p className="font-bold text-sm">{title}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      {name && <p className="text-xs text-slate-600 mt-1">{name}</p>}
    </div>
  )
}

function UnitBox({ title, name }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2 text-center w-full">
      <p className="font-semibold text-xs text-slate-700">{title}</p>
      <p className="text-slate-500 text-[11px] mt-0.5">{name}</p>
    </div>
  )
}

function VLine({ h = 'h-6' }) {
  return <div className={`w-0.5 ${h} bg-slate-300 my-3`} />
}

export default function HandbookOrgChart() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <div className="card p-6 md:p-10">
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-8">
          Struktur Organisasi PREFACE
        </h2>

        <div className="flex flex-col items-center">
          <div className="w-full max-w-xs">
            <NodeBox title="BOARD OF DIRECTORS (BOD)" name="M. Akbar Fadillah" accent />
          </div>
          <VLine h="h-8" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {/* Corporate Support Division */}
          <div className="flex flex-col items-center">
            <NodeBox title="CORPORATE SUPPORT DIVISION" subtitle="AND LEAD OF BOD" />
            <VLine />
            <div className="grid grid-cols-2 gap-3 w-full">
              <UnitBox title="Finance Unit" name="Jihad Wisnu B" />
              <UnitBox title="HR, GA, and PR Unit" name="M Sabian Athallah" />
            </div>
            <div className="w-full mt-3">
              <UnitBox title="Secretary Unit" name="Azzahra Adellia" />
            </div>
          </div>

          {/* Product & Creative Division */}
          <div className="flex flex-col items-center">
            <NodeBox title="PRODUCT & CREATIVE DIVISION" name="Albir Lukmansyah" />
            <VLine />
            <div className="space-y-3 w-full">
              <UnitBox title="Creative Unit" name="M Ariz Adani" />
              <UnitBox title="Product Development Unit" name="M Wafi Athallah" />
              <UnitBox title="Marketing Unit" name="Dimyati" />
            </div>
          </div>

          {/* Operations Division */}
          <div className="flex flex-col items-center">
            <NodeBox title="OPERATIONS DIVISION" name="M Wafi Athallah" />
            <VLine />
            <div className="space-y-3 w-full">
              <UnitBox title="Operational Unit" name="Rayfanza Harsa T" />
              <UnitBox title="Production Unit" name="Biana Rizky N" />
              <UnitBox title="Support Unit" name="Dimyati" />
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            <span className="font-semibold text-slate-500">Catatan:</span> Struktur organisasi PREFACE dirancang untuk mendukung kolaborasi lintas divisi dan efisiensi operasional.
          </p>
        </div>
      </div>
    </div>
  )
}
