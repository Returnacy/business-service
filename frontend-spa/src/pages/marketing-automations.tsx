import React, { useState } from 'react';
import { Button } from '../components/ui/button';
import { Loader2 } from 'lucide-react';
import { useCampaigns, useCampaignDetails, useCampaignLifecycle } from '../features/marketing/hooks/useCampaigns';
import { CampaignCard, FormValues } from '../features/marketing/components/CampaignCard';

export default function MarketingAutomationsPage() {
  const { campaigns, loadingCampaigns, error: campaignsError, reload, setCampaigns } = useCampaigns();
  const { details, loadingDetails, load } = useCampaignDetails();
  const { launching, launch, toggle } = useCampaignLifecycle(reload);
  const [formValues, setFormValues] = useState({} as Record<string, FormValues>);

  // Prefill form values whenever campaign list changes
  React.useEffect(() => {
    setFormValues((prev: Record<string, FormValues>) => {
      const next: Record<string, FormValues> = { ...prev };
      campaigns.forEach((c: any) => {
        if (c.status !== 'inactive') {
          const toInputValue = (dateStr?: string) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '';
            const pad = (n: number) => String(n).padStart(2,'0');
            return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          };
          next[c.id] = { enabled: true, startDate: toInputValue(c.startDate), endDate: toInputValue(c.endDate) };
        }
      });
      return next;
    });
  }, [campaigns]);

  const handleFormChange = (id: string, next: Partial<FormValues>) => {
    setFormValues((p: Record<string, FormValues>) => ({ ...p, [id]: { ...(p[id] || { enabled: true, startDate: '', endDate: '' }), ...next } }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Automazioni Marketing
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Attiva le automazioni intelligenti che aiutano i tuoi clienti a tornare più spesso. 
            Nessuna configurazione richiesta. Ci pensiamo noi.
          </p>
        </div>

        {/* Campaigns Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loadingCampaigns && (
            <div className="col-span-full flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
          )}
          {!loadingCampaigns && campaignsError && (
            <div className="col-span-full text-center py-10">
              <div className="inline-block px-6 py-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                Errore nel caricamento delle campagne: {campaignsError}
              </div>
            </div>
          )}
          {!loadingCampaigns && !campaignsError && campaigns.length === 0 && (
            <div className="col-span-full text-center text-gray-600 py-10">Nessuna campagna configurata.</div>
          )}
          {campaigns.map((c: any) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              details={details[c.id]}
              loadingDetails={!!loadingDetails[c.id]}
              onLoadDetails={load}
              formValue={formValues[c.id]}
              onFormChange={handleFormChange}
              launching={!!launching[c.id]}
              onUpdateSchedule={(id: string, sched?: { start?: string; end?: string }) => launch(id, sched)}
              onToggle={(id: string, nextOn: boolean) => toggle(id, nextOn)}
            />
          ))}
        </div>

        {/* Summary Stats */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center space-x-6 px-6 py-4 bg-white rounded-lg shadow-sm border text-sm">
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">{campaigns.filter((c: any) => c.status==='ACTIVE').length}</div>
              <div className="text-gray-600">Campagne attive</div>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <div className="text-xl font-bold text-amber-600">{campaigns.filter((c: any) => c.status==='PAUSED').length}</div>
              <div className="text-gray-600">Programmate</div>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <div className="text-xl font-bold text-green-600">{campaigns.length}</div>
              <div className="text-gray-600">Totali</div>
            </div>
          </div>
        </div>

  {/* Removed AI voice automation creator per new requirements */}
      </div>
    </div>
  );
}