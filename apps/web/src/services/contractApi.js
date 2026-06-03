import { apiRequest } from '../lib/apiClient'
import { useAuthStore } from '../store/authStore'

/**
 * @param {Record<string, string | number | undefined>} params
 */
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

export async function listContracts({ page = 1, limit = 20, status, contractType, q } = {}) {
  const { user } = useAuthStore.getState()
  const query = buildQuery({
    page,
    limit,
    tenantId: user?.tenantId,
    status,
    contractType,
    q,
  })

  const response = await apiRequest(`/contracts${query}`)
  return {
    data: response.data,
    pagination: response.pagination,
  }
}

export async function getContract(id) {
  const response = await apiRequest(`/contracts/${id}`)
  return response.data
}

export async function deleteContract(id) {
  await apiRequest(`/contracts/${id}`, { method: 'DELETE' })
}

/**
 * @param {object} metadata
 * @param {File} file
 */
export async function uploadContract(metadata, file) {
  const { user } = useAuthStore.getState()
  const formData = new FormData()

  formData.append('file', file)
  formData.append('title', metadata.title)
  formData.append('counterparty', metadata.counterparty)
  formData.append('contractType', metadata.contractType)
  formData.append('tenantId', user.tenantId)
  formData.append('createdBy', user.userId)

  if (metadata.effectiveDate) {
    formData.append('effectiveDate', metadata.effectiveDate)
  }
  if (metadata.expirationDate) {
    formData.append('expirationDate', metadata.expirationDate)
  }
  if (metadata.tags) {
    formData.append('tags', metadata.tags)
  }

  const response = await apiRequest('/contracts/upload', {
    method: 'POST',
    body: formData,
  })

  return response.data
}
