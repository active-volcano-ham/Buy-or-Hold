import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device";

export type StockRow = {
  id: string;
  device_id: string;
  ticker: string;
  market: "US" | "KR";
  name: string | null;
  currency: string | null;
  current_price: number | null;
  previous_close: number | null;
  change_percent: number | null;
  target_buy_price: number | null;
  target_sell_price: number | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export function useStocks() {
  const deviceId = getDeviceId();
  return useQuery({
    queryKey: ["stocks", deviceId],
    queryFn: async (): Promise<StockRow[]> => {
      const { data, error } = await supabase
        .from("stocks")
        .select("*")
        .eq("device_id", deviceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StockRow[];
    },
  });
}

export function useAddStock() {
  const qc = useQueryClient();
  const deviceId = getDeviceId();
  return useMutation({
    mutationFn: async (args: { ticker: string; market: "US" | "KR" }) => {
      const { data, error } = await supabase.functions.invoke("add-stock", {
        body: { ticker: args.ticker, market: args.market, device_id: deviceId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stocks", deviceId] }),
  });
}

export function useDeleteStock() {
  const qc = useQueryClient();
  const deviceId = getDeviceId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stocks", deviceId] }),
  });
}

export type FxRatesResponse = {
  rates: Record<string, { rate: number; fetched_at: string; cached?: boolean; stale?: boolean }>;
  pair: string;
  rate: number | null;
  fetched_at: string | null;
  cached?: boolean;
};

export function useFxRate() {
  return useQuery({
    queryKey: ["fx", "rates"],
    queryFn: async (): Promise<FxRatesResponse> => {
      const { data, error } = await supabase.functions.invoke("fx-rate", { body: {} });
      if (error) throw new Error(error.message);
      return data as FxRatesResponse;
    },
    staleTime: 1000 * 60 * 60, // 1 hour, matches 24/7 hourly server refresh
    refetchInterval: 1000 * 60 * 60, // refresh hourly while app is open
    refetchOnWindowFocus: true,
    retry: 2,
    // Keep last successful data visible on transient errors
    placeholderData: (prev) => prev,
  });
}
