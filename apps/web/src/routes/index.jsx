import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthLayout } from '../components/layout/AuthLayout'
import { AppLayout } from '../components/layout/AppLayout'
import { LoginPage } from '../pages/auth/LoginPage'
import { RegisterPage } from '../pages/auth/RegisterPage'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { ContractsListPage } from '../pages/contracts/ContractsListPage'
import { ContractUploadPage } from '../pages/contracts/ContractUploadPage'
import { ContractDetailPage } from '../pages/contracts/ContractDetailPage'
import { AnalysisViewPage } from '../pages/contracts/AnalysisViewPage'
import { useAuthStore } from '../store/authStore'

function PublicOnlyRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? <Navigate to="/app/dashboard" replace /> : children
}

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function ProtectedAppPage({ children }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <AuthLayout>
              <LoginPage />
            </AuthLayout>
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <AuthLayout>
              <RegisterPage />
            </AuthLayout>
          </PublicOnlyRoute>
        }
      />
      <Route path="/app/dashboard" element={<ProtectedAppPage><DashboardPage /></ProtectedAppPage>} />
      <Route path="/app/contracts" element={<ProtectedAppPage><ContractsListPage /></ProtectedAppPage>} />
      <Route path="/app/contracts/upload" element={<ProtectedAppPage><ContractUploadPage /></ProtectedAppPage>} />
      <Route path="/app/contracts/:id/analysis" element={<ProtectedAppPage><AnalysisViewPage /></ProtectedAppPage>} />
      <Route path="/app/contracts/:id" element={<ProtectedAppPage><ContractDetailPage /></ProtectedAppPage>} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
