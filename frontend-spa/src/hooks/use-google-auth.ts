import { useCallback, useRef, useState } from 'react';

declare global {
  interface Window { google?: any; }
}

let googleScriptPromise: Promise<void> | null = null;
function loadGoogleScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window unavailable'));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-identity]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Google script failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google script failed to load'));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

interface SignInOptions {
  oneTap?: boolean;              // try One Tap / FedCM
  promptParentElementId?: string; // where to render the Google button (recommended: a visible div)
  timeoutMs?: number;            // timeout for interactive flow; defaults to 120s
}

export function useGoogleAuth(clientId: string | undefined) {
  const [loading, setLoading] = useState(false);        // interactive-only loading
  const [error, setError] = useState<Error | null>(null);
  const enableOneTap = ((import.meta as any).env?.VITE_GOOGLE_ONE_TAP ?? 'false') === 'true';

  const inflight = useRef<Promise<string> | null>(null);
  const oneTapTried = useRef(false);
  const cleanupFns = useRef<Array<() => void>>([]);
  const initializedRef = useRef(false);
  const latestCredentialRef = useRef<string | null>(null);
  const pendingResolversRef = useRef<Array<(token: string) => void>>([]);
  const credentialListenersRef = useRef<Array<(token: string) => void>>([]);

  const cleanup = () => {
    cleanupFns.current.forEach((fn: () => void) => { try { fn(); } catch {} });
    cleanupFns.current = [];
  };

  const ensureInitialized = async () => {
    if (initializedRef.current) return;
    if (!clientId) throw new Error('Google Client ID non configurato');
    await loadGoogleScript();
    const googleAny: any = (window as any).google;
    if (!googleAny?.accounts?.id) throw new Error('Google Identity Services non disponibile');
    googleAny.accounts.id.initialize({
      client_id: clientId,
      callback: (resp: any) => {
        if (resp?.credential) {
          latestCredentialRef.current = resp.credential;
          // Flush any waiting resolvers
          pendingResolversRef.current.forEach((r: (token: string) => void) => {
            try { r(resp.credential); } catch {}
          });
          pendingResolversRef.current = [];
          // Notify external listeners (auto-login handlers, etc.)
          credentialListenersRef.current.forEach((fn: (token: string) => void) => {
            try { fn(resp.credential); } catch {}
          });
        }
      },
      ux_mode: 'popup',
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
    });
    initializedRef.current = true;
  };

  // Prepare button immediately without awaiting credential
  const prepare = useCallback(async (containerId: string, opts: { oneTap?: boolean } = {}) => {
    if (!clientId) return;
    try {
      await ensureInitialized();
      const googleAny: any = (window as any).google;
      const container = document.getElementById(containerId);
      if (container && !container.hasChildNodes()) {
        try {
          googleAny.accounts.id.renderButton(container, {
            theme: 'outline', size: 'large', type: 'standard', shape: 'rectangular',
          });
        } catch {}
      }
      if (opts.oneTap && enableOneTap && !oneTapTried.current) {
        oneTapTried.current = true;
        try { googleAny.accounts.id.prompt(); } catch {}
      }
    } catch (e) {
      // silent: preparation should not surface errors in UI
      // eslint-disable-next-line no-console
      if ((import.meta as any).env?.DEV) console.debug('[GoogleAuth][prepare] ignorato', e);
    }
  }, [clientId, enableOneTap]);

  const signIn = useCallback(async (opts: SignInOptions = {}): Promise<string> => {
    if (!clientId) {
      console.error('Google Client ID non configurato: assicurati di definire VITE_GOOGLE_CLIENT_ID');
      throw new Error('Google Client ID non configurato');
    }

    // De-dupe
    if (inflight.current) return inflight.current;

    // Fast path: credential already captured (e.g., user clicked button before calling signIn)
    if (latestCredentialRef.current) {
      const token = latestCredentialRef.current;
      latestCredentialRef.current = null; // consume
      return token;
    }

    // Only set loading for interactive (non-One Tap) flow
  const isOneTap = !!opts.oneTap && enableOneTap;
    const timeoutMs = opts.timeoutMs ?? 120_000;
    if (!isOneTap) setLoading(true);
    setError(null);

    inflight.current = (async () => {
  await ensureInitialized();
  const googleAny: any = (window as any).google;

      // Promise wrapper
      const idToken = await new Promise<string>((resolve, reject) => {
        // Single resolver gate (must be inside executor to access resolve/reject)
        let resolved = false;
        const resolveOnce = (token: string) => {
          if (resolved) return;
          resolved = true;
          cleanup();
          resolve(token);
        };
        const rejectOnce = (err: Error) => {
          if (resolved) return;
            resolved = true;
            cleanup();
            reject(err);
        };
        // Create (optional) button container
        let createdContainer: HTMLDivElement | null = null;
        const getOrCreateContainer = (): HTMLElement => {
          if (opts.promptParentElementId) {
            const c = document.getElementById(opts.promptParentElementId);
            if (c) return c;
          }
          // Fallback: create a hidden container (works, but prefer a visible one)
          createdContainer = document.createElement('div');
          createdContainer.style.position = 'fixed';
          createdContainer.style.top = '-9999px';
          document.body.appendChild(createdContainer);
          cleanupFns.current.push(() => {
            if (createdContainer && createdContainer.parentElement) {
              createdContainer.parentElement.removeChild(createdContainer);
            }
          });
          return createdContainer;
        };

  // If credential happens before we attach resolvers, handle via pending list
  // Add pending resolver to be flushed by global callback
  pendingResolversRef.current.push(resolveOnce);

        // Helper: render the Google button (no prompt() here!)
        const renderButton = () => {
          const container = getOrCreateContainer();
          try {
            googleAny.accounts.id.renderButton(container, {
              theme: 'outline',
              size: 'large',
              type: 'standard',
              shape: 'rectangular',
            });
          } catch (e) {
            // If render fails, surface an actionable error
            rejectOnce(new Error('Impossibile renderizzare il bottone Google'));
          }
        };

        // One Tap moment handler (FedCM)
        const handleMoment = (notification: any) => {
          if (resolved) return;

          const dismissedReason = notification.getDismissedReason?.();
          const skippedReason = notification.getSkippedReason?.();
          const notDisplayedReason = notification.getNotDisplayedReason?.();
          const reason = dismissedReason || skippedReason || notDisplayedReason;

          // Benign fallback conditions: no account in the browser, nothing to show, etc.
          const fallbackReasons = new Set([
            'no_suitable_account',
            'accounts_list_empty',
            'opt_out_or_no_session',
            'not_displayed',
            'skipped',
            'undefined',
          ]);

          // User actively dismissed the UI
          const dismissReasons = new Set([
            'user_cancel',
            'tap_outside',
            'suppressed_by_user',
          ]);

          if (reason && fallbackReasons.has(reason)) {
            // IMPORTANT: DO NOT call prompt() again. Just render the button and wait.
            renderButton();
            return;
          }

          if (reason && dismissReasons.has(reason)) {
            rejectOnce(Object.assign(new Error(`ONE_TAP_DISMISSED:${reason}`), { silent: true } as any));
          }
        };

        // Flow selection
  if (isOneTap) {
          // Fire-and-forget One Tap (no loading spinner)
          if (!oneTapTried.current) {
            oneTapTried.current = true;
            try {
              googleAny.accounts.id.prompt(handleMoment);
            } catch {
              // If prompt throws (e.g., blocked), fallback to button
              renderButton();
            }
          } else {
            // Already tried One Tap → just ensure a button exists
            renderButton();
          }

          // We DO NOT auto-timeout One Tap; it silently waits for either:
          // - a credential callback, or
          // - the user to click the rendered button (popup)
          // If you want a timeout here, you can add one, but it's often better UX not to.
        } else {
          // Interactive path: make sure there's a visible button the user can click
          renderButton();

          // Add a timeout so your UI isn't stuck forever if user abandons
          const to = window.setTimeout(() => {
            if (!resolved) {
              rejectOnce(new Error('Timeout autenticazione Google'));
            }
          }, timeoutMs);
          cleanupFns.current.push(() => window.clearTimeout(to));
        }
      });

      return idToken;
    })();

    try {
      const token = await inflight.current;
      return token;
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
    if (!isOneTap) setLoading(false);
      inflight.current = null;
    }
  }, [clientId]);

  const addCredentialListener = useCallback((fn: (token: string) => void) => {
    credentialListenersRef.current.push(fn);
    return () => {
      credentialListenersRef.current = credentialListenersRef.current.filter((f: (t: string) => void) => f !== fn);
    };
  }, []);

  return { signIn, prepare, addCredentialListener, loading, error };
}
