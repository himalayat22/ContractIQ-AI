import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RiskBadge } from '../../components/contracts/RiskBadge'
import { StatusBadge } from '../../components/contracts/StatusBadge'
import { formatDate, formatDateTime } from '../../lib/format'
import {
  getAnalysis,
  getAnalysisStatus,
  getKeyObligations,
  listClauses,
} from '../../services/analysisApi'
import { getContract } from '../../services/contractApi'

const POLL_INTERVAL_MS = 4000

export function AnalysisViewPage() {
  const { id } = useParams()
  const [contract, setContract] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [status, setStatus] = useState(null)
  const [clauses, setClauses] = useState([])
  const [obligations, setObligations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const loadAnalysisData = useCallback(async () => {
    try {
      const contractData = await getContract(id)
      setContract(contractData)

      let statusData = null
      try {
        statusData = await getAnalysisStatus(id)
        setStatus(statusData)
      } catch {
        setStatus(null)
      }

      if (contractData.status === 'analyzed' || statusData?.status === 'completed') {
        const [analysisData, clausesResult, obligationsData] = await Promise.all([
          getAnalysis(id),
          listClauses(id, { limit: 100 }),
          getKeyObligations(id).catch(() => ({ keyObligations: [] })),
        ])

        setAnalysis(analysisData)
        setClauses(clausesResult.data)
        setObligations(obligationsData.keyObligations ?? [])
        setErrorMessage('')
      } else {
        setAnalysis(null)
        setClauses([])
        setObligations([])
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load analysis')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on contract id change
    setIsLoading(true)
    loadAnalysisData()
  }, [loadAnalysisData])

  const isInProgress =
    contract?.status === 'processing' ||
    contract?.status === 'uploading' ||
    (status && status.status !== 'completed' && status.status !== 'failed')

  useEffect(() => {
    if (!isInProgress) {
      return undefined
    }

    const intervalId = setInterval(loadAnalysisData, POLL_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [isInProgress, loadAnalysisData])

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading analysis…</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/app/contracts/${id}`} className="text-sm text-blue-600 hover:underline">
          ← Back to contract
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          {contract?.title ?? 'Analysis'}
        </h2>
        <p className="mt-1 text-sm text-slate-600">AI-powered contract analysis results</p>
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {isInProgress ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="font-medium text-amber-900">Analysis in progress</p>
          <p className="mt-1 text-sm text-amber-800">
            {status
              ? `${status.stage?.replace(/_/g, ' ') ?? 'Processing'} — ${status.progress ?? 0}% complete`
              : 'Waiting for analysis to start…'}
          </p>
          {status ? (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-amber-200">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${status.progress ?? 0}%` }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {contract?.status === 'failed' ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
          Analysis failed for this contract. Try uploading again or contact support.
        </div>
      ) : null}

      {analysis ? (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Summary
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-slate-700">
                {analysis.summary ?? 'No summary available.'}
              </p>
            </section>

            <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Risk assessment
              </h3>
              <div className="mt-4 space-y-4">
                <RiskBadge level={analysis.riskLevel} score={analysis.riskScore} />
                {analysis.riskFactors?.length ? (
                  <ul className="space-y-2 text-sm text-slate-600">
                    {analysis.riskFactors.map((factor) => (
                      <li key={factor} className="flex gap-2">
                        <span className="text-red-500">•</span>
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <dl className="space-y-2 border-t border-slate-100 pt-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Status</dt>
                    <dd>
                      <StatusBadge status={analysis.status} />
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Model</dt>
                    <dd className="text-slate-900">{analysis.modelUsed ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Completed</dt>
                    <dd className="text-slate-900">{formatDateTime(analysis.completedAt)}</dd>
                  </div>
                </dl>
              </div>
            </section>
          </div>

          {analysis.keyDates?.length ? (
            <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Key dates
              </h3>
              <ul className="mt-4 divide-y divide-slate-100">
                {analysis.keyDates.map((item) => (
                  <li
                    key={`${item.label}-${item.date}`}
                    className="flex justify-between py-2 text-sm"
                  >
                    <span className="text-slate-700">{item.label}</span>
                    <span className="text-slate-900">{formatDate(item.date)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {obligations.length ? (
            <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Key obligations
              </h3>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead>
                    <tr>
                      <th className="py-2 text-left font-medium text-slate-600">Party</th>
                      <th className="py-2 text-left font-medium text-slate-600">Obligation</th>
                      <th className="py-2 text-left font-medium text-slate-600">Due</th>
                      <th className="py-2 text-left font-medium text-slate-600">Severity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {obligations.map((item, index) => (
                      <tr key={`${item.party}-${index}`}>
                        <td className="py-2 text-slate-900">{item.party}</td>
                        <td className="py-2 text-slate-700">{item.obligation}</td>
                        <td className="py-2 text-slate-600">{formatDate(item.dueDate)}</td>
                        <td className="py-2 capitalize text-slate-600">{item.severity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {clauses.length ? (
            <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Clauses ({clauses.length})
              </h3>
              <ul className="mt-4 space-y-4">
                {clauses.map((clause) => (
                  <li
                    key={clause.id}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{clause.title}</p>
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          {clause.clauseType?.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <RiskBadge level={clause.riskLevel} />
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-700">{clause.text}</p>
                    {clause.riskNote ? (
                      <p className="mt-2 text-sm text-amber-800">{clause.riskNote}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      {!analysis && !isInProgress && contract?.status !== 'failed' && !errorMessage ? (
        <p className="text-sm text-slate-500">No analysis results yet.</p>
      ) : null}
    </div>
  )
}
