function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorStatus(error) {
  return error?.status ?? error?.statusCode ?? error?.cause?.status ?? null;
}

/**
 * @param {unknown} error
 */
export function isRetryableGeminiError(error) {
  const status = getErrorStatus(error);
  if (status === 429 || status === 502 || status === 503 || status === 504) {
    return true;
  }

  const message = String(error?.message ?? '').toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econnreset') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('rate limit') ||
    message.includes('resource exhausted') ||
    message.includes('unavailable')
  );
}

/**
 * @param {() => Promise<T>} fn
 * @param {{ maxRetries?: number, baseDelayMs?: number, shouldRetry?: (error: unknown) => boolean }} [options]
 * @returns {Promise<T>}
 * @template T
 */
export async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    shouldRetry = isRetryableGeminiError,
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error;
      }
      const delayMs = baseDelayMs * 2 ** attempt;
      await sleep(delayMs);
    }
  }

  throw lastError;
}
