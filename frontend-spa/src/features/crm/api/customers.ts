import { listCustomers, deleteCustomer } from '../../../lib/legacy-api-adapter';
import type { ListCustomersParams } from '../../../lib/legacy-api-adapter';
import type { ClientType } from '../../../types/client.d.ts';

export type { ListCustomersParams };

export async function fetchCustomers(params: ListCustomersParams): Promise<ClientType[]> {
  return listCustomers(params);
}

export async function removeCustomer(id: number | string) {
  return deleteCustomer(Number(id));
}
