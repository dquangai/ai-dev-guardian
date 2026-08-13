import { useState } from 'react'
import { Code, Crown, Globe2, Network, Shield, UserCheck, X } from 'lucide-react'
import type { Role } from '../../lib/rbac'

import { TechButton } from '../ui/TechButton'

interface DemoRoleNode {
  role: Role
  level: string
  label: string
  titleVi: string
  description: string
  badgeColor: string
  borderColor: string
}

const ORG_HIERARCHY: {
  level0: DemoRoleNode
  level1: DemoRoleNode
  level2: DemoRoleNode
  level3: DemoRoleNode[]
} = {
  // T-24: org-wide, sits above the single-org chart entirely — no team of its own until it picks
  // one via the Team switcher in the Header (see TeamManagement.tsx / AuthContext.actAsTeam).
  level0: {
    role: 'super-admin',
    level: 'CẤP 0 — TOÀN QUYỀN TỔ CHỨC',
    label: 'Super Admin',
    titleVi: 'Quản trị viên Tổ chức',
    description: 'Quản lý toàn bộ Team trong tổ chức, chuyển đổi ngữ cảnh làm việc theo từng Team qua Team switcher',
    badgeColor: 'bg-[#111111] text-white border-[#111111]',
    borderColor: 'border-[#D6D6D6] hover:border-[#111111] hover:bg-[#F8F9FA]',
  },
  level1: {
    role: 'admin',
    level: 'CẤP 1 — QUẢN TRỊ CAO CẤP',
    label: 'Administrator',
    titleVi: 'Quản trị viên Hệ thống',
    description: 'Toàn quyền cấu hình AI Engine (kể cả quản lý Cache), chỉnh sửa & phê duyệt Chính sách trực tiếp, phê duyệt Yêu cầu Bypass',
    badgeColor: 'bg-[#111111] text-white border-[#111111]',
    borderColor: 'border-[#D6D6D6] hover:border-[#111111] hover:bg-[#F8F9FA]',
  },
  level2: {
    role: 'senior-dev',
    level: 'CẤP 2 — QUẢN LÝ PHÊ DUYỆT',
    label: 'Senior Dev Lead',
    titleVi: 'Trưởng nhóm Phát triển',
    description: 'Đề xuất & phê duyệt Chính sách mới, phê duyệt Yêu cầu Bypass mã nguồn',
    badgeColor: 'bg-white text-[#111111] border-[#D6D6D6]',
    borderColor: 'border-[#D6D6D6] hover:border-[#111111] hover:bg-[#F8F9FA]',
  },
  level3: [
    {
      role: 'developer',
      level: 'CẤP 3 — THỰC THI CODE',
      label: 'Developer',
      titleVi: 'Lập trình viên',
      description: 'Chạy kiểm định Pre-Push AI Guard, gửi Yêu cầu Bypass khi cần thiết',
      badgeColor: 'bg-white text-[#111111] border-[#D6D6D6]',
      borderColor: 'border-[#D6D6D6] hover:border-[#111111] hover:bg-[#F8F9FA]',
    },
    {
      role: 'auditor',
      level: 'CẤP 3 — KIỂM TOÁN AN NINH',
      label: 'Auditor',
      titleVi: 'Chuyên viên Kiểm toán',
      description: 'Chế độ Chỉ đọc: Giám sát Chính sách, Nhật ký kiểm định & cấu hình AI Engine',
      badgeColor: 'bg-white text-[#111111] border-[#D6D6D6]',
      borderColor: 'border-[#D6D6D6] hover:border-[#111111] hover:bg-[#F8F9FA]',
    },
  ],
}

interface DemoModeSelectorProps {
  onSelectRole: (role: Role) => void
  disabled?: boolean
}

export function DemoModeSelector({ onSelectRole, disabled }: DemoModeSelectorProps) {
  const [modalOpen, setModalOpen] = useState(false)

  function handleSelect(role: Role) {
    if (disabled) return
    setModalOpen(false)
    onSelectRole(role)
  }

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
            <p className="text-xs text-[#666666] font-medium mt-0.5">Sơ đồ phân cấp vai trò từ cao đến thấp</p>
          </div>
        </div>
        <TechButton size="sm">
          Xem sơ đồ
        </TechButton>
      </button>

      {/* Org Hierarchy Modal */}
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
                  <h3 className="text-base font-extrabold text-[#111111] tracking-tight">Sơ Đồ Phân Cấp Vai Trò (Role Hierarchy)</h3>
                  <p className="text-xs text-[#666666]">Bấm vào bất kỳ chức vụ nào để tự động điền Email công việc và Mật khẩu tương ứng</p>
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

            {/* Hierarchy Tree Container */}
            <div className="mt-6 flex flex-col items-center gap-4">
              {/* Level 0: Super Admin */}
              <div className="w-full max-w-md">
                <button
                  type="button"
                  onClick={() => handleSelect(ORG_HIERARCHY.level0.role)}
                  className={`tech-hover-card group relative flex w-full flex-col gap-2 rounded-[14px] border ${ORG_HIERARCHY.level0.borderColor} bg-white p-4 text-left shadow-xs transition-all duration-150 hover:shadow-md cursor-pointer`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-bold ${ORG_HIERARCHY.level0.badgeColor}`}>
                      {ORG_HIERARCHY.level0.level}
                    </span>
                    <Globe2 size={18} className="text-[#111111]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-[#111111] transition-colors">
                      {ORG_HIERARCHY.level0.label} <span className="text-xs font-semibold text-[#666666]">({ORG_HIERARCHY.level0.titleVi})</span>
                    </h4>
                    <p className="mt-1 text-xs text-[#555555] leading-relaxed">{ORG_HIERARCHY.level0.description}</p>
                  </div>
                </button>
              </div>

              {/* Animated Laser Flow Line 1 */}
              <div className="h-6 w-0.5 tech-laser-line-v rounded-full" />

              {/* Level 1: Admin */}
              <div className="w-full max-w-md">
                <button
                  type="button"
                  onClick={() => handleSelect(ORG_HIERARCHY.level1.role)}
                  className={`tech-hover-card group relative flex w-full flex-col gap-2 rounded-[14px] border ${ORG_HIERARCHY.level1.borderColor} bg-white p-4 text-left shadow-xs transition-all duration-150 hover:shadow-md cursor-pointer`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-bold ${ORG_HIERARCHY.level1.badgeColor}`}>
                      {ORG_HIERARCHY.level1.level}
                    </span>
                    <Crown size={18} className="text-[#111111]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-[#111111] transition-colors">
                      {ORG_HIERARCHY.level1.label} <span className="text-xs font-semibold text-[#666666]">({ORG_HIERARCHY.level1.titleVi})</span>
                    </h4>
                    <p className="mt-1 text-xs text-[#555555] leading-relaxed">{ORG_HIERARCHY.level1.description}</p>
                  </div>
                </button>
              </div>

              {/* Animated Laser Flow Line 2 */}
              <div className="h-6 w-0.5 tech-laser-line-v rounded-full" />

              {/* Level 2: Senior Dev Lead */}
              <div className="w-full max-w-md">
                <button
                  type="button"
                  onClick={() => handleSelect(ORG_HIERARCHY.level2.role)}
                  className={`tech-hover-card group relative flex w-full flex-col gap-2 rounded-[14px] border ${ORG_HIERARCHY.level2.borderColor} bg-white p-4 text-left shadow-xs transition-all duration-150 hover:shadow-md cursor-pointer`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-bold ${ORG_HIERARCHY.level2.badgeColor}`}>
                      {ORG_HIERARCHY.level2.level}
                    </span>
                    <UserCheck size={18} className="text-[#111111]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-[#111111] transition-colors">
                      {ORG_HIERARCHY.level2.label} <span className="text-xs font-semibold text-[#666666]">({ORG_HIERARCHY.level2.titleVi})</span>
                    </h4>
                    <p className="mt-1 text-xs text-[#555555] leading-relaxed">{ORG_HIERARCHY.level2.description}</p>
                  </div>
                </button>
              </div>

              {/* Animated Laser Flow Line 3 Split */}
              <div className="relative flex w-full max-w-lg justify-center">
                <div className="h-5 w-0.5 tech-laser-line-v rounded-full" />
                <div className="absolute top-5 h-0.5 w-3/4 tech-laser-line-h rounded-full" />
              </div>

              {/* Level 3: Developer & Auditor */}
              <div className="mt-2 grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
                {ORG_HIERARCHY.level3.map((node) => {
                  const Icon = node.role === 'developer' ? Code : Shield
                  return (
                    <button
                      key={node.role}
                      type="button"
                      onClick={() => handleSelect(node.role)}
                      className={`tech-hover-card group relative flex flex-col gap-2 rounded-[14px] border ${node.borderColor} bg-white p-4 text-left shadow-xs transition-all duration-150 hover:shadow-md cursor-pointer`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-bold ${node.badgeColor}`}>
                          {node.level}
                        </span>
                        <Icon size={18} className="text-[#111111]" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-[#111111] transition-colors">
                          {node.label} <span className="text-xs font-semibold text-[#666666]">({node.titleVi})</span>
                        </h4>
                        <p className="mt-1 text-xs text-[#555555] leading-relaxed">{node.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
