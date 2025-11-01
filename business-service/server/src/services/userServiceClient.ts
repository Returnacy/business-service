// @ts-nocheck
import axios, { AxiosInstance } from 'axios';
import type { TokenService } from './tokenService.js';

export type QueryUsersParams = {
  page?: number;
  limit?: number;
  search?: string;
  businessId?: string;
  minStamp?: number;
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
    const res = await this.http.post('/internal/v1/users/query', {
      targetingRules: params.search ? [{ database: 'USER', field: 'email', operator: 'CONTAINS', value: params.search }] : [],
      limit: params.limit ?? 50,
      businessId: params.businessId ?? null,
    }, { headers });
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
}
