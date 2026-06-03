import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const NAV_LINKS = [
  { to: '/app/dashboard', label: 'Dashboard', end: true },
  { to: '/app/contracts', label: 'Contracts', end: false },
  { to: '/app/contracts/upload', label: 'Upload', end: false },
]

function navClassName({ isActive }) {
  return isActive
    ? 'rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900'
    : 'rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
}

export function AppLayout({ children }) {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-6">
              <NavLink to="/app/dashboard" className="text-lg font-semibold text-slate-900">
                ContractIQ
              </NavLink>
              <nav className="flex flex-wrap gap-1">
                {NAV_LINKS.map((link) => (
                  <NavLink key={link.to} to={link.to} end={link.end} className={navClassName}>
                    {link.label}
                  </NavLink>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">{user?.email}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-5xl px-4 py-8">{children}</section>
    </main>
  )
}
