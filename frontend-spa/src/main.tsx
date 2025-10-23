import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

const KC_BASE = import.meta.env.VITE_KEYCLOAK_BASE_URL || 'http://localhost:8080';
const KC_REALM = import.meta.env.VITE_KEYCLOAK_REALM || 'returnacy';
const CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'frontend-spa';
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || window.location.origin;
const USER_SERVICE_URL = import.meta.env.VITE_USER_SERVICE_URL || 'http://localhost:3004';
const BUSINESS_SERVICE_URL = import.meta.env.VITE_BUSINESS_SERVICE_URL || 'http://localhost:3005';
const BUSINESS_ID = import.meta.env.VITE_BUSINESS_ID || 'biz_seed_1';

function base64UrlEncode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sha256(input: string) {
  const enc = new TextEncoder();
  const data = enc.encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function ScanQRView({ accessToken }: { accessToken: string | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [stampCounter, setStampCounter] = useState<number>(1);

  useEffect(() => {
    const url = new URL(window.location.href);
    const customerId = url.searchParams.get('customer');
    const coupon = url.searchParams.get('coupon');
    if (coupon && !customerId) {
      setError('Coupon flow non implementato in questa SPA di test.');
      return;
    }
    if (!customerId) {
      setError('Parametro customer mancante.');
      return;
    }
    if (!accessToken) {
      setError('Effettua il login per caricare il cliente.');
      return;
    }
    setLoading(true);
    fetch(`${USER_SERVICE_URL}/api/v1/users/${encodeURIComponent(customerId)}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Host: 'localhost' }
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.message || body?.error || r.statusText);
        }
        return r.json();
      })
      .then((data) => {
        setUser(data);
        setError(null);
      })
      .catch((e: any) => setError(e?.message || 'Errore caricamento utente'))
      .finally(() => setLoading(false));
  }, [accessToken]);

  async function applyStamps() {
    if (!user?.id) return;
    if (!accessToken) {
      setError('Effettua il login per applicare timbri.');
      return;
    }
    if (stampCounter === 0) return;
    try {
      // naive loop like legacy adapter; business-service can accept single-stamp posts
      for (let i = 0; i < Math.abs(stampCounter); i++) {
        const body = { userId: String(user.id), businessId: BUSINESS_ID };
        const res = await fetch(`${BUSINESS_SERVICE_URL}/api/v1/stamps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, Host: 'localhost' },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          throw new Error(b?.message || b?.error || res.statusText);
        }
      }
      // Refresh user
      const r = await fetch(`${USER_SERVICE_URL}/api/v1/users/${encodeURIComponent(user.id)}`, {
        headers: { Authorization: `Bearer ${accessToken}`, Host: 'localhost' }
      });
      const updated = await r.json();
      setUser(updated);
      setStampCounter(1);
      setError(null);
      alert('Timbri aggiornati');
    } catch (e: any) {
      setError(e?.message || 'Errore durante l\'aggiunta timbri');
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 640 }}>
      <h1>Scanner QR - Dettaglio Cliente</h1>
      <div style={{ marginBottom: 12 }}>
        <a href="/">← Torna alla home</a>
      </div>
      {loading && <div>Caricamento...</div>}
      {error && <div style={{ color: 'crimson' }}>{error}</div>}
      {user && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
          <div><strong>ID:</strong> {user.id}</div>
          <div><strong>Nome:</strong> {[user.name, user.surname].filter(Boolean).join(' ') || '—'}</div>
          <div><strong>Email:</strong> {user.email || '—'}</div>
          <div><strong>Telefono:</strong> {user.phone || '—'}</div>
          <div><strong>Ruolo (scope):</strong> {user.role || 'USER'}</div>
          <div><strong>Timbri validi:</strong> {user.stamps?.validStamps ?? 0}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <button onClick={() => setStampCounter(v => Math.max(-20, v - 1))}>−</button>
            <div style={{ minWidth: 40, textAlign: 'center' }}>{stampCounter}</div>
            <button onClick={() => setStampCounter(v => Math.min(50, v + 1))}>+</button>
            <button onClick={applyStamps} disabled={!accessToken || stampCounter === 0} style={{ marginLeft: 8 }}>Applica timbri</button>
          </div>
          <div style={{ marginTop: 8 }}>
            <details>
              <summary>Memberships</summary>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(user.memberships || [], null, 2)}</pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}

function CRMView({ accessToken }: { accessToken: string | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      if (!accessToken) {
        setError('Effettua il login per caricare i clienti.');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`${BUSINESS_SERVICE_URL}/api/v1/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, Host: 'localhost' },
          body: JSON.stringify({ page: 1, limit: 50, sortBy: 'name', sortOrder: 'asc', businessId: BUSINESS_ID })
        });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          throw new Error(b?.message || b?.error || res.statusText);
        }
        const data = await res.json();
        const arr = (Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []) as any[];
        setCustomers(arr);
        setError(null);
      } catch (e: any) {
        setError(e?.message || 'Errore caricamento clienti');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [accessToken]);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 800 }}>
      <h1>CRM Clienti</h1>
      <div style={{ marginBottom: 12 }}>
        <a href="/">← Torna alla home</a>
      </div>
      {loading && <div>Caricamento...</div>}
      {error && <div style={{ color: 'crimson' }}>{error}</div>}
      <div style={{ display: 'grid', gap: 8 }}>
        {customers.map((u) => {
          const name = [u?.profile?.name, u?.profile?.surname].filter(Boolean).join(' ') || (u?.email?.split?.('@')[0] ?? 'Utente');
          const stamps = (u?.stamps?.validStamps ?? 0) + (u?.stamps?.usedStamps ?? 0);
          const id = String(u?.id ?? '');
          return (
            <div key={id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{name}</div>
                <div style={{ fontSize: 12, color: '#555' }}>{u?.email || '—'} • Timbri: {stamps}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={`/scan-qr?customer=${encodeURIComponent(id)}`}>
                  <button>Aggiungi Timbri</button>
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [me, setMe] = useState<any>(null);
  const [email, setEmail] = useState('seed1@example.com');
  const [password, setPassword] = useState('SuperSecret1!');
  const [name, setName] = useState('Seed1');
  const [surname, setSurname] = useState('User1');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('1990-01-01');
  const [acceptPrivacyPolicy, setAcceptPrivacyPolicy] = useState(false);
  const [acceptTermsOfService, setAcceptTermsOfService] = useState(false);

  // Handle PKCE callback
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const storedState = sessionStorage.getItem('pkce_state');
    const verifier = sessionStorage.getItem('pkce_verifier');
    if (code && state && storedState && state === storedState && verifier) {
      const tokenUrl = `${KC_BASE}/realms/${KC_REALM}/protocol/openid-connect/token`;
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: verifier,
      });
      fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
        .then(r => r.json())
        .then(data => {
          setAccessToken(data.access_token);
          setRefreshToken(data.refresh_token);
          try {
            const parts = String(data.access_token || '').split('.')
            if (parts.length >= 2) {
              const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
              setEmailVerified(!!payload.email_verified);
            } else {
              setEmailVerified(null);
            }
          } catch {
            setEmailVerified(null);
          }
          // clear query params
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    }
  }, []);

  async function startLogin(idpHint?: string) {
    const authUrl = `${KC_BASE}/realms/${KC_REALM}/protocol/openid-connect/auth`;
    const state = crypto.randomUUID();
    const verifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = await sha256(verifier);
    sessionStorage.setItem('pkce_state', state);
    sessionStorage.setItem('pkce_verifier', verifier);
    const p = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      scope: 'openid profile email offline_access',
      redirect_uri: REDIRECT_URI,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    if (idpHint) {
      p.set('kc_idp_hint', idpHint);
    }
    window.location.href = `${authUrl}?${p.toString()}`;
  }
  // Post-login consent flags
  const [acceptPrivacyPolicyPost, setAcceptPrivacyPolicyPost] = useState(false);
  const [acceptTermsOfServicePost, setAcceptTermsOfServicePost] = useState(false);
  const [acceptMarketingPost, setAcceptMarketingPost] = useState(false);
  const [acceptancesResult, setAcceptancesResult] = useState<string | null>(null);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [authMsg, setAuthMsg] = useState<string | null>(null);

  async function refresh() {
    if (!refreshToken) return;
    const tokenUrl = `${KC_BASE}/realms/${KC_REALM}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    });
    const res = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const data = await res.json();
    setAccessToken(data.access_token);
    setRefreshToken(data.refresh_token);
    try {
      const parts = String(data.access_token || '').split('.')
      if (parts.length >= 2) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        setEmailVerified(!!payload.email_verified);
      } else {
        setEmailVerified(null);
      }
    } catch {
      setEmailVerified(null);
    }
  }

  async function sendVerifyEmail() {
    if (!accessToken) return;
    setAuthMsg(null);
    await fetch(`${USER_SERVICE_URL}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, Host: 'localhost' },
      body: JSON.stringify({ redirectUri: REDIRECT_URI })
    })
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          throw new Error(b?.error || r.statusText);
        }
        setAuthMsg('Verification email sent. Check your inbox.');
      })
      .catch((e: any) => setAuthMsg(e?.message || 'Failed to send verification email'));
  }

  async function forgotPassword() {
    if (!forgotEmail) { setAuthMsg('Enter your email'); return; }
    setAuthMsg(null);
    await fetch(`${USER_SERVICE_URL}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Host: 'localhost' },
      body: JSON.stringify({ email: forgotEmail, redirectUri: REDIRECT_URI })
    })
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          throw new Error(b?.error || r.statusText);
        }
        setAuthMsg('Password reset email sent. Check your inbox.');
      })
      .catch((e: any) => setAuthMsg(e?.message || 'Failed to send password reset'));
  }

  async function doRegister() {
    const payload: any = {
      email,
      password,
      name,
      surname,
      birthday,
      acceptPrivacyPolicy,
      acceptTermsOfService,
    };
    if (phone && phone.trim().length > 0) payload.phone = phone.trim();

    const res = await fetch(`${USER_SERVICE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Host': 'localhost' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    alert(JSON.stringify(data));
  }

  async function saveProfile() {
    if (!accessToken) return;
    const payload: any = { name, surname, birthday };
    if (phone && phone.trim().length > 0) payload.phone = phone.trim();
    const res = await fetch(`${USER_SERVICE_URL}/api/v1/me/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, Host: 'localhost' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      alert('Profile update failed: ' + (data?.error || res.statusText));
      return;
    }
    await loadMe();
    alert('Profile updated');
  }

  async function loadMe() {
    if (!accessToken) return;
    const res = await fetch(`${USER_SERVICE_URL}/api/v1/me`, { headers: { Authorization: `Bearer ${accessToken}`, Host: 'localhost' } });
    const data = await res.json();
    setMe(data);
  }

  async function doAcceptances() {
    if (!accessToken) return;
    const body: any = {};
    if (acceptPrivacyPolicyPost) body.acceptPrivacyPolicy = true;
    if (acceptTermsOfServicePost) body.acceptTermsOfService = true;
    if (acceptMarketingPost) body.acceptMarketing = true;
    if (Object.keys(body).length === 0) return;
    const res = await fetch(`${USER_SERVICE_URL}/api/v1/me/acceptances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, Host: 'localhost' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    setAcceptancesResult(JSON.stringify(data));
  }

  const cleanPath = window.location.pathname.replace(/\/$/, '');
  const isScanQr = cleanPath === '/scan-qr';
  const isCrm = cleanPath === '/crm';

  if (isScanQr) {
    return <ScanQRView accessToken={accessToken} />;
  }
  if (isCrm) {
    return <CRMView accessToken={accessToken} />;
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 640 }}>
      <h1>Returnacy Test SPA</h1>
      <div style={{ marginBottom: 16 }}>
        <a href="/crm">Vai al CRM</a> | <a href="/scan-qr">Vai allo Scanner</a>
      </div>

      <section style={{ marginBottom: 24 }}>
        <h2>Register</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
          <input placeholder="Surname" value={surname} onChange={e => setSurname(e.target.value)} />
          <input placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ width: 120 }}>Birthday</label>
            <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={acceptPrivacyPolicy} onChange={e => setAcceptPrivacyPolicy(e.target.checked)} />
            Accept Privacy Policy
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={acceptTermsOfService} onChange={e => setAcceptTermsOfService(e.target.checked)} />
            Accept Terms of Service
          </label>
          <button onClick={doRegister} disabled={!email || !password || !name || !surname || !birthday || !acceptPrivacyPolicy || !acceptTermsOfService}>Register</button>
          <div>
            <small>Or register with:</small>
            <div style={{ marginTop: 6 }}>
              <button onClick={() => startLogin('google')}>Register with Google</button>
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Login (No Redirect)</h2>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr auto' }}>
          <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button style={{ gridColumn: 'span 2' }} onClick={async () => {
            const res = await fetch(`${USER_SERVICE_URL}/api/v1/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: email, password })
            });
            const data = await res.json();
            if (data.access_token) {
              setAccessToken(data.access_token);
              setRefreshToken(data.refresh_token ?? null);
            } else {
              alert('Login failed: ' + JSON.stringify(data));
            }
          }}>Login</button>
        </div>

        <div style={{ marginTop: 8 }}>
          <small>Or use PKCE redirect:</small>
          <div>
            <button onClick={() => startLogin()}>Login via Keycloak (PKCE)</button>
            <button onClick={() => startLogin('google')} style={{ marginLeft: 8 }}>Continue with Google</button>
          </div>
        </div>
        {accessToken && emailVerified === false && (
          <div style={{ marginTop: 12, padding: 8, background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: 6 }}>
            <div style={{ marginBottom: 6 }}><strong>Email not verified.</strong></div>
            <button onClick={sendVerifyEmail}>Send verification email</button>
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <small>Forgot password?</small>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <input style={{ flex: 1 }} placeholder="Email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} />
            <button onClick={forgotPassword}>Send reset link</button>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Tokens</h2>
        <div>
          <div><strong>Access token:</strong> {accessToken ? `${accessToken.slice(0, 24)}...` : '—'}</div>
          <div><strong>Refresh token:</strong> {refreshToken ? `${refreshToken.slice(0, 24)}...` : '—'}</div>
          <button onClick={refresh} disabled={!refreshToken}>Refresh Token</button>
        </div>
      </section>

      <section>
        <h2>Me</h2>
        <button onClick={loadMe} disabled={!accessToken}>Load /me</button>
        <button onClick={sendVerifyEmail} disabled={!accessToken} style={{ marginLeft: 8 }}>Send verification email</button>
        {authMsg && <div style={{ marginTop: 8, color: '#0a7' }}>{authMsg}</div>}
        <pre>{me ? JSON.stringify(me, null, 2) : '—'}</pre>
      </section>

      {accessToken && (
        <section style={{ marginTop: 24 }}>
          <h2>Complete your profile</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
            <input placeholder="Surname" value={surname} onChange={e => setSurname(e.target.value)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ width: 120 }}>Birthday</label>
              <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} />
            </div>
            <input placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)} />
            <button onClick={saveProfile} disabled={!name || !surname || !birthday}>Save Profile</button>
          </div>
        </section>
      )}

      <section style={{ marginTop: 24 }}>
        <h2>Consent (post-login)</h2>
        <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={acceptPrivacyPolicyPost} onChange={e => setAcceptPrivacyPolicyPost(e.target.checked)} />
            Accept Privacy Policy
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={acceptTermsOfServicePost} onChange={e => setAcceptTermsOfServicePost(e.target.checked)} />
            Accept Terms of Service
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={acceptMarketingPost} onChange={e => setAcceptMarketingPost(e.target.checked)} />
            Accept Marketing
          </label>
          <button onClick={doAcceptances} disabled={!accessToken || (!acceptPrivacyPolicyPost && !acceptTermsOfServicePost && !acceptMarketingPost)}>Save Acceptances</button>
          {acceptancesResult && <pre>{acceptancesResult}</pre>}
        </div>
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
