import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { LoyaltyCard } from "../components/loyalty-card";
import { QRCode } from "../components/qr-code";
import { Gift, CheckCircle, AlertCircle, Mail, Loader2, WalletCards } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "../lib/queryClient";
import { createGoogleWalletPass, getClientProfile, getGoogleWalletStatus, getPrizeProgression } from "../lib/legacy-api-adapter";
import type { ClientType } from "../types/client";
import { useToast } from "../hooks/use-toast";
import loyaltyLogo from "@assets/che_pizza_fidelity_logo_horizontal.png";
import { useAuth } from "../hooks/use-auth";
import { CouponType } from "../types/coupon";
import { http } from "../lib/http";
import { getBusinessId, userHttp } from "../lib/servicesHttp";

export default function CustomerPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const businessId = getBusinessId();

  // Unified client profile query (backend now returns aggregated ClientType)
  const clientQuery = useQuery<ClientType | null>({
    queryKey: ['clientProfile'],
    queryFn: async () => {
      if (!user) return null;
      return await getClientProfile();
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  console.log("Client query data:", clientQuery.data);
  const client = clientQuery.data;

  // Compute prize progression for the current user's stamps
  const validStampsForProgress = client?.stamps?.validStamps ?? 0;
  const progressionQuery = useQuery({
    queryKey: ['prizeProgression', validStampsForProgress],
    queryFn: async () => getPrizeProgression(validStampsForProgress),
    enabled: client != null,
    staleTime: 60_000,
  });

  const walletStatusQuery = useQuery({
    queryKey: ['walletStatus', businessId],
    queryFn: async () => getGoogleWalletStatus({ businessId }),
    enabled: !!user && !!businessId,
    staleTime: 5 * 60_000,
  });

  const walletLinked = walletStatusQuery.data?.linked ?? false;

  // Derive values expected by existing UI (mock / fallback if absent)
  const userData = client ? (() => {
    const validStamps = client.stamps?.validStamps ?? 0;
    const prog = progressionQuery.data ?? { stampsLastPrize: 0, stampsNextPrize: 15 };
    const totalStampsNeeded = Math.max(1, (prog.stampsNextPrize - prog.stampsLastPrize));
    const lastPrizeStamps = prog.stampsLastPrize;
    const requiredStamps = Math.max(0, (prog.stampsNextPrize - validStamps));
    return {
      id: client.id,
  name: client.profile?.name || client.profile?.surname || client.email?.split('@')[0] || 'Utente',
      email: client.email || undefined,
      phone: client.phone || undefined,
      stamps: validStamps,
      totalStamps: totalStampsNeeded,
      lastStamps: lastPrizeStamps,
      requiredStamps,
      nextPrizeName: progressionQuery.data?.nextPrizeName || client.nextPrize?.name || 'Prossimo premio',
      totalCoupons: client.coupons?.usedCoupons ?? 0,
      isEmailVerified: client.isVerified ?? true, // assume verified if flag not reliable
      qrCode: `qr-${client.id}` // stub qrCode (backend to provide real code later)
    };
  })() : user ? {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: (user as any).phone,
    stamps: (user as any).stamps || 0,
    totalStamps: (user as any).totalStamps || 0,
    lastStamps: (user as any).lastStamps || 0,
    requiredStamps: (user as any).requiredStamps || 0,
    nextPrizeName: (user as any).nextPrizeName || 'Nessun premio',
    totalCoupons: (user as any).totalCoupons || 0,
    isEmailVerified: (user as any).isEmailVerified ?? true,
    qrCode: (user as any).qr_code || 'qr-stub'
  } : null;

  const coupons = client?.coupons?.coupons || [];
  const lastVisit = client?.lastVisit ? new Date(client.lastVisit) : null;

  const googleWalletMutation = useMutation<
    { saveUrl: string; jwt: string; objectId: string; classId: string; expiresAt: string },
    Error,
    { qrCode: string }
  >({
    mutationFn: async ({ qrCode }: { qrCode: string }) => {
      return await createGoogleWalletPass({ qrCode });
    },
    onSuccess: (pass) => {
      queryClient.setQueryData(['walletStatus', businessId], { linked: true, objectId: pass.objectId ?? null });
    },
  });

  const handleSaveToGoogleWallet = async () => {
    if (!userData?.id) {
      toast({
        title: "Dati mancanti",
        description: "Impossibile generare il pass senza un identificativo utente.",
        variant: "destructive",
      });
      return;
    }
    try {
      const pass = await googleWalletMutation.mutateAsync({ qrCode: userData.id });
      window.open(pass.saveUrl, "_blank", "noopener,noreferrer");
      toast({
        title: "Pass pronto!",
        description: "Aggiungi la carta fedeltà al tuo Google Wallet.",
      });
    } catch (error: any) {
      const message = error?.message || "Non è stato possibile generare il pass.";
      toast({
        title: "Errore", 
        description: message,
        variant: "destructive",
      });
    }
  };

  // Resend verification email mutation
  const resendVerificationMutation = useMutation({
    mutationFn: async () => {
      return await userHttp.post("/api/v1/auth/verify-email", { redirectUri: window.location.origin });
    },
    onSuccess: () => {
      toast({
        title: "Email inviata!",
        description: "Controlla la tua casella di posta per il link di verifica.",
      });
    },
    onError: (error) => {
      toast({
        title: "Errore",
        description: "Impossibile inviare l'email di verifica. Riprova più tardi.",
        variant: "destructive",
      });
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-800">
              Accesso Richiesto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-gray-600">
              Devi effettuare l'accesso per visualizzare la tua carta fedeltà.
            </p>
            <Link href="/auth">
              <Button className="w-full">Vai al Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (clientQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img
              src={loyaltyLogo}
              alt="Che Pizza Fidelity Logo"
              className="h-40 w-auto max-w-full md:h-32 lg:h-36"
            />
          </div>
          <p className="text-xl text-gray-600">La tua carta fedeltà digitale</p>
        </div>

        {/* User Info */}
        <Card className="mb-8 shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold text-gray-800">
              Ciao, {userData?.name}!
            </CardTitle>
            <p className="text-gray-600">
              {userData?.email} {userData?.phone && `• ${userData.phone}`}
            </p>
            
            {/* Email verification status */}
            {userData?.email && (
              <div className="mt-4">
                {userData?.isEmailVerified ? (
                  <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Email verificata
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      Email non verificata
                    </div>
                    <div>
                      <Button
                        onClick={() => resendVerificationMutation.mutate()}
                        disabled={resendVerificationMutation.isPending}
                        variant="outline"
                        size="sm"
                        className="mt-2"
                      >
                        {resendVerificationMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Invio in corso...
                          </>
                        ) : (
                          <>
                            <Mail className="w-4 h-4 mr-2" />
                            Reinvia email di verifica
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardHeader>
        </Card>

        {/* Loyalty Card */}
        <Card className="mb-8 shadow-xl border-0 bg-gradient-to-br from-red-500 to-orange-600 text-white overflow-hidden">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold mb-2">Carta Fedeltà</h2>
              <p className="text-red-100">
                Raccogli {userData?.totalStamps} timbri per {userData?.nextPrizeName}!
              </p>
            </div>

            <div className="flex justify-center mb-6">
              {(() => {
                const stampsInCycle = Math.max(0, (userData?.stamps || 0) - (userData?.lastStamps || 0));
                const maxInCycle = Math.max(1, userData?.totalStamps || 1);
                return (
                  <LoyaltyCard
                    stamps={stampsInCycle}
                    maxStamps={maxInCycle}
                    className="transform scale-110"
                  />
                );
              })()}
            </div>

            <div className="text-center">
              <p className="text-2xl font-bold">
                {Math.max(0, (userData?.stamps || 0) - (userData?.lastStamps || 0))} / {Math.max(1, userData?.totalStamps || 1)} Timbri
              </p>
              <p className="text-red-100 mt-2">
                {userData && userData.requiredStamps > 0
                  ? `Mancano ${userData.requiredStamps} timbri alla ${userData.nextPrizeName}!`
                  : `Hai raggiunto il premio: ${userData?.nextPrizeName}`}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* QR Code */}
        <Card className="mb-8 shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-bold text-gray-800">
              Il Tuo Codice QR
            </CardTitle>
            <p className="text-gray-600">
              Mostra questo codice alla cassa per raccogliere timbri
            </p>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <QRCode value={userData?.id || ""} size={200} />
            </div>
          </CardContent>
          {!walletLinked && (
            <CardContent className="pt-0">
              <div className="flex flex-col items-center gap-2">
                <Button
                  onClick={handleSaveToGoogleWallet}
                  disabled={googleWalletMutation.isPending || walletStatusQuery.isLoading || !userData?.id}
                  variant="outline"
                  className="bg-white"
                >
                  {googleWalletMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generazione in corso...
                    </>
                  ) : (
                    <>
                      <WalletCards className="h-4 w-4 mr-2" />
                      Salva su Google Wallet
                    </>
                  )}
                </Button>
                {googleWalletMutation.data?.expiresAt && (
                  <p className="text-xs text-gray-500 text-center">
                    Link valido fino a {new Date(googleWalletMutation.data.expiresAt).toLocaleString()}
                  </p>
                )}
              </div>
            </CardContent>
          )}
          {walletLinked && (
            <CardContent className="pt-0">
              <p className="text-sm text-gray-500 text-center">
                Carta già collegata con Google Wallet.
              </p>
            </CardContent>
          )}
        </Card>

        {/* Coupons (display-only) */}
        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-bold text-gray-800">
              <Gift className="h-6 w-6 text-green-600" />I Tuoi Coupon
            </CardTitle>
          </CardHeader>
          <CardContent>
            {coupons.length > 0 ? (
              <div className="space-y-4">
                {coupons.map((coupon: CouponType) => (
                  <div
                    key={coupon.code}
                    className={`p-4 rounded-lg border-2 ${
                      coupon.isRedeemed
                        ? "border-gray-300 bg-gray-50 opacity-75"
                        : "border-green-300 bg-green-50"
                    }`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <h3 className="font-semibold text-lg text-gray-800 mb-1">
                        {coupon.prize?.name || "Coupon Speciale"}
                      </h3>
                      <p className="text-gray-600 mb-3">
                        {coupon.isRedeemed ? "Utilizzato" : "Mostra questo QR per usare il coupon"}
                      </p>
                      <div className="bg-white p-4 rounded-lg shadow">
                        <QRCode value={coupon.code} size={150} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Gift className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">
                  Nessun coupon disponibile
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
