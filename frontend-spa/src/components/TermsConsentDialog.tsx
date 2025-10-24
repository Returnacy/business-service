import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { useAuth } from '@/hooks/use-auth';
import { acceptUserAgreement } from '@/lib/legacy-api-adapter';
import { queryClient } from '@/lib/queryClient';

export default function TermsConsentDialog() {
  const { user } = useAuth();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedMarketing, setAcceptedMarketing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null as null | string);

  const shouldOpen = useMemo(() => {
    if (!user) return false;
    const ua = user.userAgreement as any;
    // Open if any required policy is false. We require at least terms + privacy; marketing optional
    return !ua?.termsOfService || !ua?.privacyPolicy;
  }, [user]);

  async function onSubmit() {
    if (!acceptedTerms || !acceptedPrivacy || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      await acceptUserAgreement({
        acceptPrivacyPolicy: acceptedPrivacy,
        acceptTermsOfService: acceptedTerms,
        acceptMarketingPolicy: acceptedMarketing,
      });
      // Update cached user to reflect agreement
      queryClient.setQueryData(['/_me_invalid_key_'], null); // no-op safety
      queryClient.setQueryData(['/me'], (prev: any) => prev ? { ...prev, userAgreement: { privacyPolicy: true, termsOfService: true, marketingPolicy: prev.userAgreement?.marketingPolicy ?? acceptedMarketing } } : prev);
    } catch (e: any) {
      setError(e?.message || 'Impossibile aggiornare il consenso. Riprova.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={shouldOpen}>
  <DialogContent hideClose onEscapeKeyDown={(e: any) => e.preventDefault()} onPointerDownOutside={(e: any) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Aggiornamento di Termini e Privacy</DialogTitle>
          <DialogDescription>
            Per continuare a utilizzare l'app è necessario accettare i Termini e Condizioni e l'Informativa Privacy.
          </DialogDescription>
        </DialogHeader>

  <div className="space-y-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={acceptedTerms} onChange={(e: any) => setAcceptedTerms(e.target.checked)} />
            <span>
              Ho letto e accetto i <a href="/terms" target="_blank" className="text-brand-blue underline">Termini e Condizioni</a>.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={acceptedMarketing} onChange={(e: any) => setAcceptedMarketing(e.target.checked)} />
            <span>
              Accetto di ricevere incredibili offerte e promozioni (opzionale).
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={acceptedPrivacy} onChange={(e: any) => setAcceptedPrivacy(e.target.checked)} />
            <span>
              Ho letto e accetto l' <a href="/privacy" target="_blank" className="text-brand-blue underline">Informativa Privacy</a>.
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="pt-2 flex justify-end">
            <Button onClick={onSubmit} disabled={!acceptedTerms || !acceptedPrivacy || submitting} className="bg-brand-blue hover:bg-brand-dark">
              {submitting ? 'Invio…' : 'Accetto e continuo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
