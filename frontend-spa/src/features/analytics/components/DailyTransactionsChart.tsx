import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../../components/ui/select';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { CreditCard, Maximize2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';
import { useState } from 'react';

interface Props {
  desktopDays: string;
  onDesktopDaysChange: (v: string) => void;
  mobileDays: string;
  onMobileDaysChange: (v: string) => void;
  isMobile: boolean;
  loading: boolean;
  mobileLoading: boolean;
  combinedDesktop: any[];
  combinedMobile: any[];
}

export function DailyTransactionsChart(props: Props) {
  const { desktopDays, onDesktopDaysChange, mobileDays, onMobileDaysChange, isMobile, loading, mobileLoading, combinedDesktop, combinedMobile } = props;
  const [showChartModal, setShowChartModal] = useState(false);

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center"><CreditCard className="w-5 h-5 mr-2" />Timbri e Transazioni Giornaliere</CardTitle>
            <CardDescription>Andamento dei timbri e transazioni nel tempo</CardDescription>
          </div>
          {!isMobile ? (
            <Select value={desktopDays} onValueChange={onDesktopDaysChange}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 giorni</SelectItem>
                <SelectItem value="14">14 giorni</SelectItem>
                <SelectItem value="30">30 giorni</SelectItem>
                <SelectItem value="90">90 giorni</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Dialog open={showChartModal} onOpenChange={setShowChartModal}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="p-2"><Maximize2 className="w-4 h-4" /></Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] max-h-[90vh] w-full p-4">
                <DialogHeader>
                  <DialogTitle className="flex items-center text-lg"><CreditCard className="w-5 h-5 mr-2" />Timbri e Transazioni Giornaliere</DialogTitle>
                  <DialogDescription>Vista dettagliata del grafico con selezione del periodo e scorrimento orizzontale</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="flex justify-center mt-4 mb-6">
                    <Select value={mobileDays} onValueChange={onMobileDaysChange}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 giorni</SelectItem>
                        <SelectItem value="14">14 giorni</SelectItem>
                        <SelectItem value="30">30 giorni</SelectItem>
                        <SelectItem value="90">90 giorni</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 w-full overflow-auto border rounded-lg">
                    {mobileLoading ? (
                      <div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
                    ) : (
                      <div className="p-2" style={{ width: Math.max(600, combinedMobile.length * 60), height: '350px', minWidth: '600px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={combinedMobile} margin={{ top: 0, right: 20, left: 10, bottom: 50 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" fontSize={12} angle={-45} textAnchor="end" height={50} interval={0} />
                            <YAxis fontSize={12} allowDecimals={false} domain={[0, 'dataMax']} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="Timbri" fill="#3b82f6" name="Timbri" />
                            <Bar dataKey="Transazioni" fill="#10b981" name="Transazioni" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-80 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
        ) : (
          <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
            <BarChart data={combinedDesktop} margin={{ top: 0, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={isMobile ? 10 : 12} angle={isMobile ? -45 : 0} textAnchor={isMobile ? 'end' : 'middle'} height={isMobile ? 60 : 30} />
              <YAxis fontSize={isMobile ? 10 : 12} allowDecimals={false} domain={[0, 'dataMax']} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Timbri" fill="#3b82f6" name="Timbri" />
              <Bar dataKey="Transazioni" fill="#10b981" name="Transazioni" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
