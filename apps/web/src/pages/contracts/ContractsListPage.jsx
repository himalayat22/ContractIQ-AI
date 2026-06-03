import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../../components/contracts/StatusBadge'
import { RiskBadge } from '../../components/contracts/RiskBadge'
import { formatContractType, formatDate } from '../../lib/format'
import { listContracts } from '../../services/contractApi'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'uploading', label: 'Uploading' },
  { value: 'processing', label: 'Processing' },
  { value: 'analyzed', label: 'Analyzed' },
  { value: 'failed', label: 'Failed' },
]

export function ContractsListPage() {
  const [contracts, setContracts] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 })
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const loadContracts = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const result = await listContracts({
        page: pagination.page,
        limit: pagination.limit,
        status: status || undefined,
        q: search || undefined,
      })
      setContracts(result.data)
      setPagination(result.pagination)
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load contracts')
    } finally {
      setIsLoading(false)
    }
  }, [pagination.page, pagination.limit, status, search])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on filter/page change
    loadContracts()
  }, [loadContracts])

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    setPagination((prev) => ({ ...prev, page: 1 }))
    setSearch(searchInput.trim())
  }

  const handleStatusChange = (event) => {
    setPagination((prev) => ({ ...prev, page: 1 }))
    setStatus(event.target.value)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Contracts</h2>
          <p className="mt-1 text-sm text-slate-600">Manage and review your uploaded contracts.</p>
        </div>
        <Link
          to="/app/contracts/upload"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Upload contract
        </Link>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <form className="flex flex-1 gap-2" onSubmit={handleSearchSubmit}>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search title, counterparty, tags…"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Search
            </button>
          </form>
          <select
            value={status}
            onChange={handleStatusChange}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        {isLoading ? (
          <p className="px-6 py-10 text-center text-sm text-slate-500">Loading contracts…</p>
        ) : contracts.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-slate-600">No contracts found.</p>
            <Link
              to="/app/contracts/upload"
              className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
            >
              Upload your first contract
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Counterparty</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Risk</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Updated</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contracts.map((contract) => (
                  <tr key={contract.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{contract.title}</td>
                    <td className="px-4 py-3 text-slate-600">{contract.counterparty}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatContractType(contract.contractType)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={contract.status} />
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge level={contract.riskLevel} score={contract.riskScore} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(contract.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/app/contracts/${contract.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <p className="text-sm text-slate-600">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
