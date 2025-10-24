import { getBusinessId } from './servicesHttp';
import type { ClientType } from '../types/client';

// Define the roles your app recognizes in ascending order of privilege
export type Role = 'user' | 'staff' | 'manager' | 'admin' | string;
const ROLE_ORDER: Role[] = ['user', 'staff', 'manager', 'admin'];

export type TenantContext = { businessId?: string | null; brandId?: string | null };

export function getTenantContext(): TenantContext {
  const businessId = getBusinessId();
  const brandId = (import.meta as any).env?.VITE_BRAND_ID || null;
  return { businessId, brandId };
}

function normalize(v?: string | null): string {
  return (v || '').toString().trim().toLowerCase();
}

function roleRank(role: Role): number {
  const idx = ROLE_ORDER.indexOf(normalize(role) as Role);
  return idx >= 0 ? idx : 0; // unknown roles treated as lowest
}

export function getRolesForContext(user: ClientType | null | undefined, ctx?: TenantContext): Role[] {
  if (!user || !Array.isArray((user as any).memberships)) return [];
  const { businessId, brandId } = ctx || getTenantContext();
  const bid = normalize(businessId || null);
  const brd = normalize(brandId || null);

  const roles: Role[] = [];
  for (const m of (user as any).memberships as any[]) {
    const mBid = normalize(m.businessId);
    const mBrd = normalize(m.brandId);
    const matchesBusiness = !!bid && mBid === bid;
    const matchesBrandOnly = !bid && !!brd && mBrd === brd;
    if (matchesBusiness || matchesBrandOnly) {
      if (m.role) roles.push((m.role as string).toLowerCase());
      if (Array.isArray(m.roles)) roles.push(...m.roles.map((r: string) => r.toLowerCase()));
    }
  }
  const unique = Array.from(new Set(roles));
  // Fallback: if no contextual roles found, use top-level user.role if present
  if (unique.length === 0) {
    if ((user as any)?.role) {
      return [normalize((user as any).role) as Role];
    }
    // Dev-friendly fallback: if tenant filter yields no roles, aggregate across all memberships
    const all: string[] = [];
    for (const m of (user as any).memberships || []) {
      if (m.role) all.push(String(m.role).toLowerCase());
      if (Array.isArray(m.roles)) all.push(...m.roles.map((r: string) => r.toLowerCase()));
    }
    if (all.length) return Array.from(new Set(all)) as Role[];
  }
  return unique;
}

export function getHighestRole(user: ClientType | null | undefined, ctx?: TenantContext): Role | null {
  const roles = getRolesForContext(user, ctx);
  if (roles.length === 0) return null;
  return roles.reduce((best, r) => (roleRank(r) > roleRank(best)) ? r : best, roles[0]);
}

export function hasAnyRole(user: ClientType | null | undefined, required: Role[] | undefined, ctx?: TenantContext): boolean {
  if (!required || required.length === 0) return true; // no restriction
  const userRoles = getRolesForContext(user, ctx);
  if (userRoles.length === 0) return false;
  const normalizedRequired = required.map(r => normalize(r));
  return userRoles.some(r => normalizedRequired.includes(normalize(r)) || roleRank(r) >= Math.max(...normalizedRequired.map(roleRank)));
}

// Simple policy gate: resource/action → minimum role
type Policy = Record<string, { [action: string]: Role }>; // e.g., { 'campaigns': { 'create': 'manager', 'publish': 'admin' } }

export function makeAuthorizer(policy: Policy) {
  return {
    can(user: ClientType | null | undefined, resource: string, action: string, ctx?: TenantContext): boolean {
      const minRole = policy[resource]?.[action];
      if (!minRole) return true; // no rule → allow
      const highest = getHighestRole(user, ctx);
      if (!highest) return false;
      return roleRank(highest) >= roleRank(minRole);
    }
  };
}
