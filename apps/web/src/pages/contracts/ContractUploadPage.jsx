import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { uploadContract } from '../../services/contractApi'

const CONTRACT_TYPES = [
  { value: 'nda', label: 'NDA' },
  { value: 'msa', label: 'MSA' },
  { value: 'sow', label: 'SOW' },
  { value: 'employment', label: 'Employment' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'other', label: 'Other' },
]

export function ContractUploadPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [contractType, setContractType] = useState('msa')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [tags, setTags] = useState('')
  const [file, setFile] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!file) {
      setErrorMessage('Please select a PDF file')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const contract = await uploadContract(
        {
          title,
          counterparty,
          contractType,
          effectiveDate: effectiveDate || undefined,
          expirationDate: expirationDate || undefined,
          tags: tags || undefined,
        },
        file,
      )
      navigate(`/app/contracts/${contract.id}`)
    } catch (error) {
      setErrorMessage(error.message || 'Upload failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link to="/app/contracts" className="text-sm text-blue-600 hover:underline">
          ← Back to contracts
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">Upload contract</h2>
        <p className="mt-1 text-sm text-slate-600">
          Upload a PDF to start AI analysis. Processing begins automatically after upload.
        </p>
      </div>

      <form
        className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        onSubmit={handleSubmit}
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Vendor MSA - Acme Corp"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="counterparty">
            Counterparty
          </label>
          <input
            id="counterparty"
            type="text"
            value={counterparty}
            onChange={(event) => setCounterparty(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Acme Corp"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="contractType">
            Contract type
          </label>
          <select
            id="contractType"
            value={contractType}
            onChange={(event) => setContractType(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            {CONTRACT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="effectiveDate">
              Effective date
            </label>
            <input
              id="effectiveDate"
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="expirationDate">
              Expiration date
            </label>
            <input
              id="expirationDate"
              type="date"
              value={expirationDate}
              onChange={(event) => setExpirationDate(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="tags">
            Tags
          </label>
          <input
            id="tags"
            type="text"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="vendor, 2026"
          />
          <p className="mt-1 text-xs text-slate-500">Comma-separated</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="file">
            PDF file
          </label>
          <input
            id="file"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            required
          />
        </div>

        {errorMessage ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Uploading…' : 'Upload & analyze'}
        </button>
      </form>
    </div>
  )
}
