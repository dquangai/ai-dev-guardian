import { useState, useRef, useEffect } from 'react'
import { useApi } from '../lib/useApi'
import { api, ApiError } from '../lib/api'
import type { TeamsResponse, SystemDiagnostics } from '../lib/types'
import { ROLE_LABELS, type Role } from '../lib/rbac'
import { engineLabel } from '../lib/engineLabel'

type PickerUser = TeamsResponse['users'][number]

const ROLE_TUPLE_RELATION: Record<Role, string> = {
  'super-admin': 'super_admin (org-wide)',
  admin: 'admin',
  'senior-dev': 'senior_dev',
  developer: 'member',
  auditor: 'auditor',
}

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Inline Search Multi-User Picker (Clean Non-Clipped Dropdown Controls)
function SimpleUserSearchPicker({
  availableUsers,
  selectedUserIds,
  onChange,
  disabled,
}: {
  availableUsers: PickerUser[]
  selectedUserIds: string[]
  onChange: (ids: string[]) => void
  disabled: boolean
}) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unselectedUsers = availableUsers.filter((u) => !selectedUserIds.includes(u.id))
  const filtered = unselectedUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase()) ||
      u.id.toLowerCase().includes(query.toLowerCase())
  )

  const selectedUsers = availableUsers.filter((u) => selectedUserIds.includes(u.id))

  function pickUser(u: PickerUser) {
    onChange([...selectedUserIds, u.id])
    setQuery('')
    setIsOpen(false)
  }

  function removeUser(id: string) {
    onChange(selectedUserIds.filter((i) => i !== id))
  }

  return (
    <div ref={containerRef} className="relative w-full sm:w-[380px]">
      {/* Search Input Box */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white focus-within:border-[#9E0B10] focus-within:ring-2 focus-within:ring-red-100 px-3.5 py-2 text-sm text-slate-900 shadow-xs">
        {selectedUsers.map((u) => (
          <span
            key={u.id}
            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-[#9E0B10] border border-red-100"
          >
            <span>{u.name}</span>
            <button
              type="button"
              onClick={() => removeUser(u.id)}
              className="text-[#9E0B10] hover:text-red-900 font-bold text-xs cursor-pointer ml-0.5 border-0"
            >
              ✕
            </button>
          </span>
        ))}

        <input
          type="text"
          value={query}
          disabled={disabled}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          placeholder={selectedUsers.length === 0 ? 'Tìm theo tên hoặc email để chọn...' : 'Gõ thêm...'}
          className="flex-1 min-w-[160px] bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none disabled:opacity-60"
        />
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-[100] w-full sm:w-[440px] max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15 text-xs space-y-0.5">
          <div className="flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
            <span>Kết quả tìm kiếm ({filtered.length})</span>
            <span className="text-[10px] text-slate-400 font-normal">Bấm để chọn</span>
          </div>

          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-slate-400 text-center font-medium">
              Không tìm thấy tài khoản phù hợp.
            </div>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => pickUser(u)}
                className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer border-0"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                    {userInitials(u.name)}
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm truncate">{u.name}</span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {ROLE_LABELS[u.role]}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-slate-400 truncate mt-0.5">{u.email}</p>
                  </div>
                </div>

                <span className="shrink-0 text-xs font-semibold text-[#9E0B10]">
                  + Chọn
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function TeamManagement() {
  const { data, loading, error, refetch } = useApi<TeamsResponse>('/teams')
  const { data: diagnostics } = useApi<SystemDiagnostics>('/system/diagnostics', [], { enabled: true })
  const { data: policies } = useApi<{ length: number }[]>('/policies', [], { enabled: true })
  const { data: history } = useApi<{ verdict: string }[]>('/audit/history', [], { enabled: true })

  const [activeTab, setActiveTab] = useState<'teams' | 'tuples' | 'diagnostics'>('teams')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  
  const [selectedUserIdsByTeam, setSelectedUserIdsByTeam] = useState<Record<string, string[]>>({})
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const totalTeams = data?.teams.length ?? 0
  const totalUsers = data?.users.length ?? 0
  const assignedUsersCount = data?.users.filter((u) => u.teamId).length ?? 0
  const totalPoliciesCount = policies?.length ?? 0
  const blockAuditCount = history?.filter((r) => r.verdict === 'BLOCK').length ?? 0

  async function createTeam() {
    if (!newId.trim() || !newName.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      await api.post('/teams', { id: newId.trim(), name: newName.trim() })
      setNewId('')
      setNewName('')
      setShowCreateModal(false)
      refetch()
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Tạo Team thất bại.')
    } finally {
      setCreating(false)
    }
  }

  async function addMembers(teamId: string) {
    const userIds = selectedUserIdsByTeam[teamId] || []
    if (userIds.length === 0) return
    setBusy(`add:${teamId}`)
    setActionError(null)
    try {
      for (const userId of userIds) {
        await api.post(`/teams/${teamId}/members`, { userId })
      }
      setSelectedUserIdsByTeam((p) => ({ ...p, [teamId]: [] }))
      refetch()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Thêm thành viên thất bại.')
    } finally {
      setBusy(null)
    }
  }

  async function removeMember(teamId: string, userId: string) {
    setBusy(`remove:${teamId}:${userId}`)
    setActionError(null)
    try {
      await api.delete(`/teams/${teamId}/members/${userId}`)
      refetch()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Gỡ thành viên thất bại.')
    } finally {
      setBusy(null)
    }
  }

  const unassignedOrOtherTeam = (teamId: string) =>
    (data?.users ?? []).filter((u) => u.teamId !== teamId)

  const filteredTeams = (data?.teams ?? []).filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.members.some(
        (m) =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
  )

  return (
    <div className="min-h-full -mx-8 -my-6 px-8 py-8 bg-white">
      <div className="mx-auto max-w-[1520px] space-y-6">

        {/* Pure White Header Banner */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-1">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Quản trị Tổ chức
            </h1>
            <p className="text-sm text-slate-500 font-normal mt-1">
              Quản lý phân bổ cấu trúc Team và mô hình phân quyền ReBAC toàn hệ thống.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-xl bg-[#9E0B10] hover:bg-[#80070B] px-5 py-2.5 text-sm font-semibold text-white cursor-pointer border-0 shadow-xs"
            >
              + Tạo Team Mới
            </button>
          </div>
        </div>

        {/* Enterprise System Overview Bar (Single Unified Control Strip) */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 gap-4 sm:gap-0">
            
            {/* Cell 1: Total Teams */}
            <div className="sm:px-5 py-1">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">TỔNG SỐ TEAM</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 tracking-tight">{totalTeams}</span>
                <span className="text-xs text-slate-500 font-medium">teams đang hoạt động</span>
              </div>
            </div>

            {/* Cell 2: System Accounts */}
            <div className="sm:px-5 py-1">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">THÀNH VIÊN HỆ THỐNG</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 tracking-tight">{totalUsers}</span>
                <span className="text-xs text-slate-500 font-medium">({assignedUsersCount}/{totalUsers} đã gán team)</span>
              </div>
            </div>

            {/* Cell 3: Authz Engine */}
            <div className="sm:px-5 py-1">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">MÔ HÌNH AUTHZ</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg font-bold text-slate-900 tracking-tight">OpenFGA ReBAC</span>
                <span className="text-xs font-semibold text-[#9E0B10]">(Org-wide)</span>
              </div>
            </div>

            {/* Cell 4: Security Rules */}
            <div className="sm:px-5 py-1">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">QUY TẮC BẢO VỆ</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 tracking-tight">{totalPoliciesCount}</span>
                <span className="text-xs font-medium text-slate-500">
                  {blockAuditCount === 0 ? '• 0 vi phạm' : `• ${blockAuditCount} bị chặn`}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Modern Navigation Tabs + Search Field */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 gap-3 pt-2">
          <div className="flex gap-8 text-sm">
            <button
              onClick={() => setActiveTab('teams')}
              className={`pb-3 font-bold cursor-pointer border-0 ${
                activeTab === 'teams'
                  ? 'border-b-2 border-[#9E0B10] text-[#9E0B10]'
                  : 'text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              Teams & Thành viên ({totalTeams})
            </button>
            <button
              onClick={() => setActiveTab('tuples')}
              className={`pb-3 font-bold cursor-pointer border-0 ${
                activeTab === 'tuples'
                  ? 'border-b-2 border-[#9E0B10] text-[#9E0B10]'
                  : 'text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              OpenFGA Tuples
            </button>
            <button
              onClick={() => setActiveTab('diagnostics')}
              className={`pb-3 font-bold cursor-pointer border-0 ${
                activeTab === 'diagnostics'
                  ? 'border-b-2 border-[#9E0B10] text-[#9E0B10]'
                  : 'text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              System Diagnostics
            </button>
          </div>

          {activeTab === 'teams' && (
            <div className="relative w-full sm:w-72 mb-1 sm:mb-0">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm team hoặc nhân sự..."
                className="w-full rounded-xl bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-[#9E0B10] focus:ring-2 focus:ring-red-100 pl-4 pr-10 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
              />
              <svg
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {(error || actionError) && (
          <div className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-[#9E0B10] flex justify-between items-center border border-red-100">
            <span>⚠️ {error || actionError}</span>
            <button onClick={() => setActionError(null)} className="text-[#9E0B10] font-bold cursor-pointer border-0">
              ✕
            </button>
          </div>
        )}

        {/* TAB 1: Teams & Members */}
        {activeTab === 'teams' && (
          <div className="space-y-6">
            {loading && !data && (
              <p className="text-sm font-medium text-slate-400 py-4">Đang tải thông tin team...</p>
            )}

            {filteredTeams.map((team) => {
              const currentSelectedIds = selectedUserIdsByTeam[team.id] || []
              return (
                <div key={team.id} className="relative rounded-2xl border border-slate-200 bg-white shadow-xs">
                  {/* Clean Container Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-4 bg-slate-50/60 border-b border-slate-200/80 rounded-t-2xl gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 leading-tight">{team.name}</h3>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">{team.id}</p>
                    </div>

                    {/* Top Add Member Action Bar */}
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-xl">
                        {team.members.length} thành viên
                      </span>
                      <SimpleUserSearchPicker
                        availableUsers={unassignedOrOtherTeam(team.id)}
                        selectedUserIds={currentSelectedIds}
                        onChange={(ids) => setSelectedUserIdsByTeam((p) => ({ ...p, [team.id]: ids }))}
                        disabled={!!busy?.startsWith(`add:${team.id}`)}
                      />
                      <button
                        onClick={() => addMembers(team.id)}
                        disabled={currentSelectedIds.length === 0 || busy?.startsWith(`add:${team.id}`)}
                        className="rounded-xl bg-[#9E0B10] text-white hover:bg-[#80070B] px-5 py-2 text-sm font-semibold border-0 disabled:opacity-40 cursor-pointer shadow-xs shrink-0"
                      >
                        + Thêm vào team
                      </button>
                    </div>
                  </div>

                  {/* Clean Enterprise Table */}
                  <div className="overflow-x-auto rounded-b-2xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200/80 bg-slate-50/80 text-left text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
                          <th className="py-3.5 px-6">TÊN</th>
                          <th className="py-3.5 px-6">VAI TRÒ</th>
                          <th className="py-3.5 px-6">EMAIL</th>
                          <th className="py-3.5 px-6">OPENFGA TUPLE</th>
                          <th className="py-3.5 px-6 text-right">THAO TÁC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {team.members.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-6 px-6 text-slate-500 font-medium">
                              Chưa có thành viên trong team này. Dùng thanh "+ Thêm vào team" ở trên để gán thành viên.
                            </td>
                          </tr>
                        )}
                        {team.members.map((m) => (
                          <tr key={m.id} className="h-14 hover:bg-slate-50/60">
                            <td className="py-3.5 px-6 font-bold text-slate-900">{m.name}</td>
                            <td className="py-3.5 px-6 font-medium text-slate-800">
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                                {ROLE_LABELS[m.role]}
                              </span>
                            </td>
                            <td className="py-3.5 px-6 font-mono text-slate-500">{m.email}</td>
                            <td className="py-3.5 px-6 font-mono text-slate-400 text-xs">
                              team:{team.id}#{ROLE_TUPLE_RELATION[m.role]}
                            </td>
                            <td className="py-3.5 px-6 text-right">
                              <button
                                onClick={() => removeMember(team.id, m.id)}
                                disabled={busy === `remove:${team.id}:${m.id}`}
                                className="rounded-lg text-[#9E0B10] hover:bg-red-50 px-3 py-1.5 text-xs font-semibold border-0 cursor-pointer disabled:opacity-50"
                              >
                                Xóa
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}

            {data && filteredTeams.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 text-sm font-medium">
                Không tìm thấy team phù hợp.
              </div>
            )}
          </div>
        )}

        {/* TAB 2: OpenFGA Tuples */}
        {activeTab === 'tuples' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-slate-900">Danh Sách OpenFGA Relationship Tuples</h3>
              <p className="text-xs text-slate-500 mt-1">
                Mô hình kế thừa phân quyền Fine-Grained Authorization từ tổ chức tới từng team.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead className="bg-slate-50 text-xs text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="p-3.5 text-left">USER</th>
                    <th className="p-3.5 text-left">RELATION</th>
                    <th className="p-3.5 text-left">OBJECT TARGET</th>
                    <th className="p-3.5 text-left">GHI CHÚ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-900">
                  <tr className="bg-red-50/40 font-semibold">
                    <td className="p-3.5 text-[#9E0B10]">user:super-admin-1</td>
                    <td className="p-3.5 text-[#9E0B10]">super_admin</td>
                    <td className="p-3.5">organization:vsf</td>
                    <td className="p-3.5 font-sans font-medium text-slate-700">Org-wide inherit</td>
                  </tr>
                  {(data?.teams ?? []).flatMap((t) =>
                    t.members.map((m) => (
                      <tr key={`${t.id}-${m.id}`} className="hover:bg-slate-50/60">
                        <td className="p-3.5 font-bold">user:{m.id}</td>
                        <td className="p-3.5 font-semibold text-[#9E0B10]">{ROLE_TUPLE_RELATION[m.role]}</td>
                        <td className="p-3.5">team:{t.id}</td>
                        <td className="p-3.5 font-sans text-slate-500">Thuộc {t.name}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Diagnostics */}
        {activeTab === 'diagnostics' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xs">
            <h3 className="text-base font-bold text-slate-900">Thông Số Hệ Thống</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
              <div className="border border-slate-200 p-5 rounded-xl space-y-3 bg-slate-50/30">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">AI Engine:</span>
                  <span className="font-bold text-slate-900">{engineLabel(diagnostics?.llm)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Git Branch:</span>
                  <span className="font-mono font-bold text-slate-900">{diagnostics?.gitBranch ?? 'master'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Git Pre-push Hook:</span>
                  <span className="font-bold text-[#9E0B10]">
                    {diagnostics?.gateGuardActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 p-5 rounded-xl space-y-3 bg-slate-50/30">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Số lượt Audit:</span>
                  <span className="font-bold text-slate-900">{history?.length ?? 0}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Lượt bị BLOCK:</span>
                  <span className="font-bold text-[#9E0B10]">{blockAuditCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Tỷ lệ PASS:</span>
                  <span className="font-bold text-emerald-700">
                    {history?.length ? Math.round(((history.length - blockAuditCount) / history.length) * 100) : 100}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CREATE TEAM MODAL */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-2xl shadow-slate-900/10">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Tạo Team Mới</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-base cursor-pointer border-0">
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Team ID</label>
                  <input
                    type="text"
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    placeholder="team-sec"
                    className="mt-1.5 w-full rounded-xl bg-slate-50/50 border border-slate-200 focus:border-[#9E0B10] focus:ring-2 focus:ring-red-100 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Tên Hiển Thị</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Security Operations"
                    className="mt-1.5 w-full rounded-xl bg-slate-50/50 border border-slate-200 focus:border-[#9E0B10] focus:ring-2 focus:ring-red-100 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none"
                  />
                </div>

                {createError && <p className="text-xs font-bold text-red-600">{createError}</p>}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer border-0"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={createTeam}
                  disabled={creating || !newId.trim() || !newName.trim()}
                  className="rounded-xl bg-[#9E0B10] hover:bg-[#80070B] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer border-0 shadow-xs"
                >
                  {creating ? 'Đang tạo...' : 'Tạo Team'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
