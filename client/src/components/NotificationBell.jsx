import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { notificationsApi } from '../api'

export default function NotificationBell() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn:  () => notificationsApi.unreadCount(),
    refetchInterval: 30_000,
  })
  const count = unread?.count ?? 0

  const { data: list } = useQuery({
    enabled: open,
    queryKey: ['notifications', 'list'],
    queryFn:  () => notificationsApi.list({ limit: 10 }),
  })

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    qc.invalidateQueries({ queryKey: ['notifications', 'list'] })
  }

  const handleClick = async (n) => {
    if (!n.isRead) await notificationsApi.markRead(n.id)
    invalidate()
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead()
    invalidate()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <Bell size={15} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-[3px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-modal border border-slate-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-700">Notifikasi</span>
            {count > 0 && (
              <button onClick={handleMarkAllRead} className="text-[11px] text-slate-400 hover:text-slate-700 font-medium">
                Tandai semua dibaca
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {!list?.data?.length ? (
              <p className="text-sm text-slate-400 text-center py-8">Tidak ada notifikasi</p>
            ) : list.data.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors ${!n.isRead ? 'bg-blue-50/40' : ''}`}
              >
                <p className="text-xs font-semibold text-slate-700">{n.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                <p className="text-[10px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString('id-ID')}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
