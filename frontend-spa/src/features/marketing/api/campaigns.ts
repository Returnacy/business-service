import { campaignHttp } from '../../../lib/servicesHttp';

// Backend-aligned status values
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export interface CampaignListItem {
  id: string;
  name: string;
  // kept for UI compatibility; not authoritative
  type: string;
  status: CampaignStatus;
  startDate?: string | null;
  endDate?: string | null;
}
export interface CampaignDetailed extends CampaignListItem {
  smsTemplate?: string;
  emailTemplate?: string;
  createdAt: string;
  updatedAt: string;
}

// Helpers to normalize backend payloads into our UI shape
function mapListItem(raw: any): CampaignListItem {
  return {
    id: raw.id,
    name: raw.name,
    type: 'BOTH',
    status: (raw.status || 'DRAFT') as CampaignStatus,
    startDate: raw.startAt ?? null,
    endDate: raw.endAt ?? null,
  };
}

function mapDetailed(raw: any): CampaignDetailed {
  return {
    ...mapListItem(raw),
    smsTemplate: raw?.steps?.[0]?.template?.bodyText || raw.smsTemplate || '',
    emailTemplate: raw?.steps?.[0]?.template?.bodyHtml || raw.emailTemplate || '',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export async function fetchCampaigns(): Promise<CampaignListItem[]> {
  const res = await campaignHttp.get<any>('/api/v1/campaigns');
  const data = (res as any)?.data ?? res;
  return Array.isArray(data) ? data.map(mapListItem) : [];
}

export async function fetchCampaign(id: string): Promise<CampaignDetailed> {
  const res = await campaignHttp.get<any>(`/api/v1/campaigns/${id}`);
  const data = (res as any)?.data ?? res;
  return mapDetailed(data);
}

// Lifecycle management via manage endpoint
export async function manageCampaign(id: string, action: 'start'|'stop'|'pause'|'resume'|'reschedule', payload?: { startAt?: string; endAt?: string }) {
  const body: any = { action };
  if (payload && Object.keys(payload).length) body.payload = payload;
  await campaignHttp.post(`/api/v1/campaigns/${id}`, body);
}

export async function toggleCampaignStatus(id: string, on: boolean) {
  // For dev-friendly reversibility, use pause/resume pair
  return manageCampaign(id, on ? 'resume' : 'pause');
}

export async function updateCampaignSchedule(id: string, schedule?: { start?: string; end?: string }) {
  const payload: any = {};
  if (schedule?.start) payload.startAt = new Date(schedule.start).toISOString();
  if (schedule?.end) payload.endAt = new Date(schedule.end).toISOString();
  return manageCampaign(id, 'reschedule', payload);
}
