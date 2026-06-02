const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1'

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    const message = body?.error?.message ?? 'Request failed'
    throw new Error(message)
  }

  return body
}
