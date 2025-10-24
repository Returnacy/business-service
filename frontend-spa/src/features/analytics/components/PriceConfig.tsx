import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

interface Props {
  pricePerStamp: string;
  onChange: (v: string) => void;
  totalRevenue: number;
  couponCost: number;
  netValue: number;
  economicStamps: number;
  economicCoupons: number;
  format2: (n: number | string | null | undefined) => string;
}

export function PriceConfig(props: Props) {
  const { pricePerStamp, onChange, totalRevenue, couponCost, netValue, economicStamps, economicCoupons, format2 } = props;
  return (
    <div className="mb-8 p-6 bg-amber-50/50 border-2 border-amber-200 rounded-xl">
      <div className="mb-4 flex items-center space-x-2">
        <div className="w-3 h-3 bg-amber-400 rounded-full"></div>
        <h3 className="text-lg font-semibold text-amber-800">Configurazione Economica</h3>
      </div>
      <p className="text-sm text-amber-700 mb-6">Le metriche evidenziate con il <span className="inline-flex items-center"><span className="w-2 h-2 bg-amber-400 rounded-full mx-1"></span></span> giallo sono calcolate automaticamente in base al prezzo per timbro configurato qui sotto.</p>
      <Card className="border-amber-200">
        <CardHeader>
          <CardTitle>Configurazione Prezzo</CardTitle>
          <CardDescription>Imposta il prezzo medio per timbro per calcolare il valore economico</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Label htmlFor="price-per-stamp">Prezzo per timbro (€)</Label>
              <Input id="price-per-stamp" type="number" step="0.01" value={pricePerStamp} onChange={(e) => onChange(e.target.value)} className="mt-1" />
            </div>
            <div className="flex-1">
              <Label>Dettagli Calcolo</Label>
              <div className="mt-1 text-sm text-gray-600 space-y-1">
                <div>Ricavi: €{format2(totalRevenue)} ({economicStamps} timbri)</div>
                <div>Costi coupon: €{format2(couponCost)} ({economicCoupons} coupon)</div>
                <div>Valore netto: €{format2(netValue)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
