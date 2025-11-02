/**
 * Legacy API Adapter
 * 
 * This adapter provides a bridge between the existing React UI code and the new Fastify backend.
 * It maintains the same function signatures and return shapes that the UI expects while internally
 * calling the new endpoint structure.
 * 
 * Endpoint Mapping:
 * OLD -> NEW
 * /login -> /auth/login
 * /user -> /me 
 * /users -> /users (create) or /users/:userId (get)
 * /logout -> /auth/logout
 * /forgot-password -> /api/v1/auth/forgot-password
 * /verify-email -> /api/v1/auth/verify-email
 * /reset-password -> legacy Keycloak action-link flow
 * /crm/customers -> /users + transform
 * /users/:id/stamps -> /users/:userId/stamps
 * /users/:id/coupons -> /campaigns or /coupon-redemptions
 * /staff/* -> /users (staff creation)
 */

import { http, HttpError } from './http';
import { userHttp, businessHttp, campaignHttp, getBusinessId } from './servicesHttp';
import { tokenService } from './token-service';
import { type LoginInput } from '../schema/login/login.schema';
import { type SignupInput } from '../schema/signup/signup.schema';
import type { ClientType } from '../types/client.d.ts';
import { CouponType } from '../types/coupon';
import { getHighestRole, getTenantContext } from './authz';

// Legacy types that the UI expects
export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  stamps: number;
  last_seen?: string;
  qr_code?: string;
  created_at?: string;
}

// Using canonical discriminated union auth input types (LoginInput / SignupInput)
// defined in src/schema/... to avoid duplication & drift.

export interface StampData {
  stamps: number;
}

export interface Coupon {
  id: number;
  user_id: number;
  qr_code: string;
  is_redeemed: boolean;
  created_at: string;
  redeemed_at?: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  password: string;
}

/**
 * Authentication functions
 */
export async function login(credentials: LoginInput): Promise<any> {
  try {
    const payload = credentials.authType === 'password'
      ? {
          authType: 'password',
          email: credentials.email.toLowerCase(),
          username: credentials.email.toLowerCase(),
          password: credentials.password,
        }
      : {
          authType: 'oauth',
          provider: credentials.provider,
          idToken: credentials.idToken,
          email: credentials.email ? credentials.email.toLowerCase() : undefined,
        };

    await userHttp.post<any>('/api/v1/auth/login', payload);

    const me = await userHttp.get<any>('/api/v1/me');
    const userPayload = me?.data ?? me;
    try {
      const hr = getHighestRole(userPayload, getTenantContext());
      if (hr) (userPayload as any).role = hr;
    } catch {}
    return userPayload;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function logout(): Promise<void> {
  try {
    const refreshToken = tokenService.getRefreshToken();
    if (refreshToken) {
      await userHttp.post('/api/v1/auth/logout', { refreshToken });
    }
  } catch (error) {
    // swallow errors to allow local logout regardless
  } finally {
    tokenService.clearAccessToken();
    tokenService.clearRefreshToken?.();
  }
}

export async function registerUser(userData: SignupInput): Promise<any> {
  try {
    const birthday = (userData as any).birthdate ?? (userData as any).birthday;
    const emailLower = typeof (userData as any).email === 'string'
      ? (userData as any).email.toLowerCase()
      : undefined;
    const basePayload: any = {
      name: (userData as any).name,
      surname: (userData as any).surname,
      birthday,
      acceptTermsOfService: !!(userData as any).acceptedTermsAndConditions,
      acceptPrivacyPolicy: !!(userData as any).acceptedPrivacyPolicy,
      acceptMarketing: !!((userData as any).acceptedMarketingPolicy ?? false),
    };
    if ((userData as any).phone) basePayload.phone = (userData as any).phone;

    const registerPayload = userData.authType === 'password'
      ? {
          ...basePayload,
          authType: 'password',
          email: emailLower,
          password: (userData as any).password,
        }
      : {
          ...basePayload,
          authType: 'oauth',
          provider: userData.provider,
          idToken: userData.idToken,
          email: emailLower,
        };

    await userHttp.post<any>('/api/v1/auth/register', registerPayload);

    if (userData.authType === 'password') {
      await userHttp.post<any>('/api/v1/auth/login', {
        authType: 'password',
        email: emailLower,
        username: emailLower,
        password: (userData as any).password,
      });
    } else if (!tokenService.getAccessToken()) {
      await userHttp.post<any>('/api/v1/auth/login', {
        authType: 'oauth',
        provider: userData.provider,
        idToken: userData.idToken,
        email: emailLower,
      });
    }
    const me = await userHttp.get<any>('/api/v1/me');
    const userPayload = me?.data ?? me;
    try {
      const hr = getHighestRole(userPayload, getTenantContext());
      if (hr) (userPayload as any).role = hr;
    } catch {}
    return userPayload;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getCurrentUser(): Promise<ClientType | null> {
  try {
  const response = await userHttp.get<any>('/api/v1/me');
  const userPayload = (response?.data ?? response) as any;
  try {
    const hr = getHighestRole(userPayload, getTenantContext());
    if (hr) userPayload.role = hr;
  } catch {}
  return userPayload as ClientType;
  } catch (error) {
    if ((error as HttpError).status === 401) {
      return null;
    }
    throw normalizeError(error);
  }
}

/**
 * Unified client profile fetch (extended shape including coupons & stamps)
 * Temporary: assumes backend /me now returns extended ClientType; adjust endpoint if different.
 */
export async function getClientProfile(): Promise<ClientType> {
  try {
  const data = await userHttp.get<any>('/api/v1/me');
  const userPayload = (data?.data ?? data) as any;
  try {
    const hr = getHighestRole(userPayload, getTenantContext());
    if (hr) userPayload.role = hr;
  } catch {}
  return userPayload as ClientType;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function createGoogleWalletPass(options: { businessId?: string; qrCode?: string } = {}): Promise<{ saveUrl: string; jwt: string; objectId: string; classId: string; expiresAt: string; }> {
  try {
    const businessId = options.businessId || getBusinessId();
    if (!businessId) {
      throw new Error('businessId is required to generate Google Wallet pass');
    }
    const body: Record<string, unknown> = { businessId };
    if (options.qrCode) body.qrCode = options.qrCode;
    const response = await businessHttp.post<any>('/api/v1/wallet/google', body);
    return (response?.data ?? response) as { saveUrl: string; jwt: string; objectId: string; classId: string; expiresAt: string; };
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getGoogleWalletStatus(options: { businessId?: string } = {}): Promise<{ linked: boolean; objectId: string | null }> {
  try {
    const businessId = options.businessId || getBusinessId();
    if (!businessId) {
      throw new Error('businessId is required to query Google Wallet status');
    }
    const response = await businessHttp.get<any>(`/api/v1/wallet/google?businessId=${encodeURIComponent(businessId)}`);
    const payload = (response?.data ?? response) as { linked?: boolean; objectId?: string | null };
    return {
      linked: !!payload?.linked,
      objectId: typeof payload?.objectId === 'string' ? payload.objectId : null,
    };
  } catch (error) {
    // Treat 404/403 as not linked for UI purposes
    if ((error as any)?.status === 403 || (error as any)?.status === 404) {
      return { linked: false, objectId: null };
    }
    throw normalizeError(error);
  }
}

/**
 * Accept latest terms and privacy on behalf of the current authenticated user
 * Optional payload supports marketingSubscription flag (ignored if not provided)
 */
export async function acceptUserAgreement(options?: { acceptPrivacyPolicy?: boolean; acceptTermsOfService?: boolean; acceptMarketingPolicy?: boolean; marketingSubscription?: boolean }): Promise<{ message: string }> {
  try {
    const payload: any = {};
    if (options?.acceptPrivacyPolicy !== undefined) payload.acceptPrivacyPolicy = options.acceptPrivacyPolicy;
    if (options?.acceptTermsOfService !== undefined) payload.acceptTermsOfService = options.acceptTermsOfService;
    if (options?.acceptMarketingPolicy !== undefined) payload.acceptMarketing = options.acceptMarketingPolicy;
    return await userHttp.post('/api/v1/me/acceptances', payload);
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function forgotPassword(data: ForgotPasswordData): Promise<{ message: string }> {
  try {
    const payload = {
      ...data,
      email: typeof data.email === 'string' ? data.email.trim().toLowerCase() : data.email,
    };
    const response = await userHttp.post<{ ok?: boolean; message?: string }>('/api/v1/auth/forgot-password', payload);
    if (response && typeof response === 'object') {
      if (typeof (response as any).message === 'string' && (response as any).message.length > 0) {
        return { message: (response as any).message };
      }
      if ((response as any).ok) {
        return { message: 'ok' };
      }
    }
    return { message: 'ok' };
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function resetPassword(data: ResetPasswordData): Promise<{ message: string }> {
  try {
    return await http.post('/auth/password-resets/confirm', data);
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * User management functions
 */
export async function createUser(userData: SignupInput): Promise<User> {
  try {
    const response = await http.post<User>('/users', userData);
    return normalizeUser(response);
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getUser(userId: string | number): Promise<ClientType> {
  try {
    // Call user-service canonical endpoint
    const response = await userHttp.get<ClientType>(`/api/v1/users/${encodeURIComponent(String(userId))}`);
    return (response as any)?.data ?? response;
  } catch (error) {
    throw normalizeError(error);
  }
}

// Prize progression helper: given current stamps, compute last/next thresholds for this business
export async function getPrizeProgression(stamps: number): Promise<{ stampsLastPrize: number; stampsNextPrize: number; lastPrizeName?: string; nextPrizeName?: string; }>
{
  try {
    const businessId = getBusinessId();
    const res = await businessHttp.post<any>('/api/v1/prizes/progression', { businessId, stamps: Math.max(0, Math.floor(Number(stamps) || 0)) });
    const data = (res as any)?.data ?? res;
    return {
      stampsLastPrize: Number(data.stampsLastPrize ?? 0) || 0,
      stampsNextPrize: Number(data.stampsNextPrize ?? 15) || 15,
      lastPrizeName: data.lastPrizeName,
      nextPrizeName: data.nextPrizeName,
    };
  } catch (error) {
    // Fallback to 15-cycle if backend unavailable
    const s = Math.max(0, Math.floor(Number(stamps) || 0));
    const base = 15;
    const last = Math.floor(s / base) * base;
    return { stampsLastPrize: last, stampsNextPrize: last + base };
  }
}

// Users listing with server-side sorting/filtering (POST /users)
export interface ListCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  sortField?: 'name' | 'stamps' | 'coupons' | 'lastVisit';
  sortDirection?: 'asc' | 'desc';
  filters?: {
    minStamps?: number;
    couponsOnly?: boolean;
    lastVisitDays?: number | null;
  };
}

export async function listCustomers(params: ListCustomersParams = {}): Promise<ClientType[]> {
  try {
    // Map frontend sort fields to backend expected values
    const sortByMap: Record<string, string> = {
      name: 'name',
      stamps: 'stamp',
      coupons: 'coupon',
      lastVisit: 'lastVisit'
    };

    const body: any = {
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      search: params.search || undefined,
      sortBy: sortByMap[params.sortField || 'name'],
      sortOrder: params.sortDirection || 'asc',
    };

    const filter: any = {};
    if (params.filters) {
      if (params.filters.minStamps && params.filters.minStamps > 0) {
        filter.minStamp = params.filters.minStamps;
      }
      if (params.filters.couponsOnly) {
        filter.hasCoupon = true;
      }
      if (params.filters.lastVisitDays && params.filters.lastVisitDays > 0) {
        filter.hasVisited = params.filters.lastVisitDays;
      }
    }
    if (Object.keys(filter).length) body.filter = filter;

    const businessId = getBusinessId();
    const response = await businessHttp.post<any>('/api/v1/users', { ...body, businessId });
    // business-service returns { message, data }
  const rows = ((response as any)?.data ?? (response as any)?.data?.data ?? response) as any[];
    // Normalize into ClientType[] so CRM can read coupons/stamps consistently
    const list: ClientType[] = (rows || []).map((r: any) => ({
      id: String(r.id),
      email: r.email ?? null,
      phone: r.phone ?? null,
      role: 'USER',
      isVerified: true,
      lastVisit: r.lastVisit ? new Date(r.lastVisit) : null,
      profile: (r.name || r.surname || r.birthday) ? {
        name: r.name ?? '',
        surname: r.surname ?? '',
        birthdate: r.birthday ? new Date(r.birthday) : null,
      } : null,
      userAgreement: { privacyPolicy: false, termsOfService: false, marketingPolicy: false },
      coupons: {
        validCoupons: Math.max(0, Number(r.couponsCount ?? r.stats?.validCoupons ?? 0) || 0),
        usedCoupons: Math.max(0, (Number(r.totalCoupons ?? 0) || 0) - (Number(r.couponsCount ?? r.stats?.validCoupons ?? 0) || 0)),
      },
      stamps: {
        validStamps: Number(r.validStamps ?? r.stats?.validStamps ?? 0) || 0,
        usedStamps: Math.max(0, (Number(r.totalStamps ?? r.stats?.totalStamps ?? 0) || 0) - (Number(r.validStamps ?? r.stats?.validStamps ?? 0) || 0)),
        totalStamps: Number(r.totalStamps ?? r.stats?.totalStamps ?? r.validStamps ?? r.stats?.validStamps ?? 0) || 0,
      } as any,
      nextPrize: {
        name: r.nextPrizeName || 'Prossimo premio',
        stampsLastPrize: Number(r.stampsLastPrize ?? 0) || 0,
        stampsNextPrize: Number(r.stampsNextPrize ?? 15) || 15,
        get stampsNeededForNextPrize() { return Math.max(1, (this.stampsNextPrize - this.stampsLastPrize)); },
      } as any,
    }));
    return list;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function deleteCustomer(userId: number): Promise<void> {
  try {
    await http.delete(`/users/${userId}`);
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * Loyalty and stamps functions
 */
export async function addStamps(userId: string | number, stamps: number): Promise<ClientType> {
  try {
    const businessId = getBusinessId();
    const count = Math.max(1, Math.floor(Number(stamps) || 1));
    const uid = String(userId ?? '').trim();
    if (!uid || uid === 'undefined' || uid === 'null' || uid === 'NaN') {
      throw new Error('User ID non valido per aggiungere timbri');
    }
    await businessHttp.post<any>(`/api/v1/stamps/apply`, { userId: uid, businessId, stamps: count });
    // Refresh user from user-service to reflect updated counters
    return getUser(uid);
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getUserStamps(userId: number): Promise<{ stamps: number }> {
  try {
    const businessId = getBusinessId();
    const res = await businessHttp.get<{ count: number }>(`/api/v1/stamps/count?userId=${encodeURIComponent(String(userId))}&businessId=${encodeURIComponent(businessId)}`);
    const payload = (res as any)?.data ?? res;
    return { stamps: (payload?.count ?? 0) as number };
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * Coupon management functions
 */
export async function getUserCoupons(userId: number | string): Promise<CouponType[] | null> {
  try {
    const businessId = getBusinessId();
    const res = await businessHttp.get<any>(`/api/v1/coupons?userId=${encodeURIComponent(String(userId))}&businessId=${encodeURIComponent(businessId)}`);
    const payload = (res as any)?.coupons ?? (res as any)?.data?.coupons ?? [];
    const mapped = Array.isArray(payload)
      ? payload.map((c: any) => ({
          id: c.id ?? undefined,
          createdAt: new Date(c.createdAt ?? c.created_at ?? Date.now()),
          code: c.code ?? String(c.id ?? ''),
          qrCode: c.qrCode ?? c.code ?? String(c.id ?? ''),
          url: c.url ?? c.qrCode ?? '',
          isRedeemed: !!(c.isRedeemed ?? c.is_redeemed),
          redeemedAt: c.redeemedAt ? new Date(c.redeemedAt) : c.redeemed_at ? new Date(c.redeemed_at) : null,
          expiredAt: c.expiredAt ? new Date(c.expiredAt) : c.expired_at ? new Date(c.expired_at) : null,
          prize: c.prize ? { name: c.prize.name, pointsRequired: c.prize.pointsRequired } : undefined,
        }))
      : [];
    return mapped;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getCouponByCode(code: string): Promise<CouponType | null> {
  try {
    if (!code || !code.trim()) return null;
    const businessId = getBusinessId();
    const res = await businessHttp.get<any>(`/api/v1/coupons?code=${encodeURIComponent(code)}&businessId=${encodeURIComponent(businessId)}`);
    const payload = (res as any)?.coupons ?? (res as any)?.data?.coupons ?? [];
    const coupon = Array.isArray(payload) ? payload[0] : null;
    if (!coupon) return null;
    return {
      id: coupon.id ?? undefined,
      createdAt: new Date(coupon.createdAt ?? coupon.created_at ?? Date.now()),
      code: coupon.code ?? String(coupon.id ?? ''),
      qrCode: coupon.qrCode ?? coupon.code ?? String(coupon.id ?? ''),
      url: coupon.url ?? coupon.qrCode ?? '',
      isRedeemed: !!(coupon.isRedeemed ?? coupon.is_redeemed),
      redeemedAt: coupon.redeemedAt ? new Date(coupon.redeemedAt) : coupon.redeemed_at ? new Date(coupon.redeemed_at) : null,
      expiredAt: coupon.expiredAt ? new Date(coupon.expiredAt) : coupon.expired_at ? new Date(coupon.expired_at) : null,
      prize: coupon.prize ? { name: coupon.prize.name, pointsRequired: coupon.prize.pointsRequired } : undefined,
    } satisfies CouponType;
  } catch (error: any) {
    if (error?.status === 404) {
      return null;
    }
    throw normalizeError(error);
  }
}

export async function redeemCoupon(couponId: string | number): Promise<{ success: boolean }> {
  try {
    await businessHttp.patch(`/api/v1/coupons/${encodeURIComponent(String(couponId))}/redeem`, {});
    return { success: true };
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * QR Code lookup functions
 */
export async function lookupUserByQR(qrCode: string): Promise<User> {
  try {
    const response = await http.get<User>(`/users/qr/${qrCode}`);
    return normalizeUser(response);
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function lookupCouponByQR(qrCode: string): Promise<Coupon> {
  try {
    const response = await http.get<Coupon>(`/coupons/qr/${qrCode}`);
    return normalizeCoupon(response);
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * Analytics functions (these might need backend implementation)
 */
export async function getAnalyticsOverview(): Promise<any> {
  try {
    return await http.get('/analytics');
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getTrafficSources(): Promise<any[]> {
  try {
    return await http.get('/analytics/traffic-sources');
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getNPSDistribution(): Promise<any[]> {
  try {
    return await http.get('/analytics/nps-distribution');
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getFeedback(): Promise<any[]> {
  try {
    return await http.get('/feedback');
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getCustomerRepeatRate(): Promise<any> {
  try {
    return await http.get('/kpi/customer-repeat-rate');
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getCustomerFrequency(): Promise<any> {
  try {
    return await http.get('/kpi/customer-frequency');
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getDailyStamps(days: number): Promise<any[]> {
  try {
    return await http.get(`/kpi/daily-stamps?days=${days}`);
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getEconomicMetrics(days: number): Promise<any> {
  try {
    return await http.get(`/kpi/economic-metrics?days=${days}`);
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * Data normalization functions
 * These ensure that the data from the new backend matches what the UI expects
 */
function normalizeUser(user: any): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role || user.role_name || 'user',
    stamps: user.stamps || 0,
    last_seen: user.last_seen || user.lastSeen,
    qr_code: user.qr_code || user.qrCode,
    created_at: user.created_at || user.createdAt,
  };
}

function normalizeCoupon(coupon: any): Coupon {
  return {
    id: coupon.id,
    user_id: coupon.user_id || coupon.userId,
    qr_code: coupon.qr_code || coupon.qrCode,
    is_redeemed: coupon.is_redeemed || coupon.isRedeemed || false,
    created_at: coupon.created_at || coupon.createdAt,
    redeemed_at: coupon.redeemed_at || coupon.redeemedAt,
  };
}

function normalizeError(error: any): Error {
  if (error instanceof Error) {
    return error;
  }
  
  const normalizedError = new Error(error.message || 'An error occurred') as HttpError;
  normalizedError.status = error.status || 500;
  normalizedError.body = error.body;
  normalizedError.fieldErrors = error.fieldErrors;
  
  return normalizedError;
}

// Export all functions for easy importing
export const legacyApi = {
  // Auth
  login,
  logout,
  registerUser,
  getCurrentUser,
  getClientProfile,
  acceptUserAgreement,
  forgotPassword,
  resetPassword,
  createGoogleWalletPass,
  getGoogleClientId: () => (globalThis as any).ENV?.VITE_GOOGLE_CLIENT_ID || (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID,
  
  // Users
  createUser,
  getUser,
  listCustomers,
  deleteCustomer,
  
  // Stamps
  addStamps,
  getUserStamps,
  
  // Coupons
  getUserCoupons,
  getCouponByCode,
  redeemCoupon,
  
  // QR Lookup
  lookupUserByQR,
  lookupCouponByQR,

  
  // Analytics
  getAnalyticsOverview,
  getTrafficSources,
  getNPSDistribution,
  getFeedback,
  getCustomerRepeatRate,
  getCustomerFrequency,
  getDailyStamps,
  getEconomicMetrics,
};

export default legacyApi;