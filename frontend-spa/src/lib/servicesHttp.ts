import { tokenService } from './token-service';
import { withTokenRetry } from './retry-middleware';

type Options = {
  body?: any;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  timeout?: number;
};

function createHttp(baseUrl: string) {
  async function request<T = any>(method: string, endpoint: string, options: Options = {}): Promise<T> {
    const { body, headers = {}, credentials = 'omit', timeout = 30000 } = options;
    async function lowLevelFetch(): Promise<{ response: Response; jsonBody: T | null }> {
      const h = new Headers(headers);
      const access = tokenService.getAccessToken();
      if (access) h.set('Authorization', `Bearer ${access}`);
      if (body && typeof body === 'object') h.set('Content-Type', 'application/json');
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), timeout);
      try {
        const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
        const res = await fetch(url, {
          method: method.toUpperCase(),
          headers: h,
          body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
          credentials,
          signal: ctrl.signal,
        });
        clearTimeout(tid);
        const ct = res.headers.get('Content-Type') || '';
        const jsonBody: T | null = ct.includes('application/json') ? await res.json() : null;
        if (jsonBody && typeof jsonBody === 'object') {
          const b: any = jsonBody;
          const access = b.accessToken ?? b.access_token;
          const refresh = b.refreshToken ?? b.refresh_token;
          if (access) tokenService.setAccessToken(access);
          if (refresh && tokenService.setRefreshToken) tokenService.setRefreshToken(refresh);
        }
        return { response: res, jsonBody };
      } catch (e) {
        clearTimeout(tid);
        throw e;
      }
    }
    const { response, jsonBody } = await withTokenRetry(lowLevelFetch, endpoint);
    if (!response.ok) {
      const err: any = new Error(response.statusText);
      err.status = response.status;
      err.body = jsonBody;
      if (jsonBody && typeof jsonBody === 'object') {
        const b: any = jsonBody;
        if (b.fieldErrors) err.fieldErrors = b.fieldErrors;
        if (b.message) err.message = b.message;
        else if (b.error) err.message = b.error;
      }
      throw err;
    }
    return jsonBody as T;
  }

  return {
    get: <T>(endpoint: string, options?: Omit<Options, 'body'>) => request<T>('GET', endpoint, options),
    post: <T>(endpoint: string, body?: any, options?: Omit<Options, 'body'>) => request<T>('POST', endpoint, { ...options, body }),
    put: <T>(endpoint: string, body?: any, options?: Omit<Options, 'body'>) => request<T>('PUT', endpoint, { ...options, body }),
    patch: <T>(endpoint: string, body?: any, options?: Omit<Options, 'body'>) => request<T>('PATCH', endpoint, { ...options, body }),
    delete: <T>(endpoint: string, options?: Omit<Options, 'body'>) => request<T>('DELETE', endpoint, options),
  };
}

const ENV: any = (import.meta as any).env || {};
const USER_BASE: string = ENV.VITE_USER_SERVICE_URL || ENV.VITE_API_BASE_URL || '';
const BUSINESS_BASE: string = ENV.VITE_BUSINESS_SERVICE_URL || ENV.VITE_API_BASE_URL || '';
const CAMPAIGN_BASE: string = ENV.VITE_CAMPAIGN_SERVICE_URL || ENV.VITE_API_BASE_URL || '';

export const userHttp = createHttp(USER_BASE);
export const businessHttp = createHttp(BUSINESS_BASE);
export const campaignHttp = createHttp(CAMPAIGN_BASE);

export function getBusinessId(): string {
  return ENV.VITE_BUSINESS_ID || 'af941888-ec4c-458e-b905-21673241af3e';
}
