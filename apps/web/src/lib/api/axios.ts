import axios, { type AxiosError, type AxiosInstance } from 'axios';

const baseURL = '/api';

export const api: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15_000,
});

let refreshInFlight: Promise<void> | null = null;

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)sydt_csrf=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function refresh(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
      .then(() => undefined)
      .catch((err) => {
        throw err;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

api.interceptors.request.use((config) => {
  const method = config.method?.toLowerCase();
  if (method && !['get', 'head', 'options'].includes(method)) {
    const csrf = readCsrfCookie();
    if (csrf) {
      config.headers.set('X-CSRF-Token', csrf);
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const config = err.config as (typeof err.config & { _retry?: boolean }) | undefined;
    const status = err.response?.status;
    if (
      status === 401 &&
      config &&
      !config._retry &&
      !config.url?.includes('/auth/refresh') &&
      !config.url?.includes('/auth/login') &&
      !config.url?.includes('/auth/me')
    ) {
      config._retry = true;
      try {
        await refresh();
        return api.request(config);
      } catch (refreshErr) {
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(err);
  },
);

export function unwrapApiError(err: unknown): { code?: string; message: string } {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: { code?: string; message?: string } } | undefined;
    if (data?.error?.message) {
      return { code: data.error.code, message: data.error.message };
    }
    return { message: err.message };
  }
  if (err instanceof Error) return { message: err.message };
  return { message: 'Unknown error' };
}
