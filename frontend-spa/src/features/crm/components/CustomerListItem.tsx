import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Mail, Phone } from 'lucide-react';

interface Props {
  customer: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    role: string;
    stamps: number;
  totalCoupons?: number; // total earned (used+valid)
  validCoupons?: number; // currently valid (not redeemed)
    lastSeen?: string;
    birthday?: string;
    stampsToNext?: number;
    nextPrizeName?: string;
  };
  onSelect: (c: any) => void;
}

export function CustomerListItem({ customer, onSelect }: Props) {
  return (
    <Card 
      key={customer.id} 
      className="cursor-pointer hover:shadow-md transition-shadow w-full max-w-full overflow-hidden"
      onClick={() => onSelect(customer)}
    >
      <CardHeader className="pb-2">
        <div className="grid grid-cols-[1fr,auto] gap-4 items-start w-full">
          <div className="min-w-0 overflow-hidden">
            <CardTitle className="text-lg truncate">{customer.name}</CardTitle>
            <CardDescription className="mt-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                {customer.email && (
                  <span className="flex items-center min-w-0">
                    <Mail className="w-3 h-3 mr-1 flex-shrink-0" />
                    <span className="truncate text-xs sm:text-sm max-w-[200px]">{customer.email}</span>
                  </span>
                )}
                {customer.phone && (
                  <span className="flex items-center min-w-0">
                    <Phone className="w-3 h-3 mr-1 flex-shrink-0" />
                    <span className="truncate text-xs sm:text-sm">{customer.phone}</span>
                  </span>
                )}
              </div>
            </CardDescription>
          </div>
          <span
            className={`flex-shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${
              customer.role === 'admin' ? 'bg-destructive text-destructive-foreground border-transparent' :
              customer.role === 'staff' ? 'bg-secondary text-secondary-foreground border-transparent' :
              'bg-primary text-primary-foreground border-transparent'
            }`}
          >{customer.role}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[1fr,auto] gap-4 items-center w-full">
          <div className="grid grid-cols-3 gap-2 sm:gap-4 min-w-0">
            <div className="text-center">
              <div className="text-lg sm:text-2xl font-bold text-blue-600">{customer.stamps}</div>
              <div className="text-xs text-gray-500">Timbri</div>
            </div>
            <div className="text-center">
              <div className="text-lg sm:text-2xl font-bold text-green-600">{customer.validCoupons ?? 0}</div>
              <div className="text-xs text-gray-500">Coupon</div>
            </div>
            <div className="text-center">
              <div className="text-lg sm:text-2xl font-bold text-purple-600">{customer.totalCoupons ?? Math.floor(customer.stamps / 15)}</div>
              <div className="text-xs text-gray-500">Guadagnati</div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">{customer.nextPrizeName || 'Prossimo premio'}</div>
            <div className="text-sm sm:text-lg font-semibold whitespace-nowrap">{(customer.stampsToNext ?? Math.max(1, 15 - (customer.stamps % 15)))} timbri</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
