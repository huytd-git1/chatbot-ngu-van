function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export async function ensureCsrfToken(): Promise<string> {
  let token = getCookie('csrf_token');
  if (!token) {
    try {
      const res = await fetch('/api/csrf-token', { credentials: 'include' });
      const data = await res.json();
      token = data.csrfToken || getCookie('csrf_token') || '';
    } catch {
      token = '';
    }
  }
  return token || '';
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  // Add CSRF token for mutating requests
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = await ensureCsrfToken();
    if (csrfToken) {
      headers.set('x-csrf-token', csrfToken);
    }
  }

  // If body is not FormData, set Content-Type to application/json
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMsg =
      data && typeof data === 'object' && (data.error || data.message)
        ? data.error || data.message
        : response.statusText || 'Lỗi kết nối máy chủ.';
    const err = new Error(errorMsg) as any;
    err.status = response.status;
    err.code = data?.code;
    err.data = data;
    throw err;
  }

  return data as T;
}
