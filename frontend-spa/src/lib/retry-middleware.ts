import { tokenService } from './token-service';

export async function withTokenRetry<T>(requestFn: () => Promise<{ response: Response; jsonBody: T | null }>, endpoint?: string): Promise<{ response: Response; jsonBody: T | null }> {
  const first = await requestFn();

  const jsonErr = first.jsonBody as any;
  const isInvalidToken = first.response.status === 401 || (jsonErr && jsonErr.error === 'INVALID_ACCESS_TOKEN');

  if (!isInvalidToken) return first;
  // Avoid refresh attempts on auth endpoints (login/register/logout/refresh)
  if (endpoint && /\/api\/(v\d+\/)?auth\//.test(endpoint)) return first;

  try {
    await tokenService.refresh();
  } catch (e) {
    return first; // propagate original failure; tokenService will redirect if needed
  }
  return await requestFn();
}