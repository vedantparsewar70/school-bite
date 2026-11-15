/**
 * fetch with a time limit, for staff phones on slow connections: a request that hangs is aborted
 * and reported as a network error instead of leaving a button spinning forever.
 */
export async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { cache: 'no-store', ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
