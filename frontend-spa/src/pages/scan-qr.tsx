// Refactored Scan QR page into feature components
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUser, addStamps as addStampsLegacy, getPrizeProgression, getCouponByCode } from '../lib/legacy-api-adapter';
import { http } from '../lib/http';
import { useToast } from '../hooks/use-toast';
import { useLocation, Link } from 'wouter';
import { ModeSelector } from '../features/scan/components/ModeSelector';
import { CameraScannerCard } from '../features/scan/components/CameraScannerCard';
import { ManualInput } from '../features/scan/components/ManualInput';
import { CouponResult } from '../features/scan/components/CouponResult';
import { UserResult } from '../features/scan/components/UserResult';
import { Button } from '../components/ui/button';
import type { CouponType } from '../types/coupon';

export default function ScanQRPage() {
  const [location, navigate] = useLocation();
  const [qrInput, setQrInput] = useState('');
  const [scannedUser, setScannedUser] = useState(null as any);
  const [scannedCoupon, setScannedCoupon] = useState(null as CouponType | null);
  const [firstValidCouponCode, setFirstValidCouponCode] = useState(null as string | null);
  const [scanMode, setScanMode] = useState('camera' as 'camera' | 'manual');
  const [stampCounter, setStampCounter] = useState(1);
  const [fromCRM, setFromCRM] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Extract query params (supports legacy serialized object)
  const [userIdParam, setUserIdParam] = useState(null as string | null);
  const [couponParam, setCouponParam] = useState(null as string | null);
  const [resolvingScan, setResolvingScan] = useState(false);
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const rawCustomer = urlParams.get('customer');
    const rawCoupon = urlParams.get('coupon');
    const comingFromCRM = !!rawCustomer || !!rawCoupon;

    setFromCRM(comingFromCRM);
    // Do not force manual mode if we already have a customer id; keep camera unless explicitly no params
    if (!comingFromCRM) {
      setScanMode('camera');
    }

    if (!comingFromCRM) {
      setUserIdParam(null);
      setCouponParam(null);
      return;
    }

    setUserIdParam(null);
    setCouponParam(null);

    if (rawCoupon) {
      try {
        const decoded = decodeURIComponent(rawCoupon);
        setCouponParam(decoded);
      } catch {
        setCouponParam(rawCoupon);
      }
    }

    if (rawCustomer) {
      try {
        const decoded = decodeURIComponent(rawCustomer);
        if (decoded.startsWith('{')) {
          const legacy = JSON.parse(decoded);
          const legacyId = legacy.id || legacy.userId;
          if (legacyId) {
            setUserIdParam(String(legacyId));
            return;
          }
        }
        setUserIdParam(decoded);
      } catch {
        setUserIdParam(rawCustomer);
      }
    }
  }, [location]);

  // Query user only if userId param provided
  const userQuery = useQuery({
    queryKey: ['scanQrUser', userIdParam],
    queryFn: () => getUser(userIdParam!),
    enabled: !!userIdParam,
    staleTime: 30_000,
  });

  // Map query data to scannedUser when from CRM (don't overwrite if a QR scan already set a user)
  useEffect(() => {
    if (userQuery.data && userIdParam) {
      const data: any = userQuery.data as any;
      const profile = data.profile || {};
      const baseNameParts = [profile.name, profile.surname].filter((p: string) => p && p.trim() !== '');
      const fallbackName = data.email?.split('@')[0] || 'Utente';
      const name = (baseNameParts.join(' ').trim()) || fallbackName;
      const validStamps = data.stamps?.validStamps ?? 0;
      // Compute progression dynamically
      let totalNeededStamps = 15;
      try {
        getPrizeProgression(validStamps).then((prog) => {
          const needed = Math.max(1, (prog.stampsNextPrize - prog.stampsLastPrize));
          setScannedUser((prev: any) => prev ? { ...prev, totalNeededStamps: needed } : prev);
        }).catch(() => {});
      } catch {}
      const mapped = {
        id: String(data.id || data.userId || userIdParam),
        name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        stamps: validStamps,
        totalNeededStamps,
        totalCoupons: data.coupons?.usedCoupons ?? 0,
        nextPrizeName: data.nextPrize?.name || 'Prossimo premio',
      };
      setScannedCoupon(null);
      setScannedUser(mapped);
      // Extract first valid (non redeemed) coupon code if available
      try {
        const couponsArr = data.coupons?.coupons || [];
        const firstValid = couponsArr.find((c: any) => c && c.code && (c.isRedeemed === false || c.isRedeemed === undefined));
        setFirstValidCouponCode(firstValid ? String(firstValid.code) : null);
      } catch {
        setFirstValidCouponCode(null);
      }
    }
  }, [userQuery.data, userIdParam]);

  useEffect(() => {
    if (!couponParam) return;
    let cancelled = false;
    setResolvingScan(true);
    const code = couponParam.trim();
    if (!code) {
      setScannedCoupon(null);
      setFirstValidCouponCode(null);
      setScannedUser(null);
      setResolvingScan(false);
      navigate('/scan-qr', { replace: true });
      return;
    }
    (async () => {
      try {
        const coupon = await getCouponByCode(code);
        if (!coupon) {
          if (!cancelled) {
            setScannedCoupon(null);
            setFirstValidCouponCode(null);
            setScannedUser(null);
            toast({
              title: 'Coupon non trovato',
              description: 'Nessun coupon valido corrisponde al codice inserito.',
              variant: 'destructive',
            });
            navigate('/scan-qr', { replace: true });
          }
          return;
        }
        if (cancelled) return;
        setScannedUser(null);
        setFirstValidCouponCode(null);
        setScannedCoupon({
          ...coupon,
          id: coupon.id ?? coupon.code,
          qrCode: coupon.qrCode ?? coupon.code,
        });
      } catch (error: any) {
        if (cancelled) return;
          const message = error?.message ?? 'Impossibile verificare il coupon. Riprova.';
        setScannedCoupon(null);
        setFirstValidCouponCode(null);
    setScannedUser(null);
        toast({
          title: 'Errore nel recupero del coupon',
          description: message,
          variant: 'destructive',
        });
        navigate('/scan-qr', { replace: true });
      } finally {
        if (!cancelled) setResolvingScan(false);
      }
    })();
    return () => {
      cancelled = true;
      setResolvingScan(false);
    };
  }, [couponParam, navigate, toast]);

  useEffect(() => {
    if (!couponParam) {
      setScannedCoupon(null);
      setResolvingScan(false);
      setFirstValidCouponCode(null);
    }
  }, [couponParam]);

  // Removed manual fetchUser in favor of React Query getUser

  // Removed legacy lookup endpoints; QR code now drives direct redirect

  const addStampsMutation = useMutation({
    mutationFn: async ({ userId, stamps }: { userId: string; stamps: number }) => {
      // Use backend base via http client (api.fidelity.chepizzadasalva.it)
      console.log('[addStamps][mutationFn] invoked', { userId, stamps, type: typeof userId });
      const badIds = new Set(['', 'undefined', 'null', 'NaN']);
      if (userId === undefined || userId === null || badIds.has(String(userId).trim())) {
        console.error('[addStamps][mutationFn] abort: invalid userId', userId);
        throw new Error('User ID mancante per aggiunta timbri');
      }
      const endpointUserId = String(userId).trim();
      const updated = await addStampsLegacy(endpointUserId, Number(stamps));
      window.location.reload(); // Reload to refresh user data
      console.log('[addStamps][mutationFn] response', updated);
      return updated;
    },
    onSuccess: (updatedUser: any) => {
      const previousStampCount = scannedUser?.stamps ?? 0;
      const newStampCount = (updatedUser?.stamps?.validStamps ?? updatedUser?.stamps ?? previousStampCount) as number;
      const totalNeededStamps = updatedUser?.stamps?.neededStamps ?? 15;
      // Preserve existing scannedUser shape
      const preservedId = scannedUser?.id;
      setScannedUser({ ...updatedUser, id: preservedId, stamps: newStampCount, totalNeededStamps });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/overview"] });
      const newCoupons = Math.floor(newStampCount / totalNeededStamps) - Math.floor(previousStampCount / totalNeededStamps);
      toast({
        title: "Timbri aggiornati",
        description: newCoupons > 0
          ? `${newCoupons} nuovo coupon guadagnato! 🎉`
          : `Totale timbri: ${newStampCount}`,
      });
      console.log('[addStamps][onSuccess]', { previousStampCount, newStampCount, updatedUser });
    },
    onError: (error) => {
      console.error('[addStamps][onError]', error);
      toast({
        title: "Errore nell'aggiungere i timbri",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const redeemCouponMutation = useMutation({
    mutationFn: async (qrCode: string) => {
      // New backend endpoint redeem via query string (GET)
      await http.get<any>(`/coupon-redemptions?code=${encodeURIComponent(qrCode)}`);
      return { code: qrCode, isRedeemed: true, redeemedAt: new Date().toISOString() };
    },
    onSuccess: (redeemedCoupon) => {
  setScannedCoupon((prev: CouponType | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          isRedeemed: true,
          redeemedAt: redeemedCoupon.redeemedAt ? new Date(redeemedCoupon.redeemedAt) : new Date(),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/overview"] });
      
      toast({
        title: "Pizza gratuita riscattata!",
        description: "Il coupon è stato utilizzato con successo. Buon appetito! 🍕",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Errore durante il riscatto del coupon.";
      const requiresEmailVerification = error?.requiresEmailVerification;
      
      toast({
        title: requiresEmailVerification ? "Verifica Email Richiesta" : "Errore nel riscatto",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleRedeemCoupon = () => {
    if (!scannedCoupon) return;
    const code = scannedCoupon.qrCode ?? scannedCoupon.code;
    if (!code) {
      toast({
        title: 'Coupon non valido',
        description: 'Il coupon selezionato non contiene un codice valido.',
        variant: 'destructive',
      });
      return;
    }
    redeemCouponMutation.mutate(code);
  };

  const handleScan = async (qrCode?: string) => {
    const raw = qrCode || qrInput.trim();
    if (!raw) {
      toast({
        title: "Codice QR non valido",
        description: "Riprova a scansionare il codice QR.",
        variant: "destructive",
      });
      return;
    }
    if (resolvingScan) return;
    setResolvingScan(true);

    try {
      // If already a full scan-qr URL (customer or coupon), normalize and go
      if (/scan-qr\?(customer|coupon)=/.test(raw)) {
        const base = (import.meta as any).env?.VITE_FRONTEND_BASE_URL || window.location.origin;
        try {
          const url = new URL(raw, base);
          window.location.href = url.toString();
        } catch {
          window.location.href = raw;
        }
        return;
      }

      // Attempt to classify: try fetching user; if success treat as user else coupon
      let isUser = false;
      try {
        await getUser(raw); // throws if not a user
        isUser = true;
      } catch (e) {
        isUser = false;
      }
      if (!isUser) {
        try {
          const coupon = await getCouponByCode(raw);
          if (!coupon) {
            toast({
              title: 'Coupon non trovato',
              description: 'Verifica il codice inserito e riprova.',
              variant: 'destructive',
            });
            return;
          }
        } catch (error: any) {
          toast({
            title: 'Errore nel recupero del coupon',
            description: error?.message ?? 'Impossibile verificare il coupon. Riprova.',
            variant: 'destructive',
          });
          return;
        }
      }
      const base = (import.meta as any).env?.VITE_FRONTEND_BASE_URL || window.location.origin;
      const paramName = isUser ? 'customer' : 'coupon';
      const target = `${base.replace(/\/$/, '')}/scan-qr?${paramName}=${encodeURIComponent(raw)}`;
      window.location.href = target;
    } finally {
      setResolvingScan(false);
    }
  };

  const onQRScanned = (result: string) => {
    handleScan(result);
  };

  const onScanError = (error: string) => {
    toast({
      title: "Errore Scansione",
      description: error,
      variant: "destructive",
    });
  };

  const addStamps = () => {
    console.log('[addStamps][handler] clicked', { scannedUser, stampCounter });
    if (!scannedUser) {
      console.log('[addStamps][handler] aborted: no scannedUser');
      return;
    }
    const uidRaw = scannedUser.id || scannedUser.userId;
    const uid = String(uidRaw ?? '').trim();
    if (!uid) {
      console.warn('[addStamps][handler] aborted: missing user id', scannedUser);
      toast({ title: "ID utente mancante", description: "Seleziona o scansiona un utente valido prima di aggiungere timbri.", variant: "destructive" });
      return;
    }
    const badIds = new Set(['undefined', 'null', 'NaN']);
    if (badIds.has(uid)) {
      console.warn('[addStamps][handler] aborted: user id is invalid literal', { uid, scannedUser });
      toast({ title: "ID utente non valido", description: "Il codice utente non è valido (undefined/null/NaN).", variant: "destructive" });
      return;
    }
    if (stampCounter === 0) {
      console.log('[addStamps][handler] aborted: stampCounter is 0');
      return;
    }
    addStampsMutation.mutate({ userId: uid, stamps: stampCounter });
  };

  const incrementStamps = () => {
    setStampCounter((prev: number) => Math.min(prev + 1, 50)); // Max 50 stamps
  };

  const decrementStamps = () => {
    setStampCounter((prev: number) => Math.max(prev - 1, -20)); // Allow up to -20 for corrections
  };

  const reset = () => {
    setQrInput("");
    setScannedUser(null);
    setScannedCoupon(null);
    setFromCRM(false);
    setScanMode('camera');
    setResolvingScan(false);
    // Remove any query params and stay on scan page
    navigate('/scan-qr', { replace: true });
  };

  return (
    <div className="max-w-2xl mx-auto p-6 min-h-screen">
      {/* Top actions */}
      <div className="flex items-center justify-between mb-6">
        {fromCRM && (
          <Link href="/crm">
            <Button variant="outline">
              Vai al CRM
            </Button>
          </Link>
        )}

        {(!!scannedUser || !!scannedCoupon) && (
          <Button variant="outline" onClick={reset}>Scansiona altro cliente</Button>
        )}
      </div>

      {/* Header */}
      {!fromCRM && (
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Scanner QR Cliente</h1>
          <p className="text-gray-600">Scansiona il QR del cliente per aggiungere timbri</p>
        </div>
      )}

      {!scannedUser && !scannedCoupon ? (
        <div className="space-y-6">
          {/* Mode Selector */}
          <ModeSelector mode={scanMode} onChange={setScanMode} />

  {scanMode === 'camera'
            ? <CameraScannerCard onScan={onQRScanned} onError={onScanError} />
            : <ManualInput value={qrInput} onChange={setQrInput} onSubmit={() => handleScan()} loading={resolvingScan} />}
        </div>
      ) : scannedCoupon ? (
        <CouponResult coupon={scannedCoupon} onRedeem={handleRedeemCoupon} loading={redeemCouponMutation.isPending} onReset={reset} />
      ) : (
        scannedUser && (
          <div className="space-y-4">
            <UserResult user={scannedUser} stampCounter={stampCounter} onInc={incrementStamps} onDec={decrementStamps} onApply={addStamps} applying={addStampsMutation.isPending} onReset={reset} />
            {firstValidCouponCode && (
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    const base = (import.meta as any).env?.VITE_FRONTEND_BASE_URL || window.location.origin;
                    const target = `${base.replace(/\/$/, '')}/scan-qr?coupon=${encodeURIComponent(firstValidCouponCode)}`;
                    window.location.href = target;
                  }}
                >
                  Visualizza Coupon Disponibile
                </Button>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}