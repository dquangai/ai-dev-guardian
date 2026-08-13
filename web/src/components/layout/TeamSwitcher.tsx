import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useApi } from '../../lib/useApi'
import { ApiError } from '../../lib/api'
import type { TeamsResponse } from '../../lib/types'

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
  const currentLabel = currentTeam ? currentTeam.name : 'Default Team'

  async function pick(teamId: string | undefined) {
    setSwitching(true)
    setError(null)
    try {
      await actAsTeam(teamId)
      setOpen(false)
      navigate(teamId ? '/' : '/teams', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Chuyển team thất bại.')
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        className="flex items-center gap-2 rounded-xl border border-[#D9D9D9] dark:border-[#27272A] bg-[#F0F4F9] dark:bg-[#18181B] hover:bg-[#E2E8F0] dark:hover:bg-[#27272A] px-3.5 py-1.5 text-xs text-[#475569] dark:text-[#94A3B8] disabled:opacity-60 cursor-pointer transition-colors shadow-2xs"
      >
        <span className="text-[#475569] dark:text-[#94A3B8] font-normal">Context:</span>
        <span className="font-bold text-[#111111] dark:text-[#F4F4F5]">{currentLabel}</span>
        <ChevronDown size={14} className="text-[#475569] dark:text-[#94A3B8] ml-0.5" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-[#D9D9D9] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-2.5 shadow-2xl text-xs space-y-1">
          <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#777777] dark:text-[#A1A1AA]">
            NGỮ CẢNH LÀM VIỆC
          </p>

          <button
            onClick={() => pick(undefined)}
            className={`flex w-full items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer border-0 ${
              !user.teamId ? 'bg-rose-50 dark:bg-rose-950/60 text-[#B40009]' : 'text-[#111111] dark:text-[#F4F4F5] hover:bg-[#F2F2F2] dark:hover:bg-[#27272A]'
            }`}
          >
            <span className="flex items-center gap-2.5">
              Toàn tổ chức (Default Team)
            </span>
          </button>

          <div className="border-t border-[#D9D9D9] dark:border-[#27272A] pt-1 space-y-0.5">
            {(data?.teams ?? []).map((team) => (
              <button
                key={team.id}
                onClick={() => pick(team.id)}
                className={`flex w-full items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer border-0 ${
                  user.teamId === team.id ? 'bg-rose-50 dark:bg-rose-950/60 text-[#B40009]' : 'text-[#111111] dark:text-[#F4F4F5] hover:bg-[#F2F2F2] dark:hover:bg-[#27272A]'
                }`}
              >
                <span>Nhóm: {team.name}</span>
              </button>
            ))}
          </div>

          {error && <p className="px-3 py-1 text-xs text-[#B40009] font-bold">{error}</p>}
        </div>
      )}
    </div>
  )
}
