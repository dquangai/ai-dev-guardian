import { useState } from 'react'
import { Plus, Trash2, Users } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { api, ApiError } from '../lib/api'
import type { TeamsResponse } from '../lib/types'
import { ROLE_LABELS } from '../lib/rbac'
import { Panel } from '../components/ui/Panel'

export function TeamManagement() {
  const { data, loading, error, refetch } = useApi<TeamsResponse>('/teams')
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [pickerByTeam, setPickerByTeam] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function createTeam() {
    if (!newId.trim() || !newName.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      await api.post('/teams', { id: newId.trim(), name: newName.trim() })
      setNewId('')
      setNewName('')
      refetch()
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Failed to create team.')
    } finally {
      setCreating(false)
    }
  }

  async function addMember(teamId: string) {
    const userId = pickerByTeam[teamId]
    if (!userId) return
    setBusy(`add:${teamId}:${userId}`)
    setActionError(null)
    try {
      await api.post(`/teams/${teamId}/members`, { userId })
      setPickerByTeam((p) => ({ ...p, [teamId]: '' }))
      refetch()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to add member.')
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
      setActionError(err instanceof ApiError ? err.message : 'Failed to remove member.')
    } finally {
      setBusy(null)
    }
  }

  const unassignedOrOtherTeam = (teamId: string) =>
    (data?.users ?? []).filter((u) => u.teamId !== teamId)

  return (
    <div className="max-w-4xl space-y-6">
      <Panel title="Tạo Team mới" icon={<Plus size={16} className="text-gray-400" />}>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-semibold uppercase text-gray-400">Team ID</label>
            <input
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="team-eng"
              className="mt-1 w-48 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-gray-400">Tên hiển thị</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Engineering"
              className="mt-1 w-56 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>
          <button
            onClick={createTeam}
            disabled={creating || !newId.trim() || !newName.trim()}
            className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            {creating ? 'Đang tạo…' : 'Tạo Team'}
          </button>
        </div>
        {createError && <p className="mt-3 text-xs text-red-600">{createError}</p>}
      </Panel>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}
      {loading && !data && <p className="text-sm text-gray-400">Đang tải danh sách team…</p>}

      {data?.teams.map((team) => (
        <Panel key={team.id} title={`${team.name} (${team.id})`} icon={<Users size={16} className="text-gray-400" />}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
                <th className="pb-2">Tên</th>
                <th className="pb-2">Vai trò</th>
                <th className="pb-2">Email</th>
                <th className="pb-2 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {team.members.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-gray-400">
                    Chưa có thành viên.
                  </td>
                </tr>
              )}
              {team.members.map((m) => (
                <tr key={m.id} className="border-b border-gray-50">
                  <td className="py-2 font-medium text-gray-900">{m.name}</td>
                  <td className="py-2 text-gray-500">{ROLE_LABELS[m.role]}</td>
                  <td className="py-2 text-gray-500">{m.email}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => removeMember(team.id, m.id)}
                      disabled={busy === `remove:${team.id}:${m.id}`}
                      className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 size={12} /> Xoá
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex items-center gap-2">
            <select
              value={pickerByTeam[team.id] ?? ''}
              onChange={(e) => setPickerByTeam((p) => ({ ...p, [team.id]: e.target.value }))}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            >
              <option value="">Chọn user để thêm…</option>
              {unassignedOrOtherTeam(team.id).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({ROLE_LABELS[u.role]}){u.teamId ? ` — hiện ở ${u.teamId}` : ' — chưa có team'}
                </option>
              ))}
            </select>
            <button
              onClick={() => addMember(team.id)}
              disabled={!pickerByTeam[team.id] || busy?.startsWith(`add:${team.id}`)}
              className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:bg-gray-300"
            >
              Thêm vào team
            </button>
          </div>
        </Panel>
      ))}

      {data && data.teams.length === 0 && (
        <p className="text-sm text-gray-400">Chưa có team nào — tạo team đầu tiên ở trên.</p>
      )}
    </div>
  )
}
