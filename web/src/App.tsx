import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import { defaultRouteForRole } from './lib/navigation'
import { Login } from './pages/Login'
import { Overview } from './pages/Overview'
import { CodeAudit } from './pages/CodeAudit'
import { Findings } from './pages/Findings'
import { Policies } from './pages/Policies'
import { ProposePolicy } from './pages/ProposePolicy'
import { PolicyApprovals } from './pages/PolicyApprovals'
import { BypassApprovals } from './pages/BypassApprovals'
import { SystemDiagnostics } from './pages/SystemDiagnostics'
import { EngineConfig } from './pages/EngineConfig'
import { TeamManagement } from './pages/TeamManagement'

/** Catch-all target: send an authenticated user to their own landing page rather than a fixed
 * route, since "/" itself is Forbidden for a Dev — a plain <Navigate to="/"> would bounce them
 * straight into a 403 instead of somewhere they can actually use. */
function DefaultRedirect() {
  const { user, ready } = useAuth()
  if (!ready) return null
  return <Navigate to={user ? defaultRouteForRole(user.role, user.teamId) : '/login'} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route
            index
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'senior-dev', 'developer', 'auditor', 'super-admin']}
                requireTeamContext
              >
                <Overview />
              </ProtectedRoute>
            }
          />
          <Route
            path="findings"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'senior-dev', 'developer', 'auditor', 'super-admin']}
                requireTeamContext
              >
                <Findings />
              </ProtectedRoute>
            }
          />
          <Route
            path="policies"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'senior-dev', 'developer', 'auditor', 'super-admin']}
                requireTeamContext
              >
                <Policies />
              </ProtectedRoute>
            }
          />
          <Route
            path="policies/propose"
            element={
              <ProtectedRoute allowedRoles={['senior-dev']}>
                <ProposePolicy />
              </ProtectedRoute>
            }
          />
          <Route
            path="policy-approvals"
            element={
              <ProtectedRoute allowedRoles={['admin', 'senior-dev']}>
                <PolicyApprovals />
              </ProtectedRoute>
            }
          />
          <Route
            path="bypass-approvals"
            element={
              <ProtectedRoute allowedRoles={['admin', 'senior-dev']}>
                <BypassApprovals />
              </ProtectedRoute>
            }
          />
          <Route
            path="code-audit"
            element={
              <ProtectedRoute allowedRoles={['developer']}>
                <CodeAudit />
              </ProtectedRoute>
            }
          />
          <Route
            path="diagnostics"
            element={
              <ProtectedRoute allowedRoles={['admin', 'senior-dev', 'auditor']}>
                <SystemDiagnostics />
              </ProtectedRoute>
            }
          />
          <Route
            path="engine-config"
            element={
              <ProtectedRoute allowedRoles={['admin', 'auditor']}>
                <EngineConfig />
              </ProtectedRoute>
            }
          />
          <Route
            path="teams"
            element={
              <ProtectedRoute allowedRoles={['super-admin']}>
                <TeamManagement />
              </ProtectedRoute>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
  )
}

export default App
