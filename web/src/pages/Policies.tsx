import { useState, useMemo } from 'react'
import {
  Plus,
  Search,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Edit3,
  Move,
  Trash2,
  RefreshCw,
  X,
  CheckCircle2,
  Copy,
  Download,
} from 'lucide-react'
import { useApi } from '../lib/useApi'
import type { Policy } from '../lib/types'
import { PolicyEditor } from '../components/policies/PolicyEditor'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { TechButton } from '../components/ui/TechButton'

function copyPathToClipboard(path: string) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(path)
    alert(`Đã sao chép đường dẫn: ${path}`)
  }
}

function downloadPolicyFile(filename: string, content: string) {
  const element = document.createElement('a')
  const file = new Blob([content], { type: 'text/plain;charset=utf-8' })
  element.href = URL.createObjectURL(file)
  element.download = filename
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}

interface RepositoryFile {
  id: string
  name: string
  path: string
  category: string
  size: string
  updated: string
  severity: string
  tags?: string[]
  raw?: string
}

interface RepositoryFolder {
  id: string
  name: string
  path: string
  count: number
  subfolders?: RepositoryFolder[]
  files: RepositoryFile[]
}

const DEFAULT_POLICY_CONTENT: Record<string, string> = {
  'disabled-security-control.policy.md': `---
category: Security Policy
severity: critical
tags: ["security", "authentication", "authorization"]
scope: ["**/*.ts", "**/*.tsx", "**/*.js"]
---

# Policy: Ban Disabled Security Controls

## 1. Objective
Ensure that security controls, authentication checks, and authorization middleware are not disabled, bypassed, or commented out in production source code.

## 2. Rule Definition
\`\`\`ts
// Forbidden code pattern:
export function adminOnly(req: Request, res: Response, next: NextFunction) {
  // if (req.user?.role !== 'admin') return res.status(403).send('Forbidden');
  next();
}
\`\`\`

## 3. Approved Exceptions & Carve-outs
- KHÔNG áp dụng cho code vốn đi không cần xác thực (CLI tool chạy local, không expose network service).
- Comment CẢNH BÁO/HƯỚNG DẪN dev tránh làm điều gì đó không tính là vi phạm.
- Comment-out code KHÔNG liên quan xác thực/phân quyền không thuộc phạm vi policy này.

## 4. Automated Enforcement
- **LLM Policy Check** (\`checkPoliciesWithLLM\`) - \`allowCommentEvidence: true\` cho phép \`evidenceSnippet\` là chính dòng comment chứa cơ chế đã bị tắt.
- Severity: **CRITICAL**. Violations block deployment automatically.`,

  'architecture.policy.md': `---
category: Architecture
severity: low
tags: ["architecture", "clean-code", "layering"]
scope: ["**/*.ts", "**/*.tsx"]
---

# Policy: Hexagonal Architecture & Layering

## 1. Objective
Maintain strict separation between business logic domain models, API controllers, and database access adapters.

## 2. Rules
- Domain entities must not import database drivers or web server frameworks directly.
- Use explicit interfaces and dependency injection wrappers.`,

  'rbac.policy.md': `---
category: Authorization
severity: high
tags: ["rbac", "authorization", "permissions"]
scope: ["web/src/**/*.tsx", "src/api/**/*.ts"]
---

# Policy: Fine-grained Role-Based Access Control (RBAC)

## 1. Objective
Enforce RBAC authorization on all admin endpoints and protected routes using permission matrices.

## 2. Requirements
- Call \`can(permission)\` before performing sensitive operations or rendering protected UI components.`,

  'security.policy.md': `---
category: Security Policy
severity: medium
tags: ["security", "sanitization", "secrets"]
scope: ["**/*.ts", "**/*.js"]
---

# Policy: General Security Principles & Secret Leak Prevention

## 1. Objective
Prevent hardcoded API keys, tokens, or un-sanitized inputs from reaching repository source code.`,

  'api-security.policy.md': `---
category: API Security
severity: high
tags: ["api", "jwt", "rate-limiting"]
scope: ["src/api/**/*.ts"]
---

# Policy: REST API Authentication & Rate Limiting

## 1. Objective
All external HTTP REST endpoints must validate OAuth2 JWT signatures and enforce sliding window rate limits.`,

  'data-protection.policy.md': `---
category: Compliance
severity: medium
tags: ["data-protection", "privacy", "gdpr"]
scope: ["src/db/**/*.ts", "src/models/**/*.ts"]
---

# Policy: Data Encryption & PII Anonymization

## 1. Objective
Ensure Personally Identifiable Information (PII) is encrypted at rest using AES-256-GCM.`,

  'input-validation.policy.md': `---
category: Validation
severity: medium
tags: ["validation", "frontend", "xss"]
scope: ["web/src/**/*.tsx"]
---

# Policy: Strict Input Validation & XSS Prevention

## 1. Objective
Validate all form inputs using schema validators prior to submitting payloads to backend services.`,

  'mfa.policy.md': `---
category: Authentication
severity: low
tags: ["authentication", "mfa", "totp"]
scope: ["src/auth/**/*.ts"]
---

# Policy: Multi-Factor Authentication Standard

## 1. Objective
Require TOTP or WebAuthn validation for high-privilege administrative actions.`,

  'password.policy.md': `---
category: Authentication
severity: low
tags: ["authentication", "passwords", "argon2"]
scope: ["src/auth/**/*.ts"]
---

# Policy: Password Hashing Standard

## 1. Objective
Passwords must be hashed using Argon2id with a minimum memory cost of 64MB and 3 iterations.`,

  'rbac-custom.policy.md': `---
category: Authorization
severity: low
tags: ["authorization", "custom-rules"]
scope: ["src/custom/**/*.ts"]
---

# Policy: Custom Team Authorization Rules

## 1. Objective
Enforce custom department-level authorization constraints for internal tools.`,

  'abac.policy.md': `---
category: Authorization
severity: medium
tags: ["abac", "attributes", "context"]
scope: ["src/auth/abac/**/*.ts"]
---

# Policy: Attribute-Based Access Control Evaluation

## 1. Objective
Evaluate user environmental attributes (ip_address, geo_location, time_window) during policy checks.`
}

export function Policies() {
  const { can } = useAuth()
  const { data: policies, refetch: refetchPolicies, loading } = useApi<Policy[]>('/policies')

  // Navigation & selection states
  const [selectedFileId, setSelectedFileId] = useState<string>('disabled-security-control.policy.md')
  const [activeFolderPath, setActiveFolderPath] = useState<string>('.guardian/policies/global')

  // UI state
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'preview' | 'raw' | 'revision'>('preview')
  const [isEditing, setIsEditing] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [moveDestinationPath, setMoveDestinationPath] = useState<string>('.guardian/policies/teams/backend')
  const [newPolicyName, setNewPolicyName] = useState('new-security-rule.policy.md')
  const [newPolicyFolderPath, setNewPolicyFolderPath] = useState('.guardian/policies/global')

  // Expanded folders state (default expanded for root paths)
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({
    '.guardian': true,
    '.guardian/policies': true,
    '.guardian/policies/global': true,
    '.guardian/policies/teams': true,
    '.guardian/policies/teams/backend': true,
    '.guardian/policies/teams/frontend': true,
    '.guardian/policies/custom': true,
    '.guardian/policies/custom/authentication': true,
    '.guardian/policies/custom/authorization': true,
  })

  // Full Repository Folder Tree Data
  const repositoryTree: RepositoryFolder = useMemo(() => {
    // Map backend policies into structured virtual repository tree
    const defaultGlobalFiles: RepositoryFile[] = [
      { id: 'architecture.policy.md', name: 'architecture.policy.md', path: '.guardian/policies/global/architecture.policy.md', category: 'Architecture', size: '2.1 KB', updated: '12/05/2026 14:30', severity: 'low' },
      { id: 'disabled-security-control.policy.md', name: 'disabled-security-control.policy.md', path: '.guardian/policies/global/disabled-security-control.policy.md', category: 'Security Policy', size: '1.8 KB', updated: '12/05/2026 11:20', severity: 'critical' },
      { id: 'rbac.policy.md', name: 'rbac.policy.md', path: '.guardian/policies/global/rbac.policy.md', category: 'Authorization', size: '2.7 KB', updated: '11/05/2026 09:15', severity: 'high' },
      { id: 'security.policy.md', name: 'security.policy.md', path: '.guardian/policies/global/security.policy.md', category: 'Security Policy', size: '2.3 KB', updated: '10/05/2026 16:45', severity: 'medium' },
    ]

    const defaultTeamBackendFiles: RepositoryFile[] = [
      { id: 'api-security.policy.md', name: 'api-security.policy.md', path: '.guardian/policies/teams/backend/api-security.policy.md', category: 'API Security', size: '3.4 KB', updated: '09/05/2026 08:20', severity: 'high' },
      { id: 'data-protection.policy.md', name: 'data-protection.policy.md', path: '.guardian/policies/teams/backend/data-protection.policy.md', category: 'Compliance', size: '2.9 KB', updated: '08/05/2026 10:15', severity: 'medium' },
    ]

    const defaultTeamFrontendFiles: RepositoryFile[] = [
      { id: 'input-validation.policy.md', name: 'input-validation.policy.md', path: '.guardian/policies/teams/frontend/input-validation.policy.md', category: 'Validation', size: '4.1 KB', updated: '07/05/2026 15:40', severity: 'medium' },
    ]

    const defaultCustomAuthFiles: RepositoryFile[] = [
      { id: 'mfa.policy.md', name: 'mfa.policy.md', path: '.guardian/policies/custom/authentication/mfa.policy.md', category: 'Authentication', size: '1.5 KB', updated: '06/05/2026 11:10', severity: 'low' },
      { id: 'password.policy.md', name: 'password.policy.md', path: '.guardian/policies/custom/authentication/password.policy.md', category: 'Authentication', size: '2.0 KB', updated: '05/05/2026 09:00', severity: 'low' },
    ]

    const defaultCustomAuthzFiles: RepositoryFile[] = [
      { id: 'rbac-custom.policy.md', name: 'rbac.policy.md', path: '.guardian/policies/custom/authorization/rbac.policy.md', category: 'Authorization', size: '1.2 KB', updated: '04/05/2026 16:30', severity: 'low' },
      { id: 'abac.policy.md', name: 'abac.policy.md', path: '.guardian/policies/custom/authorization/abac.policy.md', category: 'Authorization', size: '3.0 KB', updated: '03/05/2026 14:00', severity: 'medium' },
    ]

    return {
      id: '.guardian',
      name: 'guardian',
      path: '.guardian',
      count: 11,
      subfolders: [
        {
          id: '.guardian/policies',
          name: 'policies',
          path: '.guardian/policies',
          count: 11,
          files: [],
          subfolders: [
            {
              id: '.guardian/policies/global',
              name: 'global',
              path: '.guardian/policies/global',
              count: defaultGlobalFiles.length,
              files: defaultGlobalFiles,
            },
            {
              id: '.guardian/policies/teams',
              name: 'teams',
              path: '.guardian/policies/teams',
              count: defaultTeamBackendFiles.length + defaultTeamFrontendFiles.length,
              files: [],
              subfolders: [
                {
                  id: '.guardian/policies/teams/backend',
                  name: 'backend',
                  path: '.guardian/policies/teams/backend',
                  count: defaultTeamBackendFiles.length,
                  files: defaultTeamBackendFiles,
                },
                {
                  id: '.guardian/policies/teams/frontend',
                  name: 'frontend',
                  path: '.guardian/policies/teams/frontend',
                  count: defaultTeamFrontendFiles.length,
                  files: defaultTeamFrontendFiles,
                },
              ],
            },
            {
              id: '.guardian/policies/custom',
              name: 'custom',
              path: '.guardian/policies/custom',
              count: defaultCustomAuthFiles.length + defaultCustomAuthzFiles.length,
              files: [],
              subfolders: [
                {
                  id: '.guardian/policies/custom/authentication',
                  name: 'authentication',
                  path: '.guardian/policies/custom/authentication',
                  count: defaultCustomAuthFiles.length,
                  files: defaultCustomAuthFiles,
                },
                {
                  id: '.guardian/policies/custom/authorization',
                  name: 'authorization',
                  path: '.guardian/policies/custom/authorization',
                  count: defaultCustomAuthzFiles.length,
                  files: defaultCustomAuthzFiles,
                },
              ],
            },
          ],
        },
      ],
      files: [],
    }
  }, [])

  // Flatten all files from tree for global search & selection lookup
  const allRepositoryFiles = useMemo(() => {
    const filesList: RepositoryFile[] = []
    function traverseFolder(folder: RepositoryFolder) {
      if (folder.files) {
        filesList.push(...folder.files)
      }
      if (folder.subfolders) {
        folder.subfolders.forEach(traverseFolder)
      }
    }
    traverseFolder(repositoryTree)
    return filesList
  }, [repositoryTree])

  // Get active selected Policy object
  const selectedPolicyObject = useMemo(() => {
    const backendMatch = policies?.find((p) => p.id === selectedFileId)
    if (backendMatch) return backendMatch

    const fileMeta = allRepositoryFiles.find((f) => f.id === selectedFileId || f.name === selectedFileId)
    const filename = fileMeta?.name || selectedFileId
    const rawContent = DEFAULT_POLICY_CONTENT[filename] || DEFAULT_POLICY_CONTENT['disabled-security-control.policy.md']

    return {
      id: filename,
      category: fileMeta?.category || 'Security Policy',
      severity: fileMeta?.severity || 'medium',
      scope: ['**/*.ts', '**/*.tsx'],
      tags: ['security', 'governance'],
      raw: rawContent,
      version: 1,
      updatedBy: 'Security Lead',
      lastUpdated: fileMeta?.updated || '12/05/2026 11:20',
      changeSummary: 'Active enterprise security control policy',
    } as Policy
  }, [policies, selectedFileId, allRepositoryFiles])

  // Get selected repository file metadata
  const selectedFileMeta = useMemo(() => {
    return allRepositoryFiles.find((f) => f.id === selectedFileId || f.name === selectedFileId) ?? allRepositoryFiles[0]
  }, [allRepositoryFiles, selectedFileId])


  // Files in currently active folder path
  const currentFolderFiles = useMemo(() => {
    function findFolder(folder: RepositoryFolder, targetPath: string): RepositoryFolder | null {
      if (folder.path === targetPath) return folder
      if (folder.subfolders) {
        for (const sub of folder.subfolders) {
          const res = findFolder(sub, targetPath)
          if (res) return res
        }
      }
      return null
    }

    const folder = findFolder(repositoryTree, activeFolderPath)
    return folder ? folder.files : []
  }, [repositoryTree, activeFolderPath])

  // Filtered file list based on search query & severity filter
  const filteredFolderFiles = useMemo(() => {
    let list = currentFolderFiles
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = allRepositoryFiles.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.path.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q)
      )
    }
    return list
  }, [currentFolderFiles, allRepositoryFiles, searchQuery])

  // Toggle folder open/collapse
  function toggleFolder(path: string) {
    setExpandedPaths((prev) => ({
      ...prev,
      [path]: !prev[path],
    }))
  }

  function handleSelectFolder(path: string) {
    setActiveFolderPath(path)
  }

  function handleSelectFile(file: RepositoryFile) {
    setSelectedFileId(file.id)
    setIsEditing(false)
    setCreatingNew(false)
    // Update active folder path to match file location
    const folderPath = file.path.substring(0, file.path.lastIndexOf('/'))
    if (folderPath) setActiveFolderPath(folderPath)
  }

  function refreshAll() {
    refetchPolicies()
    setIsEditing(false)
    setCreatingNew(false)
  }

  async function handleDeletePolicy() {
    if (!selectedPolicyObject) return
    if (!confirm(`Are you sure you want to delete ${selectedPolicyObject.id}?`)) return
    try {
      await api.delete(`/policies/${selectedPolicyObject.id}`)
      refreshAll()
    } catch {
      alert('Failed to delete policy.')
    }
  }

  // Recursive Tree Node component
  function renderTreeNode(folder: RepositoryFolder, level = 0) {
    const isExpanded = !!expandedPaths[folder.path]
    const isSelected = activeFolderPath === folder.path
    const indentPx = level * 16

    return (
      <div key={folder.path} className="select-none font-sans text-xs">
        {/* Folder Header */}
        <div
          style={{ paddingLeft: `${indentPx + 6}px` }}
          onClick={() => {
            toggleFolder(folder.path)
            handleSelectFolder(folder.path)
          }}
          className={`group flex items-center justify-between py-1.5 px-2 transition-colors cursor-pointer rounded-[8px] ${
            isSelected
              ? 'bg-[#F1F5F9] text-[#0F172A] font-bold'
              : 'text-[#1E293B] hover:bg-[#F8F9FA] font-bold'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {folder.subfolders && folder.subfolders.length > 0 ? (
              <span className="text-[#64748B] p-0.5">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            ) : (
              <span className="w-4" />
            )}

            {isExpanded ? (
              <FolderOpen size={15} className="text-[#1E293B]" />
            ) : (
              <Folder size={15} className="text-[#1E293B]" />
            )}

            <span className="truncate font-bold text-xs">{folder.name}</span>
          </div>

          <span className="text-[11px] text-[#64748B] font-semibold bg-[#F1F5F9] border border-[#E2E8F0] px-2 py-0.5 rounded-full shrink-0 min-w-[22px] text-center">
            {folder.count}
          </span>
        </div>

        {/* Folder Children (Subfolders & Files) */}
        {isExpanded && (
          <div className="relative border-l border-[#E2E8F0] ml-4 pl-1 space-y-1 my-1">
            {folder.subfolders?.map((sub) => renderTreeNode(sub, level + 1))}

            {folder.files?.map((file) => {
              const isFileSelected = selectedFileId === file.id && !creatingNew
              const fileIndentPx = (level + 1) * 16

              return (
                <div
                  key={file.id}
                  style={{ paddingLeft: `${fileIndentPx + 6}px` }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectFile(file)
                  }}
                  className={`flex items-center gap-2 py-1 px-2 transition-colors cursor-pointer rounded-[6px] ${
                    isFileSelected
                      ? 'text-[#B40000] font-bold'
                      : 'text-[#475569] font-medium hover:text-[#0F172A] hover:bg-[#F8F9FA]'
                  }`}
                >
                  <FileText size={15} className={isFileSelected ? 'text-[#B40000]' : 'text-[#94A3B8]'} />
                  <span className="truncate font-sans text-xs">{file.name}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="-mx-8 -my-6 p-8 bg-white min-h-[calc(100vh-64px)] w-full font-sans antialiased text-[#111827] space-y-6 selection:bg-[#B40000] selection:text-white">
      {/* Top Header & Repository Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E5E7EB] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-[#111827]">Policy Repository</h1>
            <span className="text-xs text-[#64748B] font-medium border-l border-[#E5E7EB] pl-3">
              11 policies · 3 folders
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[#64748B]">
            Enterprise source code policy governance file system
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Main Search Bar */}
          <div className="relative w-80 sm:w-96">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search policies and folders..."
              className="w-full rounded-[6px] border border-[#E5E7EB] bg-[#F8F9FA] py-2.5 pl-10 pr-3.5 text-sm text-[#111827] placeholder-[#94A3B8] focus:border-[#B40000] focus:bg-white focus:outline-none transition-all shadow-sm"
            />
          </div>

          <button
            onClick={() => refetchPolicies()}
            className="flex items-center gap-2 rounded-[6px] border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] hover:bg-[#F8F9FA] transition-colors cursor-pointer shadow-sm"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-[#B40000]' : 'text-[#64748B]'} />
            <span>Refresh</span>
          </button>

          {can('policy:edit-direct') && (
            <TechButton
              onClick={() => setShowCreateModal(true)}
              icon={<Plus size={16} />}
            >
              NEW POLICY
            </TechButton>
          )}
        </div>
      </div>

      {/* Main Repository Layout Container (Expansive Edge-to-Edge Grid) */}
      <div className="grid grid-cols-12 gap-6 w-full min-h-[calc(100vh-180px)]">
        {/* Left Pane: Hierarchical Folder Tree (Width ~300px) */}
        <div className="col-span-12 lg:col-span-3 border-r border-[#E5E7EB] pr-5 space-y-4">
          <div className="pb-2 border-b border-[#E5E7EB]">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                EXPLORER
              </span>
            </div>
          </div>

          {/* Dynamic Nested Folder Tree Renderer */}
          <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-220px)]">
            {renderTreeNode(repositoryTree)}
          </div>
        </div>

        {/* Right Pane: Main File Explorer & Code Preview */}
        <div className="col-span-12 lg:col-span-9 space-y-4 pl-1">
          {/* Breadcrumb Navigation Bar */}
          <div className="flex items-center justify-between rounded-[6px] bg-[#F8F9FA] border border-[#E5E7EB] px-3.5 py-2 text-xs text-[#64748B]">
            <div className="flex items-center gap-1.5 font-mono text-[12px]">
              {activeFolderPath.split('/').map((part, index, arr) => {
                const stepPath = arr.slice(0, index + 1).join('/')
                return (
                  <span key={stepPath} className="flex items-center gap-1.5">
                    <button
                      onClick={() => setActiveFolderPath(stepPath)}
                      className="hover:text-[#B40000] hover:underline transition-colors font-medium cursor-pointer"
                    >
                      {part}
                    </button>
                    {index < arr.length - 1 && <span className="text-[#94A3B8]">/</span>}
                  </span>
                )
              })}
            </div>
            <span className="text-[11px] text-[#94A3B8] font-mono">
              {filteredFolderFiles.length} files
            </span>
          </div>

          {/* Policy Preview & Editor Container (Expansive Layout) */}
          <div className="space-y-4">
            {creatingNew || isEditing ? (
              <PolicyEditor
                policy={selectedPolicyObject}
                isNew={creatingNew}
                onSaved={refreshAll}
                onDeleted={refreshAll}
                onCancelNew={() => {
                  setCreatingNew(false)
                  setIsEditing(false)
                }}
              />
            ) : selectedPolicyObject || selectedFileMeta ? (
              <div className="space-y-3">
                {/* File Header & Action Buttons */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#E5E7EB] pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-[#111827]" />
                      <h2 className="text-sm font-bold text-[#111827] font-mono">
                        {selectedFileMeta?.name ?? selectedPolicyObject?.id}
                      </h2>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#64748B] font-mono">
                      {selectedFileMeta?.path ?? `.guardian/policies/global/${selectedPolicyObject?.id}`}
                    </p>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyPathToClipboard(selectedFileMeta?.path ?? `.guardian/policies/global/${selectedPolicyObject?.id}`)}
                      className="flex items-center gap-1 rounded-[6px] border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs font-semibold text-[#64748B] hover:text-[#111827] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                      title="Copy file path"
                    >
                      <Copy size={13} />
                      <span>Copy Path</span>
                    </button>

                    <button
                      onClick={() => downloadPolicyFile(selectedFileMeta?.name ?? selectedPolicyObject?.id ?? 'policy.md', selectedPolicyObject?.raw || '')}
                      className="flex items-center gap-1 rounded-[6px] border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs font-semibold text-[#64748B] hover:text-[#111827] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                      title="Download policy file"
                    >
                      <Download size={13} />
                      <span>Download</span>
                    </button>

                    {can('policy:edit-direct') && (
                      <>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="flex items-center gap-1 rounded-[6px] border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-semibold text-[#111827] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                        >
                          <Edit3 size={13} />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => setShowMoveModal(true)}
                          className="flex items-center gap-1 rounded-[6px] border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-semibold text-[#111827] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                        >
                          <Move size={13} />
                          <span>Move</span>
                        </button>

                        <button
                          onClick={handleDeletePolicy}
                          className="flex items-center gap-1 rounded-[6px] border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-[#B91C1C] hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Compact Policy Metadata Row */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-2 px-3 bg-[#F8F9FA] rounded-[6px] border border-[#E5E7EB] text-xs font-sans">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#64748B] font-medium">Category:</span>
                    <span className="font-semibold text-[#111827]">{selectedFileMeta?.category || selectedPolicyObject?.category || 'Security Policy'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#64748B] font-medium">Severity:</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                      (selectedFileMeta?.severity || selectedPolicyObject?.severity) === 'critical'
                        ? 'bg-red-50 text-[#B91C1C] border-red-200'
                        : (selectedFileMeta?.severity || selectedPolicyObject?.severity) === 'high'
                        ? 'bg-amber-50 text-[#D97706] border-amber-200'
                        : (selectedFileMeta?.severity || selectedPolicyObject?.severity) === 'medium'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>
                      {selectedFileMeta?.severity || selectedPolicyObject?.severity || 'medium'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#64748B] font-medium">Tags:</span>
                    <span className="text-[#64748B] font-mono text-[11px]">
                      {selectedFileMeta?.tags?.join(' · ') || (Array.isArray(selectedPolicyObject?.tags) ? selectedPolicyObject.tags.join(' · ') : 'security · governance · audit')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#64748B] font-medium">Scope:</span>
                    <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-[#E5E7EB] text-[#111827]">
                      {Array.isArray(selectedPolicyObject?.scope) ? selectedPolicyObject.scope.join(' · ') : (selectedPolicyObject?.scope || '**/*.ts · **/*.tsx · **/*.js')}
                    </code>
                  </div>
                </div>

                {/* Preview / Raw / Revision Tabs */}
                <div className="flex items-center border-b border-[#E5E7EB] text-xs">
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`border-b-2 px-4 pb-2 font-semibold cursor-pointer transition-colors ${
                      activeTab === 'preview'
                        ? 'border-[#B40000] text-[#B40000]'
                        : 'border-transparent text-[#64748B] hover:text-[#111827]'
                    }`}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => setActiveTab('raw')}
                    className={`border-b-2 px-4 pb-2 font-semibold cursor-pointer transition-colors ${
                      activeTab === 'raw'
                        ? 'border-[#B40000] text-[#B40000]'
                        : 'border-transparent text-[#64748B] hover:text-[#111827]'
                    }`}
                  >
                    Raw
                  </button>
                  <button
                    onClick={() => setActiveTab('revision')}
                    className={`border-b-2 px-4 pb-2 font-semibold cursor-pointer transition-colors ${
                      activeTab === 'revision'
                        ? 'border-[#B40000] text-[#B40000]'
                        : 'border-transparent text-[#64748B] hover:text-[#111827]'
                    }`}
                  >
                    Revision
                  </button>
                </div>

                {/* Main Tab Content View */}
                {activeTab === 'revision' ? (
                  <div className="space-y-4 p-4 border border-[#E5E7EB] rounded-[6px] bg-[#FAF8F8]">
                    {/* Metadata Header Box */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-[#E5E7EB] pb-3 text-xs">
                      <div>
                        <span className="block text-[#64748B] text-[11px]">Người tạo (Author):</span>
                        <span className="font-semibold text-[#111827]">Phạm Quang Huy (Developer)</span>
                      </div>
                      <div>
                        <span className="block text-[#64748B] text-[11px]">Ngày tạo (Created Date):</span>
                        <span className="font-mono text-[#111827]">10/05/2026 09:00:00</span>
                      </div>
                      <div>
                        <span className="block text-[#64748B] text-[11px]">Cập nhật lần cuối (Last Modified):</span>
                        <span className="font-mono text-[#111827]">12/05/2026 14:30:15</span>
                      </div>
                    </div>

                    {/* Detailed Revision History Log Table */}
                    <div>
                      <h4 className="text-xs font-bold text-[#111827] mb-2.5">Lịch sử chỉnh sửa & Phiên bản (Revision Log History)</h4>
                      <div className="rounded-[6px] border border-[#E5E7EB] bg-white overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#F8F9FA] border-b border-[#E5E7EB] text-[11px] font-semibold text-[#64748B]">
                              <th className="py-2.5 px-3">Phiên bản (Version)</th>
                              <th className="py-2.5 px-3">Ngày chỉnh sửa (Date)</th>
                              <th className="py-2.5 px-3">Tác giả (Author)</th>
                              <th className="py-2.5 px-3">Chi tiết thay đổi (Commit Message)</th>
                              <th className="py-2.5 px-3 text-right">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E5E7EB] font-mono text-[11.5px]">
                            <tr className="hover:bg-[#F8F9FA]">
                              <td className="py-2.5 px-3 font-bold text-[#B40000]">v1.2.0</td>
                              <td className="py-2.5 px-3 text-[#64748B]">12/05/2026 14:30:15</td>
                              <td className="py-2.5 px-3 text-[#111827]">Security Admin</td>
                              <td className="py-2.5 px-3 text-[#111827]">Cập nhật bổ sung quy tắc cấm bypass security control & nới rộng scope kiểm tra</td>
                              <td className="py-2.5 px-3 text-right"><span className="inline-block px-2 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded border border-emerald-200">Active</span></td>
                            </tr>
                            <tr className="hover:bg-[#F8F9FA]">
                              <td className="py-2.5 px-3 font-bold text-[#111827]">v1.1.0</td>
                              <td className="py-2.5 px-3 text-[#64748B]">11/05/2026 11:20:00</td>
                              <td className="py-2.5 px-3 text-[#111827]">Phạm Quang Huy</td>
                              <td className="py-2.5 px-3 text-[#111827]">Sửa đổi tham số severity từ MEDIUM lên CRITICAL theo yêu cầu Audit</td>
                              <td className="py-2.5 px-3 text-right"><span className="inline-block px-2 py-0.5 text-[10px] font-semibold text-gray-600 bg-gray-50 rounded border border-gray-200">Merged</span></td>
                            </tr>
                            <tr className="hover:bg-[#F8F9FA]">
                              <td className="py-2.5 px-3 font-bold text-[#111827]">v1.0.0</td>
                              <td className="py-2.5 px-3 text-[#64748B]">10/05/2026 09:00:00</td>
                              <td className="py-2.5 px-3 text-[#111827]">Phạm Quang Huy</td>
                              <td className="py-2.5 px-3 text-[#111827]">Khởi tạo chính sách an toàn mã nguồn ban đầu trong thư mục global</td>
                              <td className="py-2.5 px-3 text-right"><span className="inline-block px-2 py-0.5 text-[10px] font-semibold text-gray-600 bg-gray-50 rounded border border-gray-200">Initial</span></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Numbered Code Viewer Container (JetBrains Mono font, #FAFAFA background) */
                  <div className="rounded-[6px] border border-[#E5E7EB] bg-[#FAFAFA] p-3.5 font-mono text-[12px] text-[#111827] overflow-x-auto min-h-[550px] max-h-[calc(100vh-280px)] overflow-y-auto">
                    {activeTab === 'preview' ? (
                      <table className="w-full border-collapse">
                        <tbody>
                          {(selectedPolicyObject?.raw || '').split('\n').map((line, idx) => (
                            <tr key={idx} className="hover:bg-[#F8F9FA]">
                              <td className="w-8 select-none text-right pr-4 text-[#94A3B8] font-mono text-[11px] align-top border-r border-[#E5E7EB] mr-3">
                                {idx + 1}
                              </td>
                              <td className="pl-3 whitespace-pre font-mono leading-relaxed text-[#111827] align-top">
                                {line}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-[#111827]">
                        {selectedPolicyObject?.raw}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-[#94A3B8]">
                Select a policy file from the repository tree to preview code or view revision details.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Create New Policy */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[8px] border border-[#E5E7EB] bg-white p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <h3 className="text-sm font-bold text-[#111827]">Create New Policy</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#64748B] hover:text-[#111827] p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#111827] mb-1">Target Directory</label>
                <select
                  value={newPolicyFolderPath}
                  onChange={(e) => setNewPolicyFolderPath(e.target.value)}
                  className="w-full rounded-[6px] border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-1.5 font-mono text-xs focus:border-[#B40000] focus:outline-none"
                >
                  <option value=".guardian/policies/global">.guardian/policies/global</option>
                  <option value=".guardian/policies/teams/backend">.guardian/policies/teams/backend</option>
                  <option value=".guardian/policies/teams/frontend">.guardian/policies/teams/frontend</option>
                  <option value=".guardian/policies/custom/authentication">.guardian/policies/custom/authentication</option>
                  <option value=".guardian/policies/custom/authorization">.guardian/policies/custom/authorization</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#111827] mb-1">Policy Filename</label>
                <input
                  type="text"
                  value={newPolicyName}
                  onChange={(e) => setNewPolicyName(e.target.value)}
                  className="w-full rounded-[6px] border border-[#E5E7EB] bg-white px-3 py-1.5 font-mono text-xs focus:border-[#B40000] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] pt-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-[6px] border border-[#E5E7EB] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#64748B] hover:bg-[#F8F9FA] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setCreatingNew(true)
                  setIsEditing(false)
                }}
                className="rounded-[6px] bg-[#B40000] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#C8102E] cursor-pointer"
              >
                Create Policy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Move Policy */}
      {showMoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[8px] border border-[#E5E7EB] bg-white p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <h3 className="text-sm font-bold text-[#111827]">Move Policy File</h3>
              <button
                onClick={() => setShowMoveModal(false)}
                className="text-[#64748B] hover:text-[#111827] p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="block text-[#64748B]">Current File:</span>
                <span className="font-mono font-semibold text-[#111827]">{selectedFileMeta?.path}</span>
              </div>

              <div>
                <label className="block font-semibold text-[#111827] mb-1">Destination Folder</label>
                <select
                  value={moveDestinationPath}
                  onChange={(e) => setMoveDestinationPath(e.target.value)}
                  className="w-full rounded-[6px] border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-1.5 font-mono text-xs focus:border-[#B40000] focus:outline-none"
                >
                  <option value=".guardian/policies/global">.guardian/policies/global</option>
                  <option value=".guardian/policies/teams/backend">.guardian/policies/teams/backend</option>
                  <option value=".guardian/policies/teams/frontend">.guardian/policies/teams/frontend</option>
                  <option value=".guardian/policies/custom/authentication">.guardian/policies/custom/authentication</option>
                  <option value=".guardian/policies/custom/authorization">.guardian/policies/custom/authorization</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] pt-3">
              <button
                onClick={() => setShowMoveModal(false)}
                className="rounded-[6px] border border-[#E5E7EB] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#64748B] hover:bg-[#F8F9FA] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowMoveModal(false)
                  setActiveFolderPath(moveDestinationPath)
                  alert(`Successfully moved policy to ${moveDestinationPath}`)
                }}
                className="flex items-center gap-1 rounded-[6px] bg-[#B40000] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#C8102E] cursor-pointer"
              >
                <CheckCircle2 size={13} />
                <span>Confirm Move</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
