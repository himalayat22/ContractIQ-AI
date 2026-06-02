import { Link } from 'react-router-dom'

export function AuthLayout({ children }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">ContractIQ AI</h1>
          <p className="mt-2 text-sm text-slate-500">
            MVP auth shell for frontend scaffolding
          </p>
          <div className="mt-4 flex justify-center gap-4 text-sm">
            <Link className="text-blue-600 hover:underline" to="/login">
              Login
            </Link>
            <Link className="text-blue-600 hover:underline" to="/register">
              Register
            </Link>
          </div>
        </div>
        {children}
      </div>
    </main>
  )
}
