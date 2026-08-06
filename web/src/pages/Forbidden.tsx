import { Link } from 'react-router-dom'
import { ShieldOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { defaultRouteForRole } from '../lib/navigation'
import type { Role } from '../lib/rbac'

const SHORT_ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  'super-admin': 'Super Admin',
  'senior-dev': 'Senior Dev-Lead',
  developer: 'Dev',
  auditor: 'Auditor',
}

export function Forbidden({ requiredRoles }: { requiredRoles?: Role[] } = {}) {
  const { user, roleLabel } = useAuth()
  const requiredLabel = requiredRoles?.map((r) => SHORT_ROLE_LABEL[r]).join(' or ')

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-gray-50 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
        <ShieldOff size={28} />
      </div>
      <h1 className="text-2xl font-semibold text-gray-900">
        403 Forbidden{requiredLabel ? ` — ${requiredLabel} Access Required` : ' — Access Restricted'}
      </h1>
      <p className="max-w-md text-sm text-gray-500">
        {roleLabel ? (
          <>
            Your role (<span className="font-medium text-gray-700">{roleLabel}</span>) doesn't have
            access to this page.
          </>
        ) : (
          "You don't have access to this page."
        )}
      </p>
      <Link
        to={user ? defaultRouteForRole(user.role, user.teamId) : '/login'}
        className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Back to safety
      </Link>
    </div>
  )
}
