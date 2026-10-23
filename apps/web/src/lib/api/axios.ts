import axios, { type AxiosError, type AxiosInstance } from 'axios';
import { translateApiMessage } from '@/i18n/api-errors';
import { getCurrentLocale } from '@/i18n/current-locale';

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

function firstFieldError(details: unknown): string | null {
  const d = details as { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> } | undefined;
  if (d?.formErrors?.[0]) return d.formErrors[0];
  for (const msgs of Object.values(d?.fieldErrors ?? {})) {
    if (msgs?.[0]) return msgs[0];
  }
  return null;
}

export function unwrapApiError(err: unknown): { code?: string; message: string; details?: unknown } {
  const locale = getCurrentLocale();
  const tr = (m: string) => translateApiMessage(m, locale);
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { error?: { code?: string; message?: string; details?: unknown } }
      | undefined;
    if (data?.error?.message) {
      let message = tr(data.error.message);
      if (data.error.code === 'VALIDATION') {
        const field = firstFieldError(data.error.details);
        if (field) message = `${message}: ${tr(field)}`;
      }
      return { code: data.error.code, message, details: data.error.details };
    }
    return { message: tr(err.message) };
  }
  if (err instanceof Error) return { message: tr(err.message) };
  return { message: tr('Unknown error') };
}
