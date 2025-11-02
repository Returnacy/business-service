// @ts-nocheck
import axios, { AxiosInstance } from 'axios';
import type { TokenService } from './tokenService.js';

export type QueryUsersParams = {
  page?: number;
  limit?: number;
  offset?: number;
  search?: string;
  businessId?: string;
  minStamp?: number;
  sortBy?: 'name' | 'stamp' | 'coupon' | 'lastVisit';
  sortOrder?: 'asc' | 'desc';
  filters?: {
    minStamps?: number;
    couponsOnly?: boolean;
    lastVisitDays?: number | null;
  };
};

export type BasicUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  surname?: string | null;
  birthday?: string | null;
};

export class UserServiceClient {
  private http: AxiosInstance;
  private tokenService: TokenService;

  constructor(opts: { baseUrl: string; tokenService: TokenService }) {
    this.http = axios.create({ baseURL: opts.baseUrl.replace(/\/$/, '') });
    this.tokenService = opts.tokenService;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.tokenService.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async queryUsers(params: QueryUsersParams): Promise<BasicUser[]> {
    // If the real user-service is running, call its internal query endpoint with service auth.
    const headers = await this.authHeaders();
    const limit = Math.max(1, Math.min(Math.trunc(params.limit ?? 50), 200));
  const page = Math.max(1, Math.trunc(params.page ?? 1));
  const offsetParam = params.offset;
  const offset = Number.isFinite(offsetParam) ? Math.max(0, Math.trunc(offsetParam as number)) : (page - 1) * limit;
    const payload: Record<string, any> = {
      // For free-text search we rely on the user-service 'search' param (OR across name/email/phone),
      // so we intentionally do NOT include targetingRules here to avoid AND-restricting by email only.
      limit,
      page,
      businessId: params.businessId ?? null,
      search: params.search || undefined,
    };
    if (offset > 0) payload.offset = offset;
  if (params.minStamp !== undefined) payload.minStamp = params.minStamp;
  if (params.sortBy) payload.sortBy = params.sortBy;
  if (params.sortOrder) payload.sortOrder = params.sortOrder;
  if (params.filters) payload.filters = params.filters;
    const res = await this.http.post('/internal/v1/users/query', payload, { headers });
    const users: any[] = res.data?.users ?? [];
    return users.map(u => ({
      id: String(u.id),
      email: u.email ?? null,
      phone: u.phone ?? null,
      name: u.firstName ?? null,
      surname: u.lastName ?? null,
      birthday: u.attributes?.birthday ?? null,
    }));
  }

  async updateMembershipCounters(args: {
    userId: string;
    businessId: string;
    validStamps?: number;
    validCoupons?: number;
    totalStampsDelta?: number;
    totalCouponsDelta?: number;
  }): Promise<void> {
    const headers = await this.authHeaders();
    await this.http.post(
      `/internal/v1/users/${encodeURIComponent(args.userId)}/memberships/counters`,
      {
        businessId: args.businessId,
        validStamps: args.validStamps,
        validCoupons: args.validCoupons,
        totalStampsDelta: args.totalStampsDelta,
        totalCouponsDelta: args.totalCouponsDelta,
      },
      { headers }
    );
  }

  async getWalletPass(userId: string, businessId: string): Promise<{ linked: boolean; objectId: string | null; walletPass?: any } | null> {
    const headers = await this.authHeaders();
    try {
      const res = await this.http.get(
        `/internal/v1/users/${encodeURIComponent(userId)}/memberships/${encodeURIComponent(businessId)}/wallet-pass`,
        { headers }
      );
      return res.data ?? null;
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 404) {
        return { linked: false, objectId: null };
      }
      throw error;
    }
  }

  async upsertWalletPass(userId: string, businessId: string, payload: { objectId?: string | null }): Promise<{ linked: boolean; objectId: string | null; walletPass?: any }> {
    const headers = await this.authHeaders();
    const res = await this.http.post(
      `/internal/v1/users/${encodeURIComponent(userId)}/memberships/${encodeURIComponent(businessId)}/wallet-pass`,
      { objectId: payload.objectId },
      { headers }
    );
    return res.data ?? { linked: true, objectId: payload.objectId ?? null };
  }

  async countUsersByBusiness(businessId: string): Promise<number> {
    const headers = await this.authHeaders();
    const res = await this.http.get(`/internal/v1/users/count`, {
      params: { businessId },
      headers,
    });
    const count = res.data?.count ?? (res as any)?.count;
    return Number.isFinite(count) ? Number(count) : 0;
  }

  async countNewUsersSince(businessId: string, since: Date): Promise<number> {
    const headers = await this.authHeaders();
    const res = await this.http.get(`/internal/v1/users/count-new`, {
      params: { businessId, since: since.toISOString() },
      headers,
    });
    const count = res.data?.count ?? (res as any)?.count;
    return Number.isFinite(count) ? Number(count) : 0;
  }
}
