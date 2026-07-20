import { useState } from 'react'
import { renderMarkdown } from './taskConfig'

export default function DescriptionEditor({ value, onChange, onBlur }) {
  const [tab, setTab] = useState('write')

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex gap-3 px-2.5 pt-1.5 border-b border-slate-100 bg-slate-50/50">
        {['write', 'preview'].map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`text-[11px] font-semibold pb-1.5 border-b-2 capitalize transition-colors ${
              tab === t ? 'text-slate-700' : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
            style={tab === t ? { borderColor: 'var(--brand)' } : undefined}
          >
            {t === 'write' ? 'Write' : 'Preview'}
          </button>
        ))}
      </div>
      {tab === 'write' ? (
        <textarea
          className="w-full text-sm resize-none px-3 py-2 outline-none"
          rows={4}
          placeholder="Deskripsi (opsional) — mendukung **bold**, _italic_, `code`, - [ ] checklist, [link](https://...)"
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
        />
      ) : (
        <div
          className="px-3 py-2 text-sm text-slate-600 min-h-[92px]"
          dangerouslySetInnerHTML={{ __html: value ? renderMarkdown(value) : '<span style="color:#94a3b8">Tidak ada deskripsi</span>' }}
        />
      )}
    </div>
  )
}
