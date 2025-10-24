import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../../components/ui/card';
import { Repeat, Clock, Euro, TrendingUp } from 'lucide-react';
import { FrequencyMetrics, RepeatRateMetrics, EconomicMetrics } from '../../../api/analytics';

interface Props {
  repeatRate: RepeatRateMetrics;
  frequency: FrequencyMetrics;
  economic: EconomicMetrics;
  pricePerStamp: string;
  onPriceChange: (val: string) => void;
  totalRevenue: number;
  couponCost: number;
  netValue: number;
  roi: string;
  subscriptionPrice: number;
  format2: (n: number | string | null | undefined) => string;
  priceConfigSlot: React.ReactNode;
}

export function KPICards(props: Props) {
  const { repeatRate, frequency, economic, pricePerStamp, onPriceChange, totalRevenue, couponCost, netValue, roi, subscriptionPrice, format2, priceConfigSlot } = props;
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasso di Ritorno</CardTitle>
            <Repeat className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{format2(repeatRate.repeatRate)}%</div>
            <p className="text-xs text-muted-foreground">{repeatRate.returningUsers} di {repeatRate.totalUsers} clienti ritornano</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Frequenza Media</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{parseInt(format2(frequency.averageFrequency))} giorni</div>
            <p className="text-xs text-muted-foreground">Basato su {repeatRate.returningUsers} clienti attivi</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center"><span className="w-2 h-2 bg-amber-400 rounded-full mr-2"></span>Valore Economico</CardTitle>
            <Euro className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{format2(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">{economic.totalStamps} timbri x €{format2(pricePerStamp)}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center"><span className="w-2 h-2 bg-amber-400 rounded-full mr-2"></span>ROI Mensile</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roi}x</div>
            <p className="text-xs text-muted-foreground">€{format2(netValue)} / €{format2(subscriptionPrice)}</p>
          </CardContent>
        </Card>
      </div>
      {priceConfigSlot}
    </>
  );
}
