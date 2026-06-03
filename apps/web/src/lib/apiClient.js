import { useAuthStore } from '../store/authStore'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1'

export function getAuthHeaders() {
  const { tokens, user } = useAuthStore.getState()
  const headers = {}

  if (tokens?.accessToken) {
    headers.Authorization = `Bearer ${tokens.accessToken}`
  }

  if (user?.tenantId) {
    headers['X-Tenant-ID'] = user.tenantId
  }

  return headers
}

export async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData
  const headers = {
    ...getAuthHeaders(),
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers ?? {}),
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 204) {
    if (!response.ok) {
      throw new Error('Request failed')
    }
    return null
  }

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    const message = body?.error?.message ?? 'Request failed'
    throw new Error(message)
  }

  return body
}
