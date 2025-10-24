import { Button } from '../../../components/ui/button';
import { Camera, Keyboard } from 'lucide-react';

interface Props { mode: 'camera' | 'manual'; onChange: (m: 'camera' | 'manual') => void; }
export function ModeSelector({ mode, onChange }: Props) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-1">
      <Button onClick={() => onChange('camera')} variant={mode==='camera' ? 'default' : 'ghost'} className={`flex-1 ${mode==='camera' ? 'bg-brand-blue hover:bg-brand-dark text-white' : ''}`}>
        <Camera className="w-4 h-4 mr-2" />Fotocamera
      </Button>
      <Button onClick={() => onChange('manual')} variant={mode==='manual' ? 'default' : 'ghost'} className={`flex-1 ${mode==='manual' ? 'bg-brand-blue hover:bg-brand-dark text-white' : ''}`}>
        <Keyboard className="w-4 h-4 mr-2" />Manuale
      </Button>
    </div>
  );
}
