import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { User, Plus, Minus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import React from 'react';

interface Props {
  user: any;
  stampCounter: number;
  onInc: () => void;
  onDec: () => void;
  onApply: () => void;
  applying: boolean;
  onReset: () => void;
}
export function UserResult({ user, stampCounter, onInc, onDec, onApply, applying, onReset }: Props) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center space-x-2"><User className="w-6 h-6 text-brand-blue" /><span>Cliente Trovato</span></CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 bg-brand-blue rounded-full flex items-center justify-center text-white font-bold text-xl">{user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}</div>
            <div><h3 className="text-xl font-bold text-gray-900">{user.name}</h3><p className="text-gray-600">{user.email || user.phone || 'Cliente'}</p></div>
          </div>
          <div className="bg-brand-cream p-4 rounded-xl">
            <div className="flex justify-between items-center"><span className="text-gray-700 font-medium">Timbri attuali:</span><span className="text-2xl font-bold text-brand-blue">{user.stamps}</span></div>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-3"><div className="bg-brand-blue h-3 rounded-full transition-all duration-500" style={{ width: `${(user.stamps % user.totalNeededStamps) / user.totalNeededStamps * 100}%` }} /></div>
              <p className="text-sm text-gray-600 mt-1">{user.totalNeededStamps - (user.stamps % user.totalNeededStamps)} timbri per il prossimo premio</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center space-x-2"><Plus className="w-6 h-6 text-green-600" /><span>Gestisci Timbri</span></CardTitle><p className="text-sm text-gray-600 mt-1">Aggiungi o rimuovi timbri (valori negativi per correzioni)</p></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center space-x-4 mb-6">
            <Button onClick={onDec} disabled={applying || stampCounter <= -20} variant="outline" size="lg" className="w-16 h-16 rounded-full"><Minus className="w-6 h-6" /></Button>
            <div className="w-24 h-16 flex items-center justify-center bg-white border-2 border-gray-300 rounded-lg"><span className="text-2xl font-bold text-gray-900">{stampCounter}</span></div>
            <Button onClick={onInc} disabled={applying || stampCounter >= 50} variant="outline" size="lg" className="w-16 h-16 rounded-full"><Plus className="w-6 h-6" /></Button>
          </div>
          <Button onClick={onApply} disabled={applying || stampCounter === 0} className={`w-full py-4 text-lg font-semibold ${stampCounter>0 ? 'bg-green-600 hover:bg-green-700' : stampCounter<0 ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-400'}`}>{applying ? 'Applicazione in corso...' : stampCounter>0 ? `Aggiungi ${stampCounter} ${stampCounter===1?'Timbro':'Timbri'}` : stampCounter<0 ? `Rimuovi ${Math.abs(stampCounter)} ${Math.abs(stampCounter)===1?'Timbro':'Timbri'}` : 'Seleziona quantità'}</Button>
          {applying && <div className="mt-4 text-center"><p className="text-gray-600">Modifica timbri in corso...</p></div>}
        </CardContent>
      </Card>
    </div>
  );
}
