// React-compatible token service adapted from the root token-service.ts
let refreshPromise: Promise<string> | null = null;

// Cross-tab coordination
const CHANNEL_NAME = 'auth-channel';
const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
const REFRESH_LOCK_KEY = 'refreshLock';
const TAB_ID_KEY = 'tabId';
// Prefer direct user-service URL for auth flows; fall back to generic API base only if needed
const ENV: any = (import.meta as any).env || {};
const USER_SERVICE_URL: string = ENV.VITE_USER_SERVICE_URL || ENV.VITE_API_BASE_URL || '';

function getTabId(): string {
  let id = sessionStorage.getItem(TAB_ID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2);
    sessionStorage.setItem(TAB_ID_KEY, id);
  }
  return id;
}

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

async function waitForRefreshed(timeoutMs = 5000): Promise<string | null> {
  if (!channel) return null;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      const data = event.data || {};
      if (data.type === 'auth:refreshed') {
        cleanup();
        resolve(data.accessToken || null);
      }
      if (data.type === 'auth:logout') {
        cleanup();
        reject(new Error('Logged out'));
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      channel?.removeEventListener('message', onMessage as any);
    };

    channel.addEventListener('message', onMessage as any);
  });
}

function tryAcquireLock(): boolean {
  const now = Date.now();
  const owner = getTabId();
  try {
    const existingRaw = localStorage.getItem(REFRESH_LOCK_KEY);
    if (existingRaw) {
      const existing = JSON.parse(existingRaw) as { owner: string; expires: number };
      if (existing.expires > now && existing.owner !== owner) {
        return false; // another tab holds a valid lock
      }
    }
  } catch {}
  const lock = JSON.stringify({ owner, expires: now + 5000 }); // 5s lock
  localStorage.setItem(REFRESH_LOCK_KEY, lock);
  // Validate we own it
  try {
    const validate = JSON.parse(localStorage.getItem(REFRESH_LOCK_KEY) || '{}');
    return validate.owner === owner;
  } catch {
    return false;
  }
}

function releaseLock() {
  try { localStorage.removeItem(REFRESH_LOCK_KEY); } catch {}
}

// Public auth-related routes where redirect should not fire
const AUTH_PUBLIC_PATHS = [
  '/auth',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/password-resets',
  '/verify-email',
];

function redirectToAuthIfNeeded() {
  if (AUTH_PUBLIC_PATHS.includes(location.pathname)) return; // already on an auth page
  if (location.pathname !== '/auth') {
    location.href = '/auth';
  }
}

function handleLogout() {
  try { localStorage.removeItem('accessToken'); } catch {}
  try { localStorage.removeItem('refreshToken'); } catch {}
  channel?.postMessage({ type: 'auth:logout' });
  redirectToAuthIfNeeded();
}

export const tokenService = {
  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  },

  setAccessToken(token: string): void {
    localStorage.setItem('accessToken', token);
  },

  clearAccessToken(): void {
    localStorage.removeItem('accessToken');
  },

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  },

  setRefreshToken(token: string): void {
    localStorage.setItem('refreshToken', token);
  },

  clearRefreshToken(): void {
    localStorage.removeItem('refreshToken');
  },

  async refresh(): Promise<string> {
    if (refreshPromise) return refreshPromise;

    // If another tab is refreshing, wait for it
    const lockHeld = !tryAcquireLock();
    if (lockHeld) {
      const tokenFromOther = await waitForRefreshed(5000);
      if (tokenFromOther) {
        this.setAccessToken(tokenFromOther);
        return tokenFromOther;
      }
      // If waiting timed out, proceed to refresh ourselves
      if (!tryAcquireLock()) {
        // Still can't acquire, last fallback small wait
        await sleep(200);
      }
    }

    const doRefresh = async (): Promise<string> => {
      // Ensure we hit the correct user-service origin using JSON body with refresh token
      const base = USER_SERVICE_URL.replace(/\/$/, '');
      const refreshUrl = `${base}/api/v1/auth/refresh`;
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        handleLogout();
        throw Object.assign(new Error('Missing refresh token'), { status: 401 });
      }
      const res = await fetch(refreshUrl, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      // Try to read error body once per call
      let body: any = null;
      if (!res.ok) {
        try { body = await res.json(); } catch {}
        // If there's no refresh cookie, redirect only if not already on an auth route
        if (res.status === 401 && body?.error === 'MISSING_REFRESH_TOKEN') {
          handleLogout();
        }
        const err = new Error('Refresh failed');
        (err as any).status = res.status;
        (err as any).body = body;
        throw err;
      }

      const payload: any = await res.json();
      const access = payload.accessToken || payload.access_token;
      const refresh = payload.refreshToken || payload.refresh_token;
      if (!access) throw Object.assign(new Error('Invalid refresh response: missing access token'), { status: 500 });
      this.setAccessToken(access);
      if (refresh) this.setRefreshToken(refresh);
      channel?.postMessage({ type: 'auth:refreshed', accessToken: access });
      return access;
    };

    refreshPromise = (async () => {
      try {
        try {
          return await doRefresh();
        } catch (e: any) {
          // One-time retry for concurrency where old cookie was still sent
          const code = e?.status;
          const apiError = e?.body?.error;
          if (code === 401 && (apiError === 'REVOKED_REFRESH_TOKEN' || apiError === 'EXPIRED_REFRESH_TOKEN' || apiError === 'INVALID_REFRESH_TOKEN' || apiError === 'JWT_VERIFICATION_FAILED' || apiError === 'TOKEN_VERIFICATION_FAILED')) {
            await sleep(250);
            return await doRefresh();
          }
          throw e;
        }
      } catch (e) {
  // Any failure reaching here => ensure redirect only if needed
  handleLogout();
        throw e;
      } finally {
        releaseLock();
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }
};

// Lightweight JWT base64url decoder (no signature verification) to extract payload claims
function decodeJwt(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const g: any = (typeof globalThis !== 'undefined') ? globalThis : {};
    const json = typeof window !== 'undefined'
      ? atob(payload)
      : (g.Buffer ? g.Buffer.from(payload, 'base64').toString('utf8') : '');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getJwtRoleClaim(): string | null {
  const token = tokenService.getAccessToken();
  if (!token) return null;
  const payload = decodeJwt(token);
  if (!payload) return null;
  // Common claim keys for role
  return payload.role || payload.roles?.[0] || payload.claims?.role || null;
}