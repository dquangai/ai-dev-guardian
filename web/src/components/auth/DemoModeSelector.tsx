import { useState } from 'react'
import { ArrowRight, Code, Crown, Network, Shield, UserCheck, X } from 'lucide-react'
import type { Role } from '../../lib/rbac'

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
  level1: DemoRoleNode
  level2: DemoRoleNode
  level3: DemoRoleNode[]
} = {
  level1: {
    role: 'admin',
    level: 'CẤP 1 — QUẢN TRỊ CAO CẤP',
    label: 'Administrator',
    titleVi: 'Quản trị viên Hệ thống',
    description: 'Toàn quyền cấu hình AI Engine (kể cả quản lý Cache), chỉnh sửa & phê duyệt Chính sách trực tiếp, phê duyệt Yêu cầu Bypass',
    badgeColor: 'bg-red-100 text-[#9E0B10] border-red-200',
    borderColor: 'border-[#9E0B10] hover:bg-red-50/50',
  },
  level2: {
    role: 'senior-dev',
    level: 'CẤP 2 — QUẢN LÝ PHÊ DUYỆT',
    label: 'Senior Dev Lead',
    titleVi: 'Trưởng nhóm Phát triển',
    description: 'Đề xuất & phê duyệt Chính sách mới, phê duyệt Yêu cầu Bypass mã nguồn',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-200',
    borderColor: 'border-amber-500 hover:bg-amber-50/50',
  },
  level3: [
    {
      role: 'developer',
      level: 'CẤP 3 — THỰC THI CODE',
      label: 'Developer',
      titleVi: 'Lập trình viên',
      description: 'Chạy kiểm định Pre-Push AI Guard, gửi Yêu cầu Bypass khi cần thiết',
      badgeColor: 'bg-blue-100 text-blue-900 border-blue-200',
      borderColor: 'border-blue-400 hover:bg-blue-50/50',
    },
    {
      role: 'auditor',
      level: 'CẤP 3 — KIỂM TOÁN AN NINH',
      label: 'Auditor',
      titleVi: 'Chuyên viên Kiểm toán',
      description: 'Chế độ Chỉ đọc: Giám sát Chính sách, Nhật ký kiểm định & cấu hình AI Engine',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-200',
      borderColor: 'border-emerald-400 hover:bg-emerald-50/50',
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
        className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50/60 to-red-50/40 p-4 shadow-sm hover:border-[#9E0B10]/50 hover:shadow-md transition-all duration-200 cursor-pointer text-left disabled:opacity-60"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#9E0B10] group-hover:bg-[#9E0B10] group-hover:text-white transition-colors shadow-xs">
            <Network size={20} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-900 group-hover:text-[#9E0B10] transition-colors">
              Explore Demo Mode
            </p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Sơ đồ phân cấp vai trò từ cao đến thấp</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl bg-[#9E0B10] px-3.5 py-2 text-xs font-bold text-white shadow-sm group-hover:bg-[#80070B] transition-colors">
          <span>Xem sơ đồ</span>
          <ArrowRight size={14} />
        </div>
      </button>

      {/* Org Hierarchy Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#9E0B10]">
                  <Network size={22} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Sơ Đồ Phân Cấp Vai Trò (Role Hierarchy)</h3>
                  <p className="text-xs text-slate-500">Bấm vào bất kỳ chức vụ nào để đăng nhập tức thì vào giao diện tương ứng</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Hierarchy Tree Container */}
            <div className="mt-6 flex flex-col items-center gap-4">
              {/* Level 1: Admin */}
              <div className="w-full max-w-md">
                <button
                  type="button"
                  onClick={() => handleSelect(ORG_HIERARCHY.level1.role)}
                  className={`group relative flex w-full flex-col gap-2 rounded-2xl border-2 ${ORG_HIERARCHY.level1.borderColor} bg-white p-4 text-left shadow-xs transition-colors duration-150 hover:shadow-md cursor-pointer`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${ORG_HIERARCHY.level1.badgeColor}`}>
                      {ORG_HIERARCHY.level1.level}
                    </span>
                    <Crown size={18} className="text-[#9E0B10]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-[#9E0B10] transition-colors">
                      {ORG_HIERARCHY.level1.label} <span className="text-xs font-semibold text-slate-500">({ORG_HIERARCHY.level1.titleVi})</span>
                    </h4>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">{ORG_HIERARCHY.level1.description}</p>
                  </div>
                </button>
              </div>

              {/* Connecting Line 1 */}
              <div className="h-6 w-0.5 bg-slate-300" />

              {/* Level 2: Senior Dev Lead */}
              <div className="w-full max-w-md">
                <button
                  type="button"
                  onClick={() => handleSelect(ORG_HIERARCHY.level2.role)}
                  className={`group relative flex w-full flex-col gap-2 rounded-2xl border-2 ${ORG_HIERARCHY.level2.borderColor} bg-white p-4 text-left shadow-xs transition-colors duration-150 hover:shadow-md cursor-pointer`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${ORG_HIERARCHY.level2.badgeColor}`}>
                      {ORG_HIERARCHY.level2.level}
                    </span>
                    <UserCheck size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-amber-800 transition-colors">
                      {ORG_HIERARCHY.level2.label} <span className="text-xs font-semibold text-slate-500">({ORG_HIERARCHY.level2.titleVi})</span>
                    </h4>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">{ORG_HIERARCHY.level2.description}</p>
                  </div>
                </button>
              </div>

              {/* Connecting Line 2 Split */}
              <div className="relative flex w-full max-w-lg justify-center">
                <div className="h-5 w-0.5 bg-slate-300" />
                <div className="absolute top-5 h-0.5 w-3/4 bg-slate-300" />
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
                      className={`group relative flex flex-col gap-2 rounded-2xl border-2 ${node.borderColor} bg-white p-4 text-left shadow-xs transition-colors duration-150 hover:shadow-md cursor-pointer`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${node.badgeColor}`}>
                          {node.level}
                        </span>
                        <Icon size={18} className={node.role === 'developer' ? 'text-blue-600' : 'text-emerald-600'} />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-[#9E0B10] transition-colors">
                          {node.label} <span className="text-xs font-semibold text-slate-500">({node.titleVi})</span>
                        </h4>
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed">{node.description}</p>
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
