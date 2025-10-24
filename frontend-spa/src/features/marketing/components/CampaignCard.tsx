import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Collapsible, CollapsibleContent } from '../../../components/ui/collapsible';
import { Mail, MessageSquare, Eye, Loader2, Play } from 'lucide-react';
import { format } from 'date-fns';
import { CampaignListItem, CampaignDetailed } from '../api/campaigns';
import React, { useState } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { authorizer } from '../../../lib/policy';
import { getTenantContext } from '../../../lib/authz';

// Accept unused rest props so React 'key' passthrough doesn't conflict with TS stricter inference
function ChannelBadge({ channel, ..._rest }: { channel: 'email'|'sms'; [k: string]: any }) {
  const icon = channel === 'email' ? <Mail className="w-4 h-4 text-blue-600" /> : <MessageSquare className="w-4 h-4 text-green-600" />;
  return <div className="flex items-center space-x-1 px-2 py-1 bg-white rounded-full border">{icon}<span className="text-xs font-medium capitalize">{channel}</span></div>;
}

// removed colored status pills per new requirements

export interface FormValues { enabled: boolean; startDate: string; endDate: string; }

export interface CampaignCardProps {
  campaign: CampaignListItem;
  details?: CampaignDetailed;
  loadingDetails: boolean;
  onLoadDetails: (id: string) => void;
  formValue?: FormValues;
  onFormChange: (id: string, next: Partial<FormValues>) => void;
  launching: boolean;
  onUpdateSchedule: (id: string, schedule?: { start?: string; end?: string }) => void;
  onToggle: (id: string, nextOn: boolean) => void;
  // Allow React's intrinsic key without TS complaining when spreading
  [extra: string]: any;
}

export function CampaignCard({ campaign: c, details, loadingDetails, onLoadDetails, formValue, onFormChange, launching, onUpdateSchedule, onToggle }: CampaignCardProps) {
  const { user } = useAuth();
  const ctx = getTenantContext();
  const [open, setOpen] = useState(false);
  const channels = deriveChannels(details || c);

  const toggleOpen = () => {
    setOpen((o: boolean) => !o);
    if (!details && !loadingDetails) onLoadDetails(c.id);
  };

  const [toggling, setToggling] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDraft = c.status === 'DRAFT';
  const isOn = c.status === 'ACTIVE';

  const handleToggle = async () => {
    if (isDraft) return;
    setToggling(true);
    try {
      await onToggle(c.id, !isOn);
    } finally {
      setToggling(false);
    }
  };

  const handleSaveSchedule = async (e: any) => {
    if (e && e.preventDefault) e.preventDefault();
    setSaving(true);
    try {
      await onUpdateSchedule(c.id, { start: formValue?.startDate || undefined, end: formValue?.endDate || undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
  <Card className={`transition-all duration-200 ${c.status==='ACTIVE' ? 'bg-white border-2 border-green-200 shadow-lg':'bg-gray-50 border border-gray-200 shadow-sm'}`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg mb-1 truncate">{c.name}</CardTitle>
            {c.type !== 'BOTH' && <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">{c.type}</p>}
            <div className="flex flex-wrap items-center gap-2">
              {c.startDate && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Start {format(new Date(c.startDate), 'dd/MM')}</span>}
              {c.endDate && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">End {format(new Date(c.endDate), 'dd/MM')}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500">{isOn ? 'ON' : 'OFF'}</span>
              <button
                type="button"
                onClick={handleToggle}
                disabled={isDraft || toggling}
                className={`inline-flex items-center ${isDraft ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                aria-pressed={isOn}
                aria-disabled={isDraft}
                title={isDraft ? 'Bozza: abilita dopo configurazione' : (isOn ? 'Disattiva' : 'Attiva')}
              >
                <span className={`w-10 h-5 flex items-center px-0.5 rounded-full transition-colors ${isOn ? 'bg-green-300' : 'bg-gray-300 opacity-80'}`}>
                  <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${isOn ? 'translate-x-5' : ''}`}></span>
                </span>
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 mt-3">
          <span className="text-xs font-medium text-gray-500">Canali:</span>
          {channels.map(ch => (
            <ChannelBadge channel={ch} key={ch} />
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Collapsible open={open}>
          <CollapsibleContent className="mt-1 space-y-4">
            {loadingDetails && <div className="p-4 text-center text-gray-500"><Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />Caricamento dettagli...</div>}
            {!loadingDetails && details && <Templates details={details} />}
            {!loadingDetails && authorizer.can(user as any, 'campaigns', 'update', ctx) && (
              <ScheduleForm formValue={formValue} onChange={(next)=> onFormChange(c.id, next)} onSubmit={handleSaveSchedule} launching={saving} />
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
      <div className="px-4 pb-4">
        <Button variant="outline" size="sm" onClick={toggleOpen} className="flex items-center gap-1">
          <Eye className="w-3 h-3" /> {open ? 'Nascondi' : 'Dettagli'}
        </Button>
      </div>
    </Card>
  );
}

function Templates({ details }: { details: CampaignDetailed }) {
  return (
    <div className="space-y-6">
      {(details.emailTemplate || details.smsTemplate) ? (
        <div className="grid gap-3">
          {details.emailTemplate && (
            <div className="p-3 bg-gray-50 rounded border">
              <div className="flex items-center gap-2 mb-1 text-blue-600 text-xs font-semibold"><Mail className="w-3 h-3" /> EMAIL</div>
              <p className="text-xs text-gray-700 whitespace-pre-wrap max-h-40 overflow-auto">{details.emailTemplate}</p>
            </div>
          )}
          {details.smsTemplate && (
            <div className="p-3 bg-gray-50 rounded border">
              <div className="flex items-center gap-2 mb-1 text-green-600 text-xs font-semibold"><MessageSquare className="w-3 h-3" /> SMS</div>
              <p className="text-xs text-gray-700 whitespace-pre-wrap max-h-40 overflow-auto">{details.smsTemplate}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 bg-gray-50 rounded border text-xs text-gray-500">Nessun template associato.</div>
      )}
      <div className="text-[10px] text-gray-500 flex justify-between">
        <span>Creato: {format(new Date(details.createdAt), 'dd/MM/yyyy')}</span>
        <span>Aggiornato: {format(new Date(details.updatedAt), 'dd/MM/yyyy')}</span>
      </div>
    </div>
  );
}

function ScheduleForm({ formValue, onChange, onSubmit, launching }: { formValue?: { startDate: string; endDate: string }; onChange: (next: Partial<FormValues>) => void; onSubmit: (e: any) => void; launching: boolean; }) {
  return (
    <div className="p-4 bg-white rounded border shadow-sm">
      <h4 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Gestione campagna</h4>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-gray-500">Data/Ora inizio</label>
            <input type="datetime-local" className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-blue" value={formValue?.startDate || ''} onChange={(e)=> onChange({ startDate: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-gray-500">Data/Ora fine</label>
            <input type="datetime-local" className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-blue" value={formValue?.endDate || ''} onChange={(e)=> onChange({ endDate: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 items-center">
          <Button type="submit" size="sm" disabled={launching} className="text-xs">
            {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 mr-1" />} Aggiorna
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 leading-snug">Imposta nuove date e premi Aggiorna. Lascia vuote per durata illimitata dopo l'avvio.</p>
      </form>
    </div>
  );
}

function deriveChannels(c: CampaignDetailed | CampaignListItem): ('email'|'sms')[] {
  const detailed = c as any;
  const channelsSet = new Set<'email'|'sms'>();
  if (detailed.emailTemplate && detailed.emailTemplate.trim()) channelsSet.add('email');
  if (detailed.smsTemplate && detailed.smsTemplate.trim()) channelsSet.add('sms');
  if ('type' in c && typeof c.type === 'string' && c.type.toUpperCase() === 'BOTH') { channelsSet.add('email'); channelsSet.add('sms'); }
  if (!channelsSet.size && 'type' in c) { if (/sms/i.test(c.type)) channelsSet.add('sms'); if (/mail|email/i.test(c.type)) channelsSet.add('email'); }
  const result = Array.from(channelsSet);
  return result.length ? result : ['sms'];
}
