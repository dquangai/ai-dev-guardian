import { useEffect, useState } from 'react'
import { Code, Crown, Globe2, Network, Shield, UserCheck, X } from 'lucide-react'
import { api } from '../../lib/api'
import type { Role } from '../../lib/rbac'
import { TechButton } from '../ui/TechButton'

interface DirectoryMember {
  id: string
  name: string
  email: string
  role: Role
}

interface DirectoryTeam {
  id: string
  name: string
  members: DirectoryMember[]
}

interface DemoDirectory {
  superAdmin: { id: string; name: string; email: string } | null
  teams: DirectoryTeam[]
}

const ROLE_ORDER: Role[] = ['admin', 'senior-dev', 'developer', 'auditor']

const ROLE_META: Record<Role, { icon: typeof Code; level: string; titleVi: string; description: string }> = {
  'super-admin': {
    icon: Globe2,
    level: 'CẤP 0 — TOÀN QUYỀN TỔ CHỨC',
    titleVi: 'Quản trị viên Tổ chức',
    description: 'Quản lý toàn bộ Team trong tổ chức, chuyển đổi ngữ cảnh làm việc theo từng Team qua Team switcher',
  },
  admin: {
    icon: Crown,
    level: 'CẤP 1 — QUẢN TRỊ CAO CẤP',
    titleVi: 'Quản trị viên Hệ thống',
    description: 'Toàn quyền cấu hình AI Engine, chỉnh sửa & phê duyệt Chính sách trực tiếp của Team này',
  },
  'senior-dev': {
    icon: UserCheck,
    level: 'CẤP 2 — QUẢN LÝ PHÊ DUYỆT',
    titleVi: 'Trưởng nhóm Phát triển',
    description: 'Đề xuất & phê duyệt Chính sách mới, phê duyệt Yêu cầu Bypass mã nguồn của Team này',
  },
  developer: {
    icon: Code,
    level: 'CẤP 3 — THỰC THI CODE',
    titleVi: 'Lập trình viên',
    description: 'Chạy kiểm định Pre-Push AI Guard, gửi Yêu cầu Bypass khi cần thiết',
  },
  auditor: {
    icon: Shield,
    level: 'CẤP 3 — KIỂM TOÁN AN NINH',
    titleVi: 'Chuyên viên Kiểm toán',
    description: 'Chế độ Chỉ đọc: Giám sát Chính sách, Nhật ký kiểm định & cấu hình AI Engine',
  },
}

interface DemoModeSelectorProps {
  onSelectUser: (email: string) => void
  disabled?: boolean
}

export function DemoModeSelector({ onSelectUser, disabled }: DemoModeSelectorProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [directory, setDirectory] = useState<DemoDirectory | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null)

  useEffect(() => {
    if (!modalOpen || directory) return
    api
      .get<DemoDirectory>('/auth/demo-directory')
      .then((dir) => {
        setDirectory(dir)
        setActiveTeamId(dir.teams[0]?.id ?? null)
      })
      .catch(() => setLoadError('Không tải được danh sách tài khoản demo.'))
  }, [modalOpen, directory])

  function handleSelect(email: string) {
    if (disabled) return
    setModalOpen(false)
    onSelectUser(email)
  }

  const activeTeam = directory?.teams.find((t) => t.id === activeTeamId) ?? null
  const sortedMembers = activeTeam
    ? [...activeTeam.members].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
    : []

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setModalOpen(true)}
        className="group flex w-full items-center justify-between gap-3 rounded-[12px] border border-[#D6D6D6] bg-white p-4 shadow-xs hover:border-[#111111] hover:bg-[#F8F9FA] transition-all duration-200 cursor-pointer text-left disabled:opacity-60"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#F4F5F7] text-[#111111] border border-[#E5E7EB] group-hover:bg-[#111111] group-hover:text-white transition-colors shadow-xs">
            <Network size={18} />
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-[#111111] transition-colors">
              Explore Demo Mode
            </p>
            <p className="text-xs text-[#666666] font-medium mt-0.5">Chọn tài khoản demo theo Team & Vai trò</p>
          </div>
        </div>
        <TechButton size="sm">
          Xem danh sách
        </TechButton>
      </button>

      {/* Team/Role Picker Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-[20px] border border-[#D6D6D6] bg-white p-6 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#E5E7EB] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#F4F5F7] text-[#111111] border border-[#E5E7EB]">
                  <Network size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#111111] tracking-tight">Danh Sách Tài Khoản Demo</h3>
                  <p className="text-xs text-[#666666]">Chọn Team rồi bấm vào 1 người để tự động điền Email & Mật khẩu</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-[#777777] hover:bg-[#F4F5F7] hover:text-[#111111] transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {loadError && <p className="mt-4 text-xs font-semibold text-red-600">{loadError}</p>}
            {!directory && !loadError && <p className="mt-4 text-xs text-[#666666]">Đang tải...</p>}

            {directory && (
              <div className="mt-5 space-y-5">
                {/* Super Admin — org-wide, no team */}
                {directory.superAdmin && (
                  <button
                    type="button"
                    onClick={() => handleSelect(directory.superAdmin!.email)}
                    className="tech-hover-card group relative flex w-full flex-col gap-2 rounded-[14px] border border-[#D6D6D6] hover:border-[#111111] hover:bg-[#F8F9FA] bg-white p-4 text-left shadow-xs transition-all duration-150 hover:shadow-md cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-bold bg-[#111111] text-white border-[#111111]">
                        {ROLE_META['super-admin'].level}
                      </span>
                      <Globe2 size={18} className="text-[#111111]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-[#111111]">
                        {directory.superAdmin.name} <span className="text-xs font-semibold text-[#666666]">({ROLE_META['super-admin'].titleVi})</span>
                      </h4>
                      <p className="mt-1 text-xs text-[#555555] leading-relaxed">{ROLE_META['super-admin'].description}</p>
                    </div>
                  </button>
                )}

                {/* Team tabs */}
                <div className="flex flex-wrap gap-2 border-t border-[#E5E7EB] pt-4">
                  {directory.teams.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => setActiveTeamId(team.id)}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-bold cursor-pointer transition-colors ${
                        team.id === activeTeamId
                          ? 'border-[#111111] bg-[#111111] text-white'
                          : 'border-[#D6D6D6] bg-white text-[#555555] hover:border-[#111111]'
                      }`}
                    >
                      {team.name}
                    </button>
                  ))}
                </div>

                {/* Role cards for the selected team */}
                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                  {sortedMembers.length === 0 && (
                    <p className="col-span-2 text-xs text-[#666666]">Team này chưa có thành viên nào.</p>
                  )}
                  {sortedMembers.map((member) => {
                    const meta = ROLE_META[member.role]
                    const Icon = meta.icon
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleSelect(member.email)}
                        className="tech-hover-card group relative flex flex-col gap-2 rounded-[14px] border border-[#D6D6D6] hover:border-[#111111] hover:bg-[#F8F9FA] bg-white p-4 text-left shadow-xs transition-all duration-150 hover:shadow-md cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <span className="rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-bold bg-white text-[#111111] border-[#D6D6D6]">
                            {meta.level}
                          </span>
                          <Icon size={18} className="text-[#111111]" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-[#111111]">
                            {member.name} <span className="text-xs font-semibold text-[#666666]">({meta.titleVi})</span>
                          </h4>
                          <p className="mt-1 text-xs font-mono text-[#777777]">{member.email}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
