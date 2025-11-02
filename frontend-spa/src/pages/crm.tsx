// CRM Page refactored to feature modules
// @ts-nocheck
import { useState, useEffect } from 'react';
import { Search, Plus, SlidersHorizontal, ChevronUp, ChevronDown, X, Gift } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Slider } from '../components/ui/slider';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import { StaffRegistration } from '../components/staff-registration';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/pagination';
import { useCustomers } from '../features/crm/hooks/useCustomers';
import { queryClient } from '../lib/queryClient';
import { CustomerListItem } from '../features/crm/components/CustomerListItem';
import { CustomerDetailDialog } from '../features/crm/components/CustomerDetailDialog';

// Legacy UI user shape (subset) maintained for existing JSX
interface UserType {
  id: string; // UUID string
  name: string;
  email?: string;
  phone?: string;
  role: string;
  // stamps holds TOTAL stamps (valid + used)
  stamps: number;
  // validStamps is the current usable stamps (for next prize progression)
  validStamps?: number;
  totalCoupons?: number;
  validCoupons?: number;
  lastSeen?: string;
  birthday?: string;
  stampsToNext?: number;
  nextPrizeName?: string;
}
import { useToast } from '../hooks/use-toast';
import { useLocation } from 'wouter';
import { useIsMobile } from '../hooks/use-mobile';
import { useMutation } from '@tanstack/react-query';
import { authorizer } from '../lib/policy';
import { getTenantContext } from '../lib/authz';
import { useAuth } from '../hooks/use-auth';
import { apiRequest as rawApiRequest } from '../lib/queryClient';
import { getUserCoupons, redeemCoupon } from '../lib/legacy-api-adapter';
import type { CouponType } from '../types/coupon';

type SortField = 'name' | 'stamps' | 'coupons' | 'lastVisit';
type SortDirection = 'asc' | 'desc';

interface FilterState {
  minStamps: number;
  couponsOnly: boolean;
  lastVisitDays: number | null;
}

export default function CRMPage() {
  const { user } = useAuth();
  const ctx = getTenantContext();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  
  // Get URL params for state persistence
  const urlParams = new URLSearchParams(window.location.search);
  
  // Search and selection state
  const [searchTerm, setSearchTerm] = useState(urlParams.get('search') || "");
  const [selectedCustomer, setSelectedCustomer] = useState<UserType | null>(null);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>((urlParams.get('sortField') as SortField) || 'name');
  const [sortDirection, setSortDirection] = useState<SortDirection>((urlParams.get('sortDirection') as SortDirection) || 'asc');
  
  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    minStamps: parseInt(urlParams.get('minStamps') || '0'),
    couponsOnly: urlParams.get('couponsOnly') === 'true',
    lastVisitDays: urlParams.get('lastVisitDays') ? parseInt(urlParams.get('lastVisitDays')!) : null,
  });
  
  // Filter UI state
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const [tempFilters, setTempFilters] = useState<FilterState>(filters);

  // Pagination state
  const [page, setPage] = useState<number>(parseInt(urlParams.get('page') || '1') || 1);
  const [limit, setLimit] = useState<number>(parseInt(urlParams.get('limit') || '50') || 50);
  const [couponSelection, setCouponSelection] = useState<{ customer: UserType; coupons: CouponType[] } | null>(null);
  const [isFetchingCoupons, setIsFetchingCoupons] = useState(false);

  // Update URL when state changes
  const updateURL = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    if (sortField !== 'name') params.set('sortField', sortField);
    if (sortDirection !== 'asc') params.set('sortDirection', sortDirection);
    if (filters.minStamps > 0) params.set('minStamps', filters.minStamps.toString());
    if (filters.couponsOnly) params.set('couponsOnly', 'true');
    if (filters.lastVisitDays) params.set('lastVisitDays', filters.lastVisitDays.toString());
  if (page && page !== 1) params.set('page', String(page));
  if (limit && limit !== 50) params.set('limit', String(limit));
    
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  };

  // Update URL when relevant state changes
  useEffect(() => {
    const timeoutId = setTimeout(updateURL, 150); // Debounce URL updates
    return () => clearTimeout(timeoutId);
  }, [searchTerm, sortField, sortDirection, filters, page, limit]);

  // Reset to page 1 when search/sort/filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, sortField, sortDirection, filters]);

  // Server-side fetch of customers using new /users POST contract
  const customersQuery = useCustomers({
    search: searchTerm || undefined,
    sortField,
    sortDirection,
    filters: {
      minStamps: filters.minStamps || undefined,
      couponsOnly: filters.couponsOnly || undefined,
      lastVisitDays: filters.lastVisitDays || undefined,
  },
  page,
  limit,
  });
  // Server response shape for CRM users list
  type ServerUser = {
    id: string | number;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
    profile?: { name?: string | null; surname?: string | null; birthdate?: string | Date | null } | null;
    stamps?: { validStamps?: number; usedStamps?: number } | null;
    coupons?: { validCoupons?: number; usedCoupons?: number } | null;
    lastVisit?: string | Date | null;
    nextPrize?: { name?: string | null; stampsLastPrize?: number; stampsNextPrize?: number } | null;
  };

  const customers = ((customersQuery.data as ServerUser[]) || []).map((u) => {
    const parts = [u.profile?.name, u.profile?.surname].filter((p): p is string => typeof p === 'string' && p.trim() !== '');
    const name = parts.join(' ').trim();
    const validCoupons = u.coupons?.validCoupons ?? 0;
    const usedCoupons = u.coupons?.usedCoupons ?? 0;
    const totalEarned = validCoupons + usedCoupons; // total coupons ever earned
    // Stamps: prefer total from server if present; fallback to (valid + used)
    const validStamps = u.stamps?.validStamps ?? 0;
    const usedStamps = u.stamps?.usedStamps ?? Math.max(0, (u.stamps?.totalStamps ?? 0) - (u.stamps?.validStamps ?? 0));
    const totalStamps = (u.stamps?.totalStamps ?? (validStamps + usedStamps));
    // Next prize info from server mapping (if present via adapter)
    const stampsLastPrize = u.nextPrize?.stampsLastPrize ?? 0;
    const stampsNextPrize = u.nextPrize?.stampsNextPrize ?? Math.floor(((validStamps ?? 0)) / 15) * 15 + 15;
    const stampsNeeded = Math.max(1, stampsNextPrize - stampsLastPrize);
    const currentProgress = Math.max(0, (validStamps ?? 0) - stampsLastPrize);
    const stampsToNext = Math.max(0, stampsNeeded - (currentProgress % stampsNeeded));
    const nextPrizeName = (u.nextPrize?.name ?? 'Prossimo premio') || 'Prossimo premio';
    return {
      id: String(u.id),
      name,
      email: u.email || undefined,
      phone: u.phone || undefined,
      role: u.role?.toLowerCase?.() || 'user',
      stamps: totalStamps,
      validStamps,
      totalCoupons: totalEarned,
      validCoupons,
      lastSeen: u.lastVisit ? new Date(u.lastVisit as string | Date).toISOString() : undefined,
      birthday: u.profile?.birthdate ? new Date(u.profile.birthdate as string | Date).toISOString() : undefined,
      // Derived for list item display
      stampsToNext,
      nextPrizeName,
    } as UserType;
  });

  // Delete customer mutation
  const deleteCustomerMutation = useMutation({
    mutationFn: async (userId: string) => { await rawApiRequest('DELETE', `/api/crm/customers/${userId}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm:customers'] });
      setSelectedCustomer(null);
      toast({ title: 'Cliente eliminato', description: 'Il cliente è stato eliminato con successo' });
    },
    onError: (error: any) => toast({ title: 'Errore', description: error.message || "Errore durante l'eliminazione del cliente", variant: 'destructive' })
  });

  // Navigate to Scanner QR page with customer details
  const navigateToStampManagement = (customer: UserType) => {
    setLocation(`/scan-qr?customer=${encodeURIComponent(customer.id)}`);
  };

  // Redeem coupon mutation for staff-assisted redemption
  const redeemCouponMutation = useMutation({
    mutationFn: async ({ coupon, customer }: { coupon: CouponType; customer: UserType }) => {
      if (!coupon?.id) throw new Error('Coupon senza identificativo valido');
      await redeemCoupon(coupon.id);
      return { coupon, customer };
    },
    onSuccess: ({ coupon, customer }) => {
      queryClient.invalidateQueries({ queryKey: ['crm:customers'] });
      setSelectedCustomer(prev => {
        if (!prev || prev.id !== customer.id) return prev;
        const nextValid = Math.max(0, (prev.validCoupons ?? 0) - 1);
        const nextTotal = prev.totalCoupons ?? 0;
        return { ...prev, validCoupons: nextValid, totalCoupons: nextTotal };
      });
      toast({
        title: 'Coupon riscattato con successo!',
        description: coupon.prize?.name ? `Premio riscattato: ${coupon.prize.name}` : `Coupon ${coupon.code} riscattato`,
      });
      setCouponSelection(null);
    },
    onError: (error: any) => toast({ title: 'Errore nel riscatto', description: error?.message ?? 'Impossibile riscattare il coupon', variant: 'destructive' })
  });

  // Get available coupons count for each customer
  const getAvailableCoupons = (customer: UserType) => {
    const earnedCoupons = Math.floor((customer.stamps || 0) / 15);
    return earnedCoupons - (customer.totalCoupons || 0);
  };

  // Processed customers now directly from server (server-side filtering & sorting)
  const processedCustomers = customers;

  const hasNextPage = customers.length === limit; // if fewer than limit, likely last page

  // Filter management functions
  const hasActiveFilters = filters.minStamps > 0 || filters.couponsOnly || filters.lastVisitDays !== null;

  const clearAllFilters = () => {
    setFilters({
      minStamps: 0,
      couponsOnly: false,
      lastVisitDays: null,
    });
    setTempFilters({
      minStamps: 0,
      couponsOnly: false,
      lastVisitDays: null,
    });
  };

  const applyFilters = () => {
    setFilters(tempFilters);
    setShowFilterPopover(false);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const removeFilter = (filterType: 'minStamps' | 'couponsOnly' | 'lastVisitDays') => {
    setFilters(prev => ({
      ...prev,
      [filterType]: filterType === 'minStamps' ? 0 : filterType === 'couponsOnly' ? false : null,
    }));
  };

  type FilterChip = { id: string; label: string; onRemove: () => void };
  const getFilterChips = (): FilterChip[] => {
    const chips: FilterChip[] = [];
    if (filters.minStamps > 0) {
      chips.push({
        id: 'minStamps',
        label: `Timbri ≥ ${filters.minStamps}`,
        onRemove: () => removeFilter('minStamps'),
      });
    }
    if (filters.couponsOnly) {
      chips.push({
        id: 'couponsOnly',
        label: 'Ha coupon',
        onRemove: () => removeFilter('couponsOnly'),
      });
    }
    if (filters.lastVisitDays) {
      chips.push({
        id: 'lastVisitDays',
        label: `Visitato negli ultimi ${filters.lastVisitDays} giorni`,
        onRemove: () => removeFilter('lastVisitDays'),
      });
    }
    return chips;
  };

  // Navigation wrappers for detail dialog
  const handleAddStamps = (customer: UserType) => navigateToStampManagement(customer);
  const filterValidCoupons = (coupons: CouponType[] = []) => {
    const now = Date.now();
    return coupons.filter(coupon => !coupon.isRedeemed && (!coupon.expiredAt || coupon.expiredAt.getTime() > now));
  };

  const handleRedeem = async (customer: UserType) => {
    setIsFetchingCoupons(true);
    try {
      const coupons = await getUserCoupons(customer.id);
      const validCoupons = filterValidCoupons(coupons ?? []);
      if (validCoupons.length === 0) {
        toast({ title: 'Nessun coupon disponibile', description: 'Il cliente non ha coupon validi da riscattare', variant: 'destructive' });
        return;
      }
      if (validCoupons.length === 1) {
        await redeemCouponMutation.mutateAsync({ coupon: validCoupons[0], customer });
        return;
      }
      setCouponSelection({ customer, coupons: validCoupons });
    } catch (error: any) {
      toast({ title: 'Errore nel caricamento dei coupon', description: error?.message ?? 'Riprovare più tardi', variant: 'destructive' });
    } finally {
      setIsFetchingCoupons(false);
    }
  };
  const handleDelete = (customer: UserType) => deleteCustomerMutation.mutate(customer.id);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Sistema CRM Clienti</h1>
        <p className="text-gray-600">Gestisci clienti, timbri e coupon della pizzeria</p>
      </div>

      <div className="space-y-6">
        {/* Search and Actions */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Cerca clienti per nome, email o telefono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          {authorizer.can(user as any, 'crm', 'addCustomer', ctx) && (
            <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuovo Cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Registra Nuovo Cliente</DialogTitle>
                  <DialogDescription>
                    Aggiungi un nuovo cliente al sistema
                  </DialogDescription>
                </DialogHeader>
                <StaffRegistration 
                  onSuccess={() => {
                    setShowNewCustomerDialog(false);
                    queryClient.invalidateQueries({ queryKey: ["/api/crm/customers"] });
                  }}
                  onCancel={() => setShowNewCustomerDialog(false)}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Apple-style Sorting and Filtering Controls */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            {/* Segmented Control for Sorting */}
            <div className="rounded-xl bg-gray-100 dark:bg-gray-800 p-1 inline-flex">
              {[
                { field: 'name' as SortField, label: 'Nome' },
                { field: 'stamps' as SortField, label: 'Timbri' },
                { field: 'coupons' as SortField, label: 'Coupon' },
                { field: 'lastVisit' as SortField, label: 'Ultima visita' },
              ].map((option) => (
                <button
                  key={option.field}
                  onClick={() => toggleSort(option.field)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-1 ${
                    sortField === option.field
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  {option.label}
                  {sortField === option.field && (
                    sortDirection === 'asc' ? 
                    <ChevronUp className="w-3 h-3" /> : 
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              ))}
            </div>

            {/* Filter Button - Responsive: Popover on Desktop, Sheet on Mobile */}
            {isMobile ? (
              <Sheet open={showFilterPopover} onOpenChange={setShowFilterPopover}>
                <SheetTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className={`flex items-center gap-2 ${hasActiveFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filtri
                    {hasActiveFilters && (
                      <span className="ml-1 h-5 min-w-[20px] text-xs inline-flex items-center justify-center rounded-full bg-secondary px-2.5 py-0.5 font-semibold text-secondary-foreground">
                        {getFilterChips().length}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-3xl max-h-[70vh] h-auto">
                  <SheetHeader className="pb-6">
                    <SheetTitle>Filtri</SheetTitle>
                    <SheetDescription>
                      Personalizza i filtri per trovare i clienti che stai cercando
                    </SheetDescription>
                  </SheetHeader>
                  
                  <div className="space-y-6 pb-4">
                    {/* Min Stamps Slider */}
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Timbri minimi: {tempFilters.minStamps}</Label>
                      <Slider
                        value={[tempFilters.minStamps]}
                        onValueChange={(value) => setTempFilters(prev => ({ ...prev, minStamps: value[0] }))}
                        max={20}
                        step={1}
                        className="w-full"
                      />
                    </div>

                    {/* Coupons Only Toggle */}
                    <div className="flex items-center justify-between py-2">
                      <Label htmlFor="coupons-only-mobile" className="text-base font-medium">Ha almeno un coupon</Label>
                      <Switch
                        id="coupons-only-mobile"
                        checked={tempFilters.couponsOnly}
                        onCheckedChange={(checked) => setTempFilters(prev => ({ ...prev, couponsOnly: checked }))}
                      />
                    </div>

                    {/* Last Visit Days */}
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Visitato negli ultimi giorni</Label>
                      <Input
                        type="number"
                        placeholder="es. 30"
                        value={tempFilters.lastVisitDays || ''}
                        onChange={(e) => setTempFilters(prev => ({ 
                          ...prev, 
                          lastVisitDays: e.target.value ? parseInt(e.target.value) : null 
                        }))}
                        min="1"
                        max="365"
                        className="text-base h-12"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-6 pb-2">
                    <Button 
                      onClick={applyFilters}
                      className="flex-1 h-11 text-base"
                    >
                      Applica filtri
                    </Button>
                    <Button 
                      onClick={() => {
                        setTempFilters({
                          minStamps: 0,
                          couponsOnly: false,
                          lastVisitDays: null,
                        });
                      }}
                      variant="outline" 
                      className="flex-1 h-11 text-base"
                    >
                      Pulisci tutto
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            ) : (
              <Popover open={showFilterPopover} onOpenChange={setShowFilterPopover}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className={`flex items-center gap-2 ${hasActiveFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filtri
                    {hasActiveFilters && (
                      <span className="ml-1 h-5 min-w-[20px] text-xs inline-flex items-center justify-center rounded-full bg-secondary px-2.5 py-0.5 font-semibold text-secondary-foreground">
                        {getFilterChips().length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 shadow-xl" align="start">
                  <div className="space-y-4">
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      Filtri
                    </div>
                    
                    {/* Min Stamps Slider */}
                    <div className="space-y-2">
                      <Label className="text-sm">Timbri minimi: {tempFilters.minStamps}</Label>
                      <Slider
                        value={[tempFilters.minStamps]}
                        onValueChange={(value) => setTempFilters(prev => ({ ...prev, minStamps: value[0] }))}
                        max={20}
                        step={1}
                        className="w-full"
                      />
                    </div>

                    {/* Coupons Only Toggle */}
                    <div className="flex items-center justify-between">
                      <Label htmlFor="coupons-only" className="text-sm">Ha almeno un coupon</Label>
                      <Switch
                        id="coupons-only"
                        checked={tempFilters.couponsOnly}
                        onCheckedChange={(checked) => setTempFilters(prev => ({ ...prev, couponsOnly: checked }))}
                      />
                    </div>

                    {/* Last Visit Days */}
                    <div className="space-y-2">
                      <Label className="text-sm">Visitato negli ultimi giorni</Label>
                      <Input
                        type="number"
                        placeholder="es. 30"
                        value={tempFilters.lastVisitDays || ''}
                        onChange={(e) => setTempFilters(prev => ({ 
                          ...prev, 
                          lastVisitDays: e.target.value ? parseInt(e.target.value) : null 
                        }))}
                        min="1"
                        max="365"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <Button 
                        onClick={applyFilters}
                        size="sm" 
                        className="flex-1"
                      >
                        Applica
                      </Button>
                      <Button 
                        onClick={() => {
                          setTempFilters({
                            minStamps: 0,
                            couponsOnly: false,
                            lastVisitDays: null,
                          });
                        }}
                        variant="outline" 
                        size="sm"
                        className="flex-1"
                      >
                        Pulisci tutto
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Filter Chips Row */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 transition-[height,opacity] duration-200 ease-out">
              {getFilterChips().map((chip) => (
                <span
                  key={chip.id}
                  className="bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-200 rounded-full px-3 py-1 text-sm flex items-center gap-1 cursor-pointer transition-colors"
                  onClick={chip.onRemove}
                >{chip.label}<X className="w-3 h-3 ml-1" /></span>
              ))}
              <span
                className="bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-full px-3 py-1 text-sm flex items-center gap-1 cursor-pointer transition-colors"
                onClick={clearAllFilters}
              >Pulisci tutto<X className="w-3 h-3 ml-1" /></span>
            </div>
          )}
        </div>

        {/* Pagination Controls - Above Customer List */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 py-4 border-t border-gray-200">
          <div className="text-sm text-gray-600 hidden sm:block">
            {customersQuery.isLoading ? (
              'Caricamento...'
            ) : (
              `Pagina ${page}${customers.length ? ` • Mostrati ${customers.length} clienti` : ''}`
            )}
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm text-gray-600">Per pagina</span>
              <Select value={String(limit)} onValueChange={(v) => { setLimit(parseInt(v)); setPage(1); }}>
                <SelectTrigger className="w-24 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => page > 1 && setPage(page - 1)} 
                    aria-disabled={page === 1} 
                    className={`px-3 ${page === 1 ? 'pointer-events-none opacity-50' : ''}`} 
                  >
                    Precedente
                  </PaginationPrevious>
                </PaginationItem>
                {/* Current page number - mobile only */}
                <PaginationItem className="sm:hidden">
                  <span className="px-3 select-none">{page}</span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => hasNextPage && setPage(page + 1)} 
                    aria-disabled={!hasNextPage} 
                    className={`px-3 ${!hasNextPage ? 'pointer-events-none opacity-50' : ''}`} 
                  >
                    Successivo
                  </PaginationNext>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>

        {/* Customer List */}
        <div className="space-y-4">
          {customersQuery.isLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-600">Caricamento clienti...</div>
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-600">
                {hasActiveFilters || searchTerm ? 
                  "Nessun cliente corrisponde ai parametri di filtro. 🙂" : 
                  "Nessun cliente registrato."
                }
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {customers.map((customer: UserType) => (
                <div key={customer.id}>
                  <CustomerListItem customer={customer} onSelect={setSelectedCustomer} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination Controls - Below Customer List */}
        {!customersQuery.isLoading && customers.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 py-4 border-t border-gray-200">
            <div className="text-sm text-gray-600 hidden sm:block">
              Pagina {page}{customers.length ? ` • Mostrati ${customers.length} clienti` : ''}
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => page > 1 && setPage(page - 1)} 
                    aria-disabled={page === 1} 
                    className={`px-3 ${page === 1 ? 'pointer-events-none opacity-50' : ''}`} 
                  >
                    Precedente
                  </PaginationPrevious>
                </PaginationItem>
                {/* Current page number - mobile only */}
                <PaginationItem className="sm:hidden">
                  <span className="px-3 select-none">{page}</span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => hasNextPage && setPage(page + 1)} 
                    aria-disabled={!hasNextPage} 
                    className={`px-3 ${!hasNextPage ? 'pointer-events-none opacity-50' : ''}`} 
                  >
                    Successivo
                  </PaginationNext>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

        <CustomerDetailDialog
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onAddStamps={handleAddStamps}
          onRedeemCoupon={handleRedeem}
          onDelete={handleDelete}
          redeemState={{ pending: isFetchingCoupons || redeemCouponMutation.isPending }}
          deleteState={{ pending: deleteCustomerMutation.isPending }}
        />

        <Dialog open={!!couponSelection} onOpenChange={(open) => { if (!open) setCouponSelection(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Seleziona il coupon da riscattare</DialogTitle>
              <DialogDescription>Scegli quale premio consegnare al cliente.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {couponSelection?.coupons.map((coupon) => (
                <Button
                  key={coupon.id ?? coupon.code}
                  variant="outline"
                  className="w-full justify-between"
                  disabled={redeemCouponMutation.isPending}
                  onClick={() => redeemCouponMutation.mutate({ coupon, customer: couponSelection.customer })}
                >
                  <span className="text-left">
                    <span className="block font-medium">{coupon.prize?.name ?? 'Coupon'}</span>
                    <span className="block text-xs text-gray-500">Codice: {coupon.code}</span>
                  </span>
                  <Gift className="w-4 h-4 text-green-600" />
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}