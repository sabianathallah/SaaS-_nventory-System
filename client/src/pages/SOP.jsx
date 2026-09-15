import { useState } from 'react'
import { Download } from 'lucide-react'

const SOP_LIST = [
  {
    id: 'penerimaan',
    title: 'Penerimaan Barang & QC',
    description: 'Alur dari barang datang, pendataan kuantitas, konfirmasi vendor, packing, QC, hingga scan in ke gudang.',
    file: '/sop/flow_penerimaan_barang_dan_qc.svg',
    tags: ['Operasional', 'QC', 'Gudang'],
    color: '#0c447c',
    border: '#85b7eb',
  },
  {
    id: 'pengajuan',
    title: 'Pengajuan Stock & Handover',
    description: 'Alur dari pengajuan stock divisi terkait, cek ketersediaan, scan out, hingga handover.',
    file: '/sop/flow_pengajuan_stock_dan_handover.svg',
    tags: ['Stock Out', 'Handover'],
    color: '#085041',
    border: '#5dcaa5',
  },
  {
    id: 'opname',
    title: 'Stock Opname & Rekonsiliasi',
    description: 'Stock opname terjadwal lewat SO digital atau langsung, dicocokkan dengan data sistem, selisih diinvestigasi.',
    file: '/sop/flow_stock_opname_rekonsiliasi.svg',
    tags: ['Opname', 'Rekonsiliasi'],
    color: '#3c3489',
    border: '#afa9ec',
  },
]

export default function SOP() {
  const [active, setActive] = useState(SOP_LIST[0])

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

      {/* ── Left panel ── */}
      <div style={{
        width: 272, flexShrink: 0,
        borderRight: '1px solid #e8e5df',
        background: '#faf9f5',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #e8e5df' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9a9690' }}>
            SOP Operasional
          </p>
          <p style={{ fontSize: 12, color: '#b8b4ac', marginTop: 2 }}>
            {SOP_LIST.length} dokumen
          </p>
        </div>

        <nav style={{ padding: '8px 8px' }}>
          {SOP_LIST.map(sop => {
            const isActive = active.id === sop.id
            return (
              <button
                key={sop.id}
                onClick={() => setActive(sop)}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '10px 12px', borderRadius: 8,
                  border: isActive ? `1px solid ${sop.border}40` : '1px solid transparent',
                  background: isActive ? `${sop.color}18` : 'transparent',
                  cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start',
                  marginBottom: 2, transition: 'all 0.15s',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontSize: 12, fontWeight: 600, lineHeight: 1.4,
                    color: isActive ? '#1a1a18' : '#4a4744',
                    marginBottom: 2,
                  }}>
                    {sop.title}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {sop.tags.map(tag => (
                      <span key={tag} style={{
                        fontSize: 9, fontWeight: 600, padding: '1px 5px',
                        borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.04em',
                        background: isActive ? `${sop.color}25` : '#eceae4',
                        color: isActive ? sop.border : '#9a9690',
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            )
          })}
        </nav>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f5f3ef' }}>

        {/* Header */}
        <div style={{
          padding: '14px 24px', borderBottom: '1px solid #e8e5df',
          background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h1 style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{active.title}</h1>
            <p style={{ fontSize: 12, color: '#9a9690', marginTop: 2 }}>{active.description}</p>
          </div>
          <a
            href={active.file}
            download
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
              background: '#f5f3ef', border: '1px solid #e0ddd7', color: '#4a4744',
              textDecoration: 'none', flexShrink: 0, transition: 'background 0.15s',
            }}
          >
            <Download size={13} /> Download SVG
          </a>
        </div>

        {/* SVG viewer */}
        <div style={{
          flex: 1, overflow: 'auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 32,
          background: 'radial-gradient(ellipse at center, #222220 0%, #111110 100%)',
        }}>
          <img
            key={active.id}
            src={active.file}
            alt={active.title}
            style={{
              maxWidth: '100%', maxHeight: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.4))',
            }}
          />
        </div>
      </div>

    </div>
  )
}
