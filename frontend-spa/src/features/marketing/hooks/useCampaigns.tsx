import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../../hooks/use-toast';
import { fetchCampaigns, fetchCampaign, updateCampaignSchedule, toggleCampaignStatus, CampaignListItem, CampaignDetailed } from '../api/campaigns';

export function useCampaigns() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState([] as any);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true as any);
  const [error, setError] = useState(null as any);

  const reload = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const list = await fetchCampaigns();
      // Preserve previous order when reloading to avoid jank after status changes
      setCampaigns((prev: any[]) => {
        if (!Array.isArray(prev) || prev.length === 0) return list;
        const idx: Record<string, number> = {};
        prev.forEach((c: any, i: number) => { idx[c.id] = i; });
        return [...list].sort((a, b) => {
          const ia = idx[a.id];
          const ib = idx[b.id];
          if (ia === undefined && ib === undefined) return 0;
          if (ia === undefined) return 1;
          if (ib === undefined) return -1;
          return ia - ib;
        });
      });
      setError(null);
    } catch (e:any) {
      setError(e.message || 'Errore sconosciuto');
      toast({ title: 'Errore caricamento campagne', description: e.message || 'Impossibile recuperare le campagne', variant: 'destructive' });
    } finally {
      setLoadingCampaigns(false);
    }
  }, [toast]);

  useEffect(() => { reload(); }, [reload]);

  return { campaigns, loadingCampaigns, error, reload, setCampaigns };
}

export function useCampaignDetails() {
  const { toast } = useToast();
  const [loadingDetails, setLoadingDetails] = useState({} as any);
  const [details, setDetails] = useState({} as any);

  const load = async (id: string) => {
    if (details[id] || loadingDetails[id]) return;
  setLoadingDetails((p: Record<string, boolean>) => ({ ...p, [id]: true }));
    try {
      const d = await fetchCampaign(id);
  setDetails((p: Record<string, CampaignDetailed>) => ({ ...p, [id]: d }));
    } catch (e:any) {
      toast({ title: 'Errore dettagli campagna', description: e.message || 'Impossibile recuperare i dettagli', variant: 'destructive' });
    } finally {
  setLoadingDetails((p: Record<string, boolean>) => ({ ...p, [id]: false }));
    }
  };

  return { details, loadingDetails, load };
}

export function useCampaignLifecycle(reload: () => Promise<void> | void) {
  const { toast } = useToast();
  const [launching, setLaunching] = useState({} as any);

  const launch = async (id: string, schedule?: { start?: string; end?: string }) => {
  setLaunching((p: Record<string, boolean>) => ({ ...p, [id]: true }));
    try {
      await updateCampaignSchedule(id, { start: schedule?.start, end: schedule?.end });
      toast({ title: 'Pianificazione aggiornata', description: 'Le date sono state aggiornate' });
      await reload();
    } catch (e:any) {
      toast({ title: 'Errore aggiornamento', description: e.message || 'Impossibile aggiornare la campagna', variant: 'destructive' });
    } finally {
  setLaunching((p: Record<string, boolean>) => ({ ...p, [id]: false }));
    }
  };

  const toggle = async (id: string, nextOn: boolean) => {
  setLaunching((p: Record<string, boolean>) => ({ ...p, [id]: true }));
    try {
      await toggleCampaignStatus(id, nextOn);
      toast({ title: nextOn ? 'Campagna riattivata' : 'Campagna in pausa' });
      await reload();
    } catch (e:any) {
      toast({ title: 'Errore aggiornamento stato', description: e.message || 'Impossibile aggiornare lo stato', variant: 'destructive' });
    } finally {
  setLaunching((p: Record<string, boolean>) => ({ ...p, [id]: false }));
    }
  };

  return { launching, launch, toggle };
}
