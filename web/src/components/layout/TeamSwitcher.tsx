import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const currentLabel = currentTeam ? currentTeam.name : 'Toàn tổ chức'

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
        className="flex items-center gap-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2 text-xs text-slate-700 disabled:opacity-60 cursor-pointer border-0"
      >
        <span className="text-slate-400 font-medium">Context:</span>
        <span className="font-bold text-slate-900">{currentLabel}</span>
        <svg className="w-4 h-4 text-slate-400 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-2xl shadow-slate-900/10 text-xs space-y-1">
          <p className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            NGỮ CẢNH LÀM VIỆC
          </p>

          <button
            onClick={() => pick(undefined)}
            className={`flex w-full items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold cursor-pointer border-0 ${
              !user.teamId ? 'bg-red-50 text-[#9E0B10]' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-[#9E0B10]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Toàn tổ chức (org-wide)
            </span>
            {!user.teamId && (
              <svg className="w-4 h-4 text-[#9E0B10]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          <div className="border-t border-slate-100 pt-1 space-y-0.5">
            {(data?.teams ?? []).map((team) => (
              <button
                key={team.id}
                onClick={() => pick(team.id)}
                className={`flex w-full items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer border-0 ${
                  user.teamId === team.id ? 'bg-red-50 text-[#9E0B10]' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Nhóm: {team.name}
                </span>
                {user.teamId === team.id && (
                  <svg className="w-4 h-4 text-[#9E0B10]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-1 space-y-0.5">
            <button
              onClick={() => {
                setOpen(false)
                navigate('/teams')
              }}
              className="flex w-full items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-[#9E0B10] hover:bg-red-50 cursor-pointer border-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Tạo Team mới
            </button>
            <button
              onClick={() => {
                setOpen(false)
                navigate('/teams')
              }}
              className="flex w-full items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer border-0"
            >
              <span className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Quản lý tất cả Team
              </span>
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>

          {error && <p className="px-3 py-1 text-xs text-red-600 font-bold">{error}</p>}
        </div>
      )}
    </div>
  )
}
