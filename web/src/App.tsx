import { Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
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
      <Route element={<AppLayout />}>
        <Route index element={<Overview />} />
        <Route path="code-audit" element={<CodeAudit />} />
        <Route path="findings" element={<Findings />} />
        <Route path="policies" element={<Policies />} />
        <Route path="audit-history" element={<AuditHistory />} />
        <Route path="audit-cache" element={<AuditCache />} />
        <Route path="diagnostics" element={<SystemDiagnostics />} />
        <Route path="engine-config" element={<EngineConfig />} />
      </Route>
    </Routes>
  )
}

export default App
