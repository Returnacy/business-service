import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { QrCode } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import React from 'react';

interface Props { value: string; onChange: (v: string) => void; onSubmit: () => void; loading: boolean; }
export function ManualInput({ value, onChange, onSubmit, loading }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2"><QrCode className="w-6 h-6 text-brand-blue" /><span>Inserimento Manuale</span></CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Inserisci il codice QR del cliente</label>
          <Input type="text" placeholder="es: a1b2..." value={value} onChange={(e) => onChange(e.target.value)} onKeyPress={(e) => e.key==='Enter' && onSubmit()} className="text-base" />
        </div>
        <Button onClick={onSubmit} disabled={loading || !value.trim()} className="w-full bg-brand-blue hover:bg-brand-dark text-lg py-3">{loading ? 'Ricerca in corso...' : 'Cerca Cliente'}</Button>
      </CardContent>
    </Card>
  );
}
