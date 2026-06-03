import { Link } from 'react-router-dom'

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-semibold text-slate-900">Welcome to ContractIQ AI</h2>
        <p className="mt-2 text-sm text-slate-600">
          Upload contracts, run AI analysis, and review risk insights from your dashboard.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/app/contracts"
          className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-300"
        >
          <h3 className="font-semibold text-slate-900">Contract list</h3>
          <p className="mt-2 text-sm text-slate-600">
            Browse uploaded contracts, filter by status, and open details.
          </p>
        </Link>
        <Link
          to="/app/contracts/upload"
          className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-300"
        >
          <h3 className="font-semibold text-slate-900">Upload contract</h3>
          <p className="mt-2 text-sm text-slate-600">
            Upload a PDF to trigger ingestion and AI analysis automatically.
          </p>
        </Link>
      </div>
    </div>
  )
}
