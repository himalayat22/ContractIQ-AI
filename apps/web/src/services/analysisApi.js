import { apiRequest } from '../lib/apiClient'

function buildQuery(params) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

export async function getAnalysis(contractId) {
  const response = await apiRequest(`/analysis/contracts/${contractId}`)
  return response.data
}

export async function getAnalysisStatus(contractId) {
  const response = await apiRequest(`/analysis/contracts/${contractId}/status`)
  return response.data
}

export async function listClauses(contractId, { page = 1, limit = 50, clauseType, riskLevel } = {}) {
  const query = buildQuery({ page, limit, clauseType, riskLevel })
  const response = await apiRequest(`/analysis/contracts/${contractId}/clauses${query}`)
  return {
    data: response.data,
    pagination: response.pagination,
  }
}

export async function getKeyObligations(contractId) {
  const response = await apiRequest(`/analysis/contracts/${contractId}/key-obligations`)
  return response.data
}
