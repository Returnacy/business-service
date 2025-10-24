import { LoginInput } from '../../../schema/login/login.schema';
import { SignupInput } from '../../../schema/signup/signup.schema';
import { userHttp } from '../../../lib/servicesHttp';

export async function passwordLogin(email: string, password: string) {
  const payload = { username: email, password };
  return userHttp.post<any>('/api/v1/auth/login', payload as any);
}

export async function googleLogin(idToken: string) {
  throw new Error('OAuth login is not implemented in local/dev flow');
}

export async function passwordRegister(data: { name: string; surname: string; birthdate: string; phone?: string; email: string; password: string; acceptedTermsAndConditions: boolean; acceptedPrivacyPolicy: boolean; }) {
  const payload = {
    email: data.email,
    password: data.password,
    name: data.name,
    surname: data.surname,
    birthday: data.birthdate,
    phone: data.phone,
    acceptTermsOfService: data.acceptedTermsAndConditions,
    acceptPrivacyPolicy: data.acceptedPrivacyPolicy,
    acceptMarketing: false,
  };
  return userHttp.post<any>('/api/v1/auth/register', payload as any);
}

export async function googleRegister(idToken: string, data: { name: string; surname: string; birthdate: string; phone?: string; acceptedTermsAndConditions: boolean; acceptedPrivacyPolicy: boolean; }) {
  // Not implemented in user-service; keep stubbed for future
  throw new Error('OAuth signup is not implemented in this environment');
}
