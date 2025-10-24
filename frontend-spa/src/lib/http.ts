import { tokenService } from './token-service';
import { withTokenRetry } from './retry-middleware';

// Configuration for HTTP client
const CONFIG = {
  API_BASE_URL: (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_USER_SERVICE_URL || '',
  DEFAULT_TIMEOUT: 30000,
};

export interface HttpError extends Error {
  status: number;
  body: any;
  fieldErrors?: Record<string, string>;
}

/**
 * Enhanced HTTP client that handles authentication, retries, and error normalization
 * Based on patterns from api-client.ts but optimized for React usage
 */
export async function httpRequest<T = any>(
  method: string,
  endpoint: string,
  options: {
    body?: any;
    headers?: Record<string, string>;
    credentials?: RequestCredentials;
    timeout?: number;
  } = {}
): Promise<T> {
  const {
    body,
    headers = {},
  credentials = 'omit',
    timeout = CONFIG.DEFAULT_TIMEOUT,
  } = options;

  async function lowLevelFetch(): Promise<{ response: Response; jsonBody: T | null }> {
    const requestHeaders = new Headers(headers);
    
    // Add authorization header if token exists
    const accessToken = tokenService.getAccessToken();
    if (accessToken) {
      requestHeaders.set('Authorization', `Bearer ${accessToken}`);
    }
    
    // Set Content-Type for JSON requests
    if (body && typeof body === 'object') {
      requestHeaders.set('Content-Type', 'application/json');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const url = `${CONFIG.API_BASE_URL}${endpoint}`;
      
      const response = await fetch(url, {
        method: method.toUpperCase(),
        headers: requestHeaders,
        body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
        credentials,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('Content-Type') || '';
      const jsonBody: T | null = contentType.includes('application/json')
        ? await response.json()
        : null;

      // Auto-update tokens if present in response (supports snake_case from Keycloak)
      if (jsonBody && typeof jsonBody === 'object') {
        const b: any = jsonBody;
        const access = b.accessToken ?? b.access_token;
        const refresh = b.refreshToken ?? b.refresh_token;
        if (access) tokenService.setAccessToken(access);
        if (refresh && tokenService.setRefreshToken) tokenService.setRefreshToken(refresh);
      }

      return { response, jsonBody };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  const { response, jsonBody } = await withTokenRetry(lowLevelFetch, endpoint);

  if (!response.ok) {
    const error = new Error(response.statusText) as HttpError;
    error.status = response.status;
    error.body = jsonBody;

    // Normalize validation errors for form handling
    if (jsonBody && typeof jsonBody === 'object') {
      const body = jsonBody as any;
      
      // Handle various backend error formats
      if (body.fieldErrors) {
        error.fieldErrors = body.fieldErrors;
      } else if (body.errors && Array.isArray(body.errors)) {
        // Convert array of errors to field errors
        error.fieldErrors = body.errors.reduce((acc: Record<string, string>, err: any) => {
          if (err.field && err.message) {
            acc[err.field] = err.message;
          }
          return acc;
        }, {});
      }

      // Use detailed error message if available
      if (body.message) {
        error.message = body.message;
      } else if (body.error) {
        error.message = body.error;
      }
    }

    throw error;
  }

  return jsonBody as T;
}

// Convenience methods for common HTTP operations
export const http = {
  get: <T>(endpoint: string, options?: Omit<Parameters<typeof httpRequest>[2], 'body'>) =>
    httpRequest<T>('GET', endpoint, options),
    
  post: <T>(endpoint: string, body?: any, options?: Omit<Parameters<typeof httpRequest>[2], 'body'>) =>
    httpRequest<T>('POST', endpoint, { ...options, body }),
    
  put: <T>(endpoint: string, body?: any, options?: Omit<Parameters<typeof httpRequest>[2], 'body'>) =>
    httpRequest<T>('PUT', endpoint, { ...options, body }),
    
  patch: <T>(endpoint: string, body?: any, options?: Omit<Parameters<typeof httpRequest>[2], 'body'>) =>
    httpRequest<T>('PATCH', endpoint, { ...options, body }),
    
  delete: <T>(endpoint: string, options?: Omit<Parameters<typeof httpRequest>[2], 'body'>) =>
    httpRequest<T>('DELETE', endpoint, options),
};

export default http;