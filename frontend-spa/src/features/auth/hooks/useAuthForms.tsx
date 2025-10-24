import { useState, Dispatch, SetStateAction } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { passwordLoginSchema } from '../../../schema/login/login.schema';
import { passwordSignupSchema, oauthSignupSchema } from '../../../schema/signup/signup.schema';
import { baseSchema } from '../../../schema/signup/base.schema';

export function useLoginForm() {
  const schema = passwordLoginSchema.pick({ email: true, password: true });
  const form = useForm<{ email: string; password: string }>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' }
  });
  return form;
}

// For the form, we don't require authType here; it's injected at submit time based on the selected method.
const passwordSignupFormSchema = z.intersection(baseSchema, passwordSignupSchema.omit({ authType: true }));
export type RegistrationFormValues = z.infer<typeof passwordSignupFormSchema>;

export function useRegisterForm() {
  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(passwordSignupFormSchema),
    defaultValues: { name: '', surname: '', birthdate: '', phone: '', email: '', password: '', acceptedTermsAndConditions: false, acceptedPrivacyPolicy: false }
  });
  return form;
}

export function useAuthMethodToggle() {
  const [loginMethod, setLoginMethod] = useState<'password' | 'google'>(() => (localStorage.getItem('auth.loginMethod') as any) || 'password');
  const [signupMethod, setSignupMethod] = useState<'password' | 'google'>(() => (localStorage.getItem('auth.signupMethod') as any) || 'password');

  const wrap = <T extends 'password' | 'google'>(key: string, setter: Dispatch<SetStateAction<T>>) => (val: SetStateAction<T>) => {
    setter(prev => {
      const next = typeof val === 'function' ? (val as any)(prev) : val;
      localStorage.setItem(key, next);
      return next;
    });
  };

  return { 
    loginMethod, 
    setLoginMethod: wrap('auth.loginMethod', setLoginMethod), 
    signupMethod, 
    setSignupMethod: wrap('auth.signupMethod', setSignupMethod) 
  };
}
