import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { posApi } from '../api'
import PageHeader from '../components/PageHeader'
import OrdersPanel from '../components/pos/OrdersPanel'

// Riwayat semua transaksi kasir (semua laptop) — untuk staff/supervisor, bukan kasir.
export default function PosHistory() {
  const [params, setParams] = useSearchParams()
  const { data: events = [] } = useQuery({ queryKey: ['pos-events'], queryFn: posApi.events })
  const eventId = params.get('event') || events.find(e => e.status === 'OPEN')?.id || events[0]?.id || ''
  const event = events.find(e => String(e.id) === String(eventId))

  return (
    <div className="px-6 py-6 space-y-5">
      <PageHeader title="Riwayat Transaksi" subtitle="Semua transaksi kasir di event ini, dari semua laptop"
        action={events.length > 1 && (
          <select className="input" value={eventId} onChange={e => setParams({ event: e.target.value })}>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
        )} />
      <OrdersPanel key={eventId} eventId={eventId} event={event} />
    </div>
  )
}
