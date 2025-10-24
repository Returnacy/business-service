import { withTokenRetry } from './retry-middleware';
import { tokenService } from './token-service';

export type HttpRequestOptions = {
  body?: any;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  timeout?: number;
};

export type HttpClient = {
  get: <T>(endpoint: string, options?: Omit<Parameters<typeof httpRequest>[2], 'body'>) => Promise<T>;
  post: <T>(endpoint: string, body?: any, options?: Omit<Parameters<typeof httpRequest>[2], 'body'>) => Promise<T>;
  put: <T>(endpoint: string, body?: any, options?: Omit<Parameters<typeof httpRequest>[2], 'body'>) => Promise<T>;
  patch: <T>(endpoint: string, body?: any, options?: Omit<Parameters<typeof httpRequest>[2], 'body'>) => Promise<T>;
  delete: <T>(endpoint: string, options?: Omit<Parameters<typeof httpRequest>[2], 'body'>) => Promise<T>;
};

export async function httpRequest<T = any>(
  method: string,
  baseUrl: string,
  endpoint: string,
  options: HttpRequestOptions = {}
): Promise<T> {
  const {
    body,
    headers = {},
    credentials = 'include',
    timeout = 30000,
  } = options;

  async function lowLevelFetch(): Promise<{ response: Response; jsonBody: T | null }> {
    const requestHeaders = new Headers(headers);
    const accessToken = tokenService.getAccessToken();
    if (accessToken) requestHeaders.set('Authorization', `Bearer ${accessToken}`);
    if (body && typeof body === 'object') requestHeaders.set('Content-Type', 'application/json');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
      const response = await fetch(url, {
        method: method.toUpperCase(),
        headers: requestHeaders,
        body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
        credentials,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const contentType = response.headers.get('Content-Type') || '';
      const jsonBody: T | null = contentType.includes('application/json') ? await response.json() : null;
      if (jsonBody && typeof jsonBody === 'object' && 'accessToken' in (jsonBody as any)) {
        tokenService.setAccessToken((jsonBody as any).accessToken);
      }
      return { response, jsonBody };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  const { response, jsonBody } = await withTokenRetry(lowLevelFetch, endpoint);
  if (!response.ok) {
    const err: any = new Error(response.statusText);
    err.status = response.status;
    err.body = jsonBody;
    if (jsonBody && typeof jsonBody === 'object') {
      const body: any = jsonBody;
      if (body.fieldErrors) err.fieldErrors = body.fieldErrors;
      if (body.message) err.message = body.message;
      else if (body.error) err.message = body.error;
    }
    throw err;
  }
  return jsonBody as T;
}

export function createHttp(baseUrl: string): HttpClient {
  return {
    get: <T>(endpoint: string, options?: HttpRequestOptions) =>
      httpRequest<T>('GET', baseUrl, endpoint, options),
    post: <T>(endpoint: string, body?: any, options?: HttpRequestOptions) =>
      httpRequest<T>('POST', baseUrl, endpoint, { ...options, body }),
    put: <T>(endpoint: string, body?: any, options?: HttpRequestOptions) =>
      httpRequest<T>('PUT', baseUrl, endpoint, { ...options, body }),
    patch: <T>(endpoint: string, body?: any, options?: HttpRequestOptions) =>
      httpRequest<T>('PATCH', baseUrl, endpoint, { ...options, body }),
    delete: <T>(endpoint: string, options?: HttpRequestOptions) =>
      httpRequest<T>('DELETE', baseUrl, endpoint, options),
  };
}
