import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Globe2, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useApi } from '../../lib/useApi'
import { ApiError } from '../../lib/api'
import type { TeamsResponse } from '../../lib/types'

/** T-24: Super Admin only — lets them "act as" a specific team (reissues their token with that
 * team's id, see AuthContext.actAsTeam) so the shared Overview/Findings/Policies pages behave
 * exactly as they would for that team's own admin, or clear back to org-wide. */
export function TeamSwitcher() {
  const { user, actAsTeam } = useAuth()
  const navigate = useNavigate()
  const { data } = useApi<TeamsResponse>('/teams', [], { enabled: user?.role === 'super-admin' })
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  if (!user || user.role !== 'super-admin') return null

  const currentTeam = data?.teams.find((t) => t.id === user.teamId)
  const currentLabel = currentTeam ? currentTeam.name : 'Toàn tổ chức'

  async function pick(teamId: string | undefined) {
    setSwitching(true)
    setError(null)
    try {
      await actAsTeam(teamId)
      setOpen(false)
      navigate(teamId ? '/' : '/teams', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to switch team.')
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-red-50 hover:text-[#9E0B10] hover:border-red-200 disabled:opacity-60"
        title="Team switcher"
      >
        {user.teamId ? <Users size={14} /> : <Globe2 size={14} />}
        <span className="hidden sm:inline">Đang xem: {currentLabel}</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-bold text-slate-500">Chuyển ngữ cảnh Team</p>
          <button
            onClick={() => pick(undefined)}
            className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs font-semibold hover:bg-slate-50 ${
              !user.teamId ? 'text-[#9E0B10]' : 'text-slate-700'
            }`}
          >
            <Globe2 size={14} /> Toàn tổ chức (org-wide)
          </button>
          <div className="max-h-64 overflow-y-auto">
            {(data?.teams ?? []).map((team) => (
              <button
                key={team.id}
                onClick={() => pick(team.id)}
                className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs font-semibold hover:bg-slate-50 ${
                  user.teamId === team.id ? 'text-[#9E0B10]' : 'text-slate-700'
                }`}
              >
                <Users size={14} /> {team.name}
              </button>
            ))}
          </div>
          {error && <p className="px-2 py-1 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
