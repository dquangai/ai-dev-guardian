import { useEffect, useRef, useState } from 'react'
import { Bell, Check } from 'lucide-react'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import type { PolicyNotification } from '../../lib/types'

const POLL_MS = 30_000

export function NotificationBell() {
  const { data, refetch } = useApi<PolicyNotification[]>('/notifications/policies')
  const [open, setOpen] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = setInterval(refetch, POLL_MS)
    return () => clearInterval(id)
  }, [refetch])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const unread = (data ?? []).filter((n) => n.unread)

  async function markAsRead(id: string) {
    setMarkingId(id)
    try {
      await api.post(`/notifications/policies/${id}/read`)
      refetch()
    } finally {
      setMarkingId(null)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-red-50 hover:text-[#9E0B10] hover:border-red-200"
        title="Policy notifications"
      >
        <Bell size={15} />
        {unread.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#9E0B10] px-1 text-[10px] font-bold text-white">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-bold text-slate-500">Policy Updates</p>
          {unread.length === 0 && <p className="px-2 py-4 text-center text-xs text-slate-400">No unread policy changes.</p>}
          <div className="max-h-80 overflow-y-auto">
            {unread.map((n) => (
              <div key={n.id} className="rounded-xl px-2 py-2 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{n.id}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      v{n.version}
                      {n.updatedBy ? ` · by ${n.updatedBy}` : ''}
                      {n.lastUpdated ? ` · ${new Date(n.lastUpdated).toLocaleString()}` : ''}
                    </p>
                    {n.changeSummary && <p className="mt-1 text-xs text-slate-600">{n.changeSummary}</p>}
                  </div>
                  <button
                    onClick={() => markAsRead(n.id)}
                    disabled={markingId === n.id}
                    title="Mark as read"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 disabled:opacity-50"
                  >
                    <Check size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
