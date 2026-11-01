import axios, { InternalAxiosRequestConfig } from 'axios';

// Extend Axios config to track request timing for cold-start detection
interface TimedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _startTime?: number;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  withCredentials: true, // Sends HttpOnly campus_session cookie across sibling subdomains
  timeout: 60000, // 60s timeout for large file uploads & AI extractions
});

let csrfToken: string | null = null;
let coldStartNoticeListener: ((isSlow: boolean) => void) | null = null;

export function setColdStartNoticeListener(listener: (isSlow: boolean) => void) {
  coldStartNoticeListener = listener;
}

export async function refreshCsrfToken(): Promise<string> {
  const resp = await apiClient.get('/api/auth/csrf');
  csrfToken = resp.data.csrf_token;
  return csrfToken!;
}

// Request Interceptor: Attach X-CSRF-Token & track request start time
apiClient.interceptors.request.use(async (config: TimedAxiosRequestConfig) => {
  config._startTime = performance.now();
  const method = config.method?.toUpperCase();
  if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(method || '')) {
    if (!csrfToken) {
      await refreshCsrfToken();
    }
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  } else if (method === 'GET') {
    // Prevent browser stale caching of polling & submissions GET requests
    config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    config.headers['Pragma'] = 'no-cache';
    config.params = { ...config.params, _t: Date.now() };
  }
  return config;
});

// Response Interceptor: Cold-start detection (>2s threshold) and CSRF refresh retry
apiClient.interceptors.response.use(
  (response) => {
    const config = response.config as TimedAxiosRequestConfig;
    if (config._startTime) {
      const elapsed = performance.now() - config._startTime;
      if (elapsed > 2000 && coldStartNoticeListener) {
        coldStartNoticeListener(true);
      }
    }
    return response;
  },
  async (error) => {
    const config = error.config as TimedAxiosRequestConfig | undefined;
    if (config?._startTime) {
      const elapsed = performance.now() - config._startTime;
      if (elapsed > 2000 && coldStartNoticeListener) {
        coldStartNoticeListener(true);
      }
    }

    // CSRF token expiration recovery: refresh once and retry (capped at 1 retry)
    if (
      error.response?.status === 403 && 
      error.response?.data?.detail?.includes('CSRF') && 
      config && 
      !(config as any)._csrfRetried
    ) {
      (config as any)._csrfRetried = true;
      try {
        const freshCsrf = await refreshCsrfToken();
        config.headers['X-CSRF-Token'] = freshCsrf;
        return apiClient.request(config);
      } catch (refreshErr) {
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);
