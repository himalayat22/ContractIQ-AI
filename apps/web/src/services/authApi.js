import { apiRequest } from '../lib/apiClient'

export async function loginRequest(payload) {
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return response.data
}

export async function registerRequest(payload) {
  const response = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return response.data
}
