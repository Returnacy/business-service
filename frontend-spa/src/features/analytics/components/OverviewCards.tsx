import { Card, CardContent } from '../../../components/ui/card';
import { Users, Gift, TrendingUp, MessageCircle, Stamp, UserPlus } from 'lucide-react';
import { OverviewMetrics } from '../../../api/analytics';

interface Props { data: OverviewMetrics }

const iconWrap = (cls: string, Icon: any) => (
  <div className={cls + ' p-3 rounded-full'}><Icon className="w-6 h-6" /></div>
);

export function OverviewCards({ data }: Props) {
  const nps = typeof data.averageNPS === 'number' ? data.averageNPS : 0;
  const npsLabel = nps < 0 ? 'Detrattori' : nps < 50 ? 'Passivi' : 'Promotori';
  const npsBadgeCls =
    nps < 0
      ? 'bg-red-100 text-red-800'
      : nps < 50
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-green-100 text-green-800';
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
      <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-gray-600 text-sm font-medium">Utenti Totali</p><p className="text-3xl font-bold text-gray-900">{data.totalUsers}</p></div>{iconWrap('bg-blue-100 text-brand-blue', Users)}</div><div className="mt-4 flex items-center text-sm"><TrendingUp className="w-4 h-4 text-green-600 mr-1" /><span className="text-green-600 font-medium">Growing</span></div></CardContent></Card>
      <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-gray-600 text-sm font-medium">Coupons Riscattati</p><p className="text-3xl font-bold text-gray-900">{data.couponsRedeemed}</p></div>{iconWrap('bg-green-100 text-green-600', Gift)}</div><div className="mt-4 flex items-center text-sm"><span className="text-gray-600">Total rewards claimed</span></div></CardContent></Card>
      <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-gray-600 text-sm font-medium">Punteggio NPS</p><p className="text-3xl font-bold text-gray-900">{nps.toFixed(2)}</p></div>{iconWrap('bg-green-100 text-green-600', TrendingUp)}</div><div className="mt-4 flex items-center text-sm"><span className={`px-2 py-1 rounded-full text-xs font-medium ${npsBadgeCls}`}>{npsLabel}</span></div></CardContent></Card>
      <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-gray-600 text-sm font-medium">Feedback</p><p className="text-3xl font-bold text-gray-900">{data.totalFeedback}</p></div>{iconWrap('bg-purple-100 text-purple-600', MessageCircle)}</div><div className="mt-4 flex items-center text-sm"><span className="text-gray-600">Customer responses</span></div></CardContent></Card>
      <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-gray-600 text-sm font-medium">Timbri Settimana</p><p className="text-3xl font-bold text-gray-900">{data.weeklyStamps}</p></div>{iconWrap('bg-orange-100 text-orange-600', Stamp)}</div><div className="mt-4 flex items-center text-sm"><span className="text-gray-600">Ultimi 7 giorni</span></div></CardContent></Card>
      <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-gray-600 text-sm font-medium">Nuovi Clienti Settimana</p><p className="text-3xl font-bold text-gray-900">{data.weeklyNewUsers}</p></div>{iconWrap('bg-cyan-100 text-cyan-600', UserPlus)}</div><div className="mt-4 flex items-center text-sm"><span className="text-gray-600">Ultimi 7 giorni</span></div></CardContent></Card>
    </div>
  );
}
