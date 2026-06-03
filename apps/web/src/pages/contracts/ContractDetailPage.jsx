import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { StatusBadge } from '../../components/contracts/StatusBadge'
import { RiskBadge } from '../../components/contracts/RiskBadge'
import {
  formatContractType,
  formatDate,
  formatDateTime,
  formatFileSize,
} from '../../lib/format'
import { getAnalysisStatus } from '../../services/analysisApi'
import { deleteContract, getContract } from '../../services/contractApi'

const POLL_INTERVAL_MS = 4000
const ACTIVE_STATUSES = new Set(['uploading', 'processing'])

export function ContractDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [contract, setContract] = useState(null)
  const [analysisStatus, setAnalysisStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const loadContract = useCallback(async () => {
    try {
      const data = await getContract(id)
      setContract(data)
      setErrorMessage('')

      if (ACTIVE_STATUSES.has(data.status) || data.status === 'analyzed') {
        try {
          const status = await getAnalysisStatus(id)
          setAnalysisStatus(status)
        } catch {
          setAnalysisStatus(null)
        }
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load contract')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on contract id change
    setIsLoading(true)
    loadContract()
  }, [loadContract])

  useEffect(() => {
    if (!contract || !ACTIVE_STATUSES.has(contract.status)) {
      return undefined
    }

    const intervalId = setInterval(loadContract, POLL_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [contract, loadContract])

  const handleDelete = async () => {
    if (!window.confirm('Delete this contract? This cannot be undone.')) {
      return
    }

    setIsDeleting(true)
    try {
      await deleteContract(id)
      navigate('/app/contracts')
    } catch (error) {
      setErrorMessage(error.message || 'Failed to delete contract')
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading contract…</p>
  }

  if (errorMessage && !contract) {
    return (
      <div className="space-y-4">
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
        <Link to="/app/contracts" className="text-sm text-blue-600 hover:underline">
          ← Back to contracts
        </Link>
      </div>
    )
  }

  if (!contract) {
    return null
  }

  const showAnalysisLink = contract.status === 'analyzed' || contract.status === 'processing'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/app/contracts" className="text-sm text-blue-600 hover:underline">
            ← Back to contracts
          </Link>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">{contract.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{contract.counterparty}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showAnalysisLink ? (
            <Link
              to={`/app/contracts/${id}/analysis`}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              View analysis
            </Link>
          ) : null}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {ACTIVE_STATUSES.has(contract.status) ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Analysis in progress</p>
          <p className="mt-1 text-amber-800">
            {analysisStatus
              ? `${analysisStatus.stage?.replace(/_/g, ' ') ?? 'Processing'} — ${analysisStatus.progress ?? 0}%`
              : 'Your contract is being processed. This page refreshes automatically.'}
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Overview</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Status</dt>
              <dd>
                <StatusBadge status={contract.status} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Type</dt>
              <dd className="text-slate-900">{formatContractType(contract.contractType)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Risk</dt>
              <dd>
                <RiskBadge level={contract.riskLevel} score={contract.riskScore} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Effective</dt>
              <dd className="text-slate-900">{formatDate(contract.effectiveDate)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Expiration</dt>
              <dd className="text-slate-900">{formatDate(contract.expirationDate)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Tags</dt>
              <dd className="text-right text-slate-900">
                {contract.tags?.length ? contract.tags.join(', ') : '—'}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">File</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">File name</dt>
              <dd className="text-right text-slate-900">{contract.fileName ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Size</dt>
              <dd className="text-slate-900">{formatFileSize(contract.fileSize)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Version</dt>
              <dd className="text-slate-900">{contract.versionNumber ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Uploaded</dt>
              <dd className="text-slate-900">{formatDateTime(contract.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Last updated</dt>
              <dd className="text-slate-900">{formatDateTime(contract.updatedAt)}</dd>
            </div>
          </dl>
        </section>
      </div>

      {contract.keyDates?.length ? (
        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Key dates</h3>
          <ul className="mt-4 divide-y divide-slate-100">
            {contract.keyDates.map((item) => (
              <li key={`${item.label}-${item.date}`} className="flex justify-between py-2 text-sm">
                <span className="text-slate-700">{item.label}</span>
                <span className="text-slate-900">{formatDate(item.date)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
