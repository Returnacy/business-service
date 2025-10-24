import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Gift, CheckCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';

interface Props { coupon: any; onRedeem: () => void; loading: boolean; onReset: () => void; }
export function CouponResult({ coupon, onRedeem, loading, onReset }: Props) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2"><Gift className="w-6 h-6 text-green-600" /><span>Coupon Pizza Gratuita</span></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center text-white mx-auto"><Gift className="w-12 h-12" /></div>
            <div><h3 className="text-2xl font-bold text-gray-900 mb-2">Pizza Gratuita!</h3><p className="text-gray-600">Coupon ID: {coupon.id}</p></div>
            {coupon.isRedeemed ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4"><div className="flex items-center space-x-2 text-red-800"><CheckCircle className="w-5 h-5" /><span className="font-semibold">Coupon già utilizzato</span></div><p className="text-red-600 text-sm mt-1">Riscattato il: {new Date(coupon.redeemedAt).toLocaleDateString('it-IT')}</p></div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4"><div className="flex items-center space-x-2 text-green-800 mb-3"><CheckCircle className="w-5 h-5" /><span className="font-semibold">Coupon valido</span></div><Button onClick={onRedeem} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-3">{loading ? 'Riscatto in corso...' : '🍕 Riscatta Pizza Gratuita'}</Button></div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
