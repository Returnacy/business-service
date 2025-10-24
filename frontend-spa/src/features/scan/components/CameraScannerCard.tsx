import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Camera } from 'lucide-react';
import { QRScanner } from '../../../components/qr-scanner';

interface Props { onScan: (code: string) => void; onError: (error: string) => void; }
export function CameraScannerCard({ onScan, onError }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2"><Camera className="w-6 h-6 text-brand-blue" /><span>Scansione Fotocamera</span></CardTitle>
      </CardHeader>
      <CardContent>
        <QRScanner onScan={onScan} onError={onError} />
      </CardContent>
    </Card>
  );
}
