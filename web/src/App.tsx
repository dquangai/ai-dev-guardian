import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { Login } from './pages/Login'
import { Overview } from './pages/Overview'
import { CodeAudit } from './pages/CodeAudit'
import { Findings } from './pages/Findings'
import { Policies } from './pages/Policies'
import { AuditHistory } from './pages/AuditHistory'
import { AuditCache } from './pages/AuditCache'
import { SystemDiagnostics } from './pages/SystemDiagnostics'
import { EngineConfig } from './pages/EngineConfig'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route
            index
            element={
              <ProtectedRoute allowedRoles={['admin', 'senior-dev', 'auditor']}>
                <Overview />
              </ProtectedRoute>
            }
          />
          <Route
            path="code-audit"
            element={
              <ProtectedRoute requiredPermission="audit:run">
                <CodeAudit />
              </ProtectedRoute>
            }
          />
          <Route
            path="findings"
            element={
              <ProtectedRoute requiredPermission="audit:view">
                <Findings />
              </ProtectedRoute>
            }
          />
          <Route
            path="policies"
            element={
              <ProtectedRoute requiredPermission="policy:view">
                <Policies />
              </ProtectedRoute>
            }
          />
          <Route
            path="audit-history"
            element={
              <ProtectedRoute allowedRoles={['admin', 'senior-dev', 'auditor']}>
                <AuditHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="audit-cache"
            element={
              <ProtectedRoute allowedRoles={['admin', 'auditor']}>
                <AuditCache />
              </ProtectedRoute>
            }
          />
          <Route
            path="diagnostics"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <SystemDiagnostics />
              </ProtectedRoute>
            }
          />
          <Route
            path="engine-config"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <EngineConfig />
              </ProtectedRoute>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
