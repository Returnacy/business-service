import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Mail, Phone, Calendar, User, Gift, Eye, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPrizeProgression } from '../../../lib/legacy-api-adapter';
import { Button } from '../../../components/ui/button';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '../../../components/ui/alert-dialog';
import { useAuth } from '../../../hooks/use-auth';
import { useToast } from '../../../hooks/use-toast';
import { authorizer } from '../../../lib/policy';
import { getTenantContext } from '../../../lib/authz';

interface Props {
  customer: any | null;
  onClose: () => void;
  onAddStamps: (c: any) => void;
  onRedeemCoupon: (c: any) => void;
  onDelete: (c: any) => void;
  redeemState: { pending: boolean };
  deleteState: { pending: boolean };
}

export function CustomerDetailDialog({ customer, onClose, onAddStamps, onRedeemCoupon, onDelete, redeemState, deleteState }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Use validStamps for progression; fallback to total stamps if not provided
  const validStamps = (customer?.validStamps ?? customer?.stamps ?? 0);
  const progQuery = useQuery({
    queryKey: ['crm:prizeProgression', customer?.id, validStamps],
    queryFn: async () => getPrizeProgression(validStamps),
    enabled: !!customer,
    staleTime: 60_000,
  });
  const totalNeeded = Math.max(1, (progQuery.data?.stampsNextPrize ?? 15) - (progQuery.data?.stampsLastPrize ?? 0));
  const progressMod = totalNeeded > 0 ? (validStamps - (progQuery.data?.stampsLastPrize ?? 0)) % totalNeeded : 0;

  // Coupon redemption is handled by the parent via onRedeemCoupon and redeemState
  const { user } = useAuth();
  const ctx = getTenantContext();
  if (!customer) return null;
  return (
    <Dialog open={!!customer} onOpenChange={(open: boolean) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center"><User className="w-5 h-5 mr-2" />{customer.name}</DialogTitle>
          <DialogDescription>Gestisci il cliente e i suoi timbri</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{customer.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.email && <div className="flex items-center"><Mail className="w-4 h-4 mr-3 text-gray-500" /><span className="text-sm">{customer.email}</span></div>}
              {customer.phone && <div className="flex items-center"><Phone className="w-4 h-4 mr-3 text-gray-500" /><span className="text-sm">{customer.phone}</span></div>}
              {customer.lastSeen && (
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-3 text-gray-500" />
                  <span className="text-sm">
                    Ultima visita: {new Date(customer.lastSeen).toLocaleDateString('it-IT')}
                  </span>
                </div>
              )}
              {customer.birthday && <div className="flex items-center"><Calendar className="w-4 h-4 mr-3 text-gray-500" /><span className="text-sm">{new Date(customer.birthday).toLocaleDateString('it-IT')}</span></div>}
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Card className="text-center"><CardContent className="p-4"><div className="text-2xl font-bold text-blue-600">{customer.stamps}</div><div className="text-sm text-gray-600">Timbri Totali</div></CardContent></Card>
            <Card className="text-center"><CardContent className="p-4"><div className="text-2xl font-bold text-green-600">{customer.totalCoupons || 0}</div><div className="text-sm text-gray-600">Coupon Guadagnati</div></CardContent></Card>
          </div>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium">Progresso Prossima Pizza</span><span className="text-sm text-gray-600">{progressMod}/{totalNeeded}</span></div>
              <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${totalNeeded ? ((progressMod / totalNeeded) * 100) : 0}%` }} /></div>
              <div className="text-xs text-gray-500 mt-1">{Math.max(0, totalNeeded - progressMod)} timbri alla prossima pizza gratuita</div>
            </CardContent>
          </Card>
          <div className="space-y-2 pt-2">
            <Button className="w-full" size="lg" onClick={() => onAddStamps(customer)}><Gift className="w-4 h-4 mr-2" />Aggiungi Timbri Manualmente</Button>
            {(() => {
              const canRedeem = (customer.validCoupons || 0) > 0;
              const pending = !!redeemState?.pending;
              return (
                <Button className={`w-full ${canRedeem ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400'}`} size="lg" disabled={!canRedeem || pending} onClick={() => { void onRedeemCoupon(customer); }}>
                  <Gift className="w-4 h-4 mr-2" />{pending ? 'Riscatto...' : canRedeem ? 'Riscatta Coupon' : 'Coupon Non Disponibile'}
                </Button>
              );
            })()}
            {customer.role !== 'admin' && authorizer.can(user as any, 'crm', 'deleteCustomer', ctx) && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full" size="lg"><Trash2 className="w-4 h-4 mr-2" />Elimina Cliente</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
                    <AlertDialogDescription>Sei sicuro di voler eliminare il cliente <strong>{customer.name}</strong>?<br/><br/>Questa azione eliminerà definitivamente:<br/>• Tutti i dati del cliente<br/>• Tutti i timbri accumulati ({customer.stamps} timbri)<br/>• Tutti i coupon associati<br/><br/><strong>Questa azione non può essere annullata.</strong></AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(customer)} className="bg-red-600 hover:bg-red-700">{deleteState.pending ? 'Eliminazione...' : 'Elimina Cliente'}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
