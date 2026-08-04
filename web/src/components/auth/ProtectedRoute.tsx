import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import type { Permission, Role } from '../../lib/rbac'
import { Forbidden } from '../../pages/Forbidden'

interface Props {
  /** If set, only these roles may pass — used for pages restricted by role rather than a single permission (e.g. AI Engine Config: admin only). */
  allowedRoles?: Role[]
  /** If set, the current role must carry this permission (checked via lib/rbac.ts, mirroring src/server/rbac.ts). */
  requiredPermission?: Permission
  children?: ReactNode
}

/**
 * Two jobs depending on where it's mounted: wrapping the whole authenticated section (no props)
 * just requires a logged-in user and renders <Outlet/>; wrapping a single page (with
 * allowedRoles/requiredPermission) additionally gates that page and renders Forbidden on denial —
 * never a silent redirect, so a blocked user understands why, per the "friendly 403" requirement.
 */
export function ProtectedRoute({ allowedRoles, requiredPermission, children }: Props) {
  const { user, can } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Forbidden requiredRoles={allowedRoles} />
  }
  if (requiredPermission && !can(requiredPermission)) {
    return <Forbidden />
  }

  return children ? <>{children}</> : <Outlet />
}
