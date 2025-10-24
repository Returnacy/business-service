import { useQuery } from '@tanstack/react-query';
import { fetchCoreAnalytics, fetchDailyTransactions, toOverview, toRepeatRate, toFrequency, toEconomic } from '../../api/analytics';

export function useCoreAnalytics() {
  return useQuery({
    queryKey: ['analytics:core'],
    queryFn: fetchCoreAnalytics,
  });
}

export function useOverviewMetrics() {
  const q = useCoreAnalytics();
  return { ...q, data: q.data ? toOverview(q.data) : undefined };
}

export function useRepeatRateMetrics() {
  const q = useCoreAnalytics();
  return { ...q, data: q.data ? toRepeatRate(q.data) : undefined };
}

export function useFrequencyMetrics() {
  const q = useCoreAnalytics();
  return { ...q, data: q.data ? toFrequency(q.data) : undefined };
}

export function useEconomicMetrics() {
  const q = useCoreAnalytics();
  return { ...q, data: q.data ? toEconomic(q.data) : undefined };
}

export function useDailyTransactions(days: number, enabled = true) {
  return useQuery({
    queryKey: ['analytics:daily-transactions', days],
    queryFn: () => fetchDailyTransactions(days),
    enabled,
  });
}
