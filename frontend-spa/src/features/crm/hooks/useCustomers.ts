import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchCustomers, removeCustomer, ListCustomersParams } from '../api/customers';
import type { ClientType } from '../../../types/client.d.ts';

export function useCustomers(params: ListCustomersParams) {
  return useQuery({
    queryKey: ['crm:customers', params],
    queryFn: () => fetchCustomers(params),
  });
}

export function useDeleteCustomer() {
  return useMutation({
    mutationFn: (id: string | number) => removeCustomer(id),
  });
}
