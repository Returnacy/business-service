import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { type LoginInput } from '../schema/login/login.schema';
import { type SignupInput } from '../schema/signup/signup.schema';
import { useAuth } from '../hooks/use-auth';
// Google signup now uses official GIS button; login flow remains unchanged for now
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Pizza, Users, Star, TrendingUp } from 'lucide-react';
import { useLoginForm, useRegisterForm, useAuthMethodToggle, RegistrationFormValues } from '../features/auth/hooks/useAuthForms';
import { LoginForm } from '../features/auth/components/LoginForm';
import { RegisterForm } from '../features/auth/components/RegisterForm';
import { useToast } from '../hooks/use-toast';

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, loginMutation, registerMutation } = useAuth();
  const { toast } = useToast();

  // Method toggles now managed via custom hook (removed local duplicates)

  const googleClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || (import.meta as any).env?.GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    // One-time debug to help diagnose missing env variable in deployment
    // eslint-disable-next-line no-console
    console.warn('Google Client ID not found in env (VITE_GOOGLE_CLIENT_ID).');
  }
  const googleEnabled = Boolean(googleClientId);
  // State for GIS and active tab
  const [gisReady, setGisReady] = useState(false);
  const [activeTab, setActiveTab] = useState('login' as 'login' | 'register');

  const loginForm = useLoginForm();
  const registerForm = useRegisterForm();
  const { loginMethod, setLoginMethod, signupMethod, setSignupMethod } = useAuthMethodToggle();

  const decodeJwtPayload = (credential: string): Record<string, any> | null => {
    try {
      const parts = credential.split('.');
      if (parts.length < 2) return null;
      const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padLength = (4 - (normalized.length % 4)) % 4;
      const padded = normalized + '='.repeat(padLength);
      const decoded = atob(padded);
      return JSON.parse(decoded);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Failed to decode Google credential', err);
      return null;
    }
  };

  // If Google isn't configured for this origin, force password flows to avoid disabled register button
  useEffect(() => {
    if (!googleEnabled) {
      setLoginMethod('password');
      setSignupMethod('password');
    }
  }, [googleEnabled, setLoginMethod, setSignupMethod]);

  // Ensure login shows password fields (no toggle UI for login)
  useEffect(() => {
    setLoginMethod('password');
  }, [setLoginMethod]);

  // Load GIS script once and render the official button for the active tab only
  useEffect(() => {
    if (!googleEnabled) return;
    const appendScript = () => new Promise<void>((resolve) => {
      if ((window as any).google?.accounts?.id) return resolve();
      const existing = document.getElementById('google-identity-services');
      if (existing) return existing.addEventListener('load', () => resolve());
      const s = document.createElement('script');
      s.id = 'google-identity-services';
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      document.head.appendChild(s);
    });
    const render = async () => {
      await appendScript();
      const ga = (window as any).google?.accounts?.id;
      if (!ga) return;

      // Clear both containers to avoid duplicate rendering and missing-parent errors
      const loginContainer = document.getElementById('google-login-btn');
      const signupContainer = document.getElementById('google-signup-btn');
      if (loginContainer) loginContainer.innerHTML = '';
      if (signupContainer) signupContainer.innerHTML = '';

      const containerId = activeTab === 'register' ? 'google-signup-btn' : 'google-login-btn';
      const container = document.getElementById(containerId);
      if (!container) return;

      const callback = async (response: any) => {
        const token = response?.credential as string | undefined;
        if (!token) return;

        const profile = decodeJwtPayload(token);
        const googleEmail = typeof profile?.email === 'string' ? profile.email.toLowerCase() : undefined;

        if (googleEmail) {
          registerForm.setValue('email', googleEmail, { shouldDirty: true, shouldValidate: true });
          loginForm.setValue('email', googleEmail, { shouldDirty: true });
        }

        const currentRegisterValues = registerForm.getValues();
        if (profile?.given_name && !(currentRegisterValues.name?.trim())) {
          registerForm.setValue('name', profile.given_name, { shouldDirty: true });
        }
        if (profile?.family_name && !(currentRegisterValues.surname?.trim())) {
          registerForm.setValue('surname', profile.family_name, { shouldDirty: true });
        }

        if (activeTab === 'register') {
          const base = registerForm.getValues();
          const emailInput = (base?.email || googleEmail || '').trim().toLowerCase();
          const ok = Boolean(
            emailInput &&
            base?.acceptedTermsAndConditions &&
            base?.acceptedPrivacyPolicy &&
            base?.name && base.name.trim().length >= 2 &&
            base?.surname && base.surname.trim().length >= 2 &&
            base?.birthdate && /^\d{4}-\d{2}-\d{2}$/.test(base.birthdate)
          );
          if (!ok) {
            toast({
              title: 'Completa i campi richiesti',
              description: 'Compila nome, cognome, email, data di nascita e accetta termini e privacy prima di continuare con Google.',
              variant: 'destructive',
            });
            return;
          }

          const payload: SignupInput = {
            authType: 'oauth',
            provider: 'google',
            idToken: token,
            email: emailInput,
            name: base.name.trim(),
            surname: base.surname.trim(),
            birthdate: base.birthdate,
            acceptedTermsAndConditions: base.acceptedTermsAndConditions,
            acceptedPrivacyPolicy: base.acceptedPrivacyPolicy,
            phone: base.phone ? (String(base.phone).trim() || undefined) : undefined,
          };

          try {
            await registerMutation.mutateAsync(payload);
            setLocation('/');
          } catch {}
        } else {
          const loginValues = loginForm.getValues();
          const loginEmail = googleEmail || loginValues.email || undefined;
          const payload: LoginInput = {
            authType: 'oauth',
            provider: 'google',
            idToken: token,
            email: loginEmail,
          };
          try {
            await loginMutation.mutateAsync(payload);
            setLocation('/');
          } catch {}
        }
      };

      ga.initialize({ client_id: googleClientId, callback, ux_mode: 'popup' });
      ga.renderButton(container, {
        theme: 'outline', size: 'large', type: 'standard', text: activeTab === 'register' ? 'signup_with' : 'signin_with', width: 320,
      });
      setGisReady(true);
    };

    render();
  }, [googleEnabled, googleClientId, activeTab, registerForm, loginMutation, registerMutation, setLocation, toast]);

  const onPasswordLogin = async (data: { email: string; password: string }) => {
    const payload: LoginInput = { authType: 'password', email: data.email, password: data.password } as const;
    await loginMutation.mutateAsync(payload);
    setLocation('/');
  };

  const onRegister = async (data: RegistrationFormValues) => {
    // Password signup only; Google is handled by GIS button callback
    if (!data.acceptedTermsAndConditions || !data.acceptedPrivacyPolicy) return;
    if (signupMethod === 'password') {
      const payload: SignupInput = {
        authType: 'password', email: data.email, password: data.password,
        name: data.name, surname: data.surname, birthdate: data.birthdate,
        acceptedTermsAndConditions: data.acceptedTermsAndConditions,
        acceptedPrivacyPolicy: data.acceptedPrivacyPolicy,
        phone: data.phone || undefined,
      } as const;
      await registerMutation.mutateAsync(payload);
      setTimeout(() => setLocation('/'), 400);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-center">
        {/* Hero Section - Hidden on mobile, visible on desktop */}
        <div className="hidden lg:block space-y-8 text-left">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Pizza className="h-8 w-8 text-brand-blue" />
              <h1 className="text-3xl font-bold text-gray-900">
                Che Pizza da Salva
              </h1>
            </div>
            <h2 className="text-5xl font-bold text-gray-900 leading-tight">
              Il tuo sistema di
              <span className="text-brand-blue"> fedeltà digitale</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl">
              Accumula punti ad ogni visita, ricevi coupon gratuiti e aiutaci a
              migliorare il nostro servizio con il tuo feedback.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-lg">
              <Users className="h-8 w-8 text-green-500 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">
                Facile da usare
              </h3>
              <p className="text-sm text-gray-600">
                Registrati con email o telefono
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-lg">
              <Star className="h-8 w-8 text-yellow-500 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">
                Premi fedeltà
              </h3>
              <p className="text-sm text-gray-600">18 punti = pizza gratuita</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-lg">
              <TrendingUp className="h-8 w-8 text-blue-500 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">
                Il tuo feedback
              </h3>
              <p className="text-sm text-gray-600">
                Aiutaci a migliorare sempre
              </p>
            </div>
          </div>
        </div>

        {/* Authentication Forms */}
        <div className="w-full max-w-sm mx-auto lg:max-w-md">
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-6">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Pizza className="h-6 w-6 text-brand-blue" />
              <h1 className="text-xl font-bold text-gray-900">
                Che Pizza da Salva
              </h1>
            </div>
            <p className="text-sm text-gray-600">Sistema di fedeltà digitale</p>
          </div>

          <Card className="shadow-lg border-0">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl lg:text-2xl font-bold text-center">
                Benvenuto
              </CardTitle>
              <CardDescription className="text-center text-sm">
                Accedi al tuo account o registrati per iniziare
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <Tabs value={activeTab} onValueChange={(v: 'login' | 'register') => setActiveTab(v)} className="w-full">
                <TabsList className="grid w-full grid-cols-2 relative bg-gray-100 p-1 rounded-lg h-9">
                  <TabsTrigger
                    value="login"
                    className="relative z-10 data-[state=active]:bg-[#27496D] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200 bg-white text-gray-600 text-sm"
                  >
                    Accedi
                  </TabsTrigger>
                  <TabsTrigger
                    value="register"
                    className="relative z-10 data-[state=active]:bg-[#27496D] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200 bg-white text-gray-600 text-sm"
                  >
                    Registrati
                  </TabsTrigger>
                </TabsList>

                {/* Login Tab */}
                <TabsContent value="login" className="space-y-3 mt-4">
                  <LoginForm
                    form={loginForm}
                    onSubmit={onPasswordLogin}
                    loginMethod={loginMethod}
                    toggleMethod={() => {}}
                    onGoogle={() => { /* Google login disabled for now */ }}
                    loading={loginMutation.isPending}
                    googleLoading={!gisReady}
                    googleError={null}
                    googleEnabled={googleEnabled}
                  />
                  <div className="mt-1 text-right">
                    <Link href="/auth/forgot-password" className="text-sm text-blue-700 hover:underline">
                      Password dimenticata?
                    </Link>
                  </div>
                  <div className="mt-2"><div id="google-login-btn" className="flex justify-center" /></div>
                </TabsContent>

                {/* Register Tab */}
                <TabsContent value="register" className="space-y-3 mt-4">
                  <RegisterForm
                    form={registerForm}
                    onSubmit={onRegister}
                    signupMethod={signupMethod}
                    loading={registerMutation.isPending}
                    googleError={null}
                  />
                  <div className="mt-2"><div id="google-signup-btn" className="flex justify-center" /></div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  // Handle redirect after hooks are called
  if (user) {
    setLocation("/");
    return null;
  }
}
