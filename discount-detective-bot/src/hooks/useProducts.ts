import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device";

export type Product = {
  id: string;
  device_id: string;
  url: string;
  site_name: string | null;
  title: string | null;
  image_url: string | null;
  original_price: number | null;
  current_price: number | null;
  currency: string | null;
  wish_price: number | null;
  target_discount_percent: number | null;
  target_hit: boolean;
  target_hit_at: string | null;
  unavailable: boolean;
  unavailable_reason: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export function useProducts() {
  const deviceId = getDeviceId();
  return useQuery({
    queryKey: ["products", deviceId],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("device_id", deviceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });
}

export function useAddProduct() {
  const qc = useQueryClient();
  const deviceId = getDeviceId();
  return useMutation({
    mutationFn: async (url: string) => {
      try {
        const { data, error } = await supabase.functions.invoke("scrape-product", {
          body: { url, device_id: deviceId },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        return data;
      } catch (e: any) {
        // Scraping can take >10s; the server may have succeeded even when the
        // client sees a transport error. Verify by checking the DB before failing.
        await new Promise((r) => setTimeout(r, 1500));
        const { data: existing } = await supabase
          .from("products")
          .select("*")
          .eq("device_id", deviceId)
          .eq("url", url)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existing) return { success: true, product: existing, recovered: true };
        throw e;
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["products", deviceId] }),
  });
}

export function useUpdateTargets() {
  const qc = useQueryClient();
  const deviceId = getDeviceId();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      wish_price: number | null;
      target_discount_percent: number | null;
    }) => {
      const { error } = await supabase
        .from("products")
        .update({
          wish_price: args.wish_price,
          target_discount_percent: args.target_discount_percent,
          target_hit: false, // re-arm
          target_hit_at: null,
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", deviceId] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  const deviceId = getDeviceId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", deviceId] }),
  });
}

export function useRefreshNow() {
  const qc = useQueryClient();
  const deviceId = getDeviceId();
  return useMutation({
    mutationFn: async (productId: string) => {
      const { data, error } = await supabase.functions.invoke("refresh-prices", {
        body: { product_id: productId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async () => {
      // Force a fresh fetch from the server (not just invalidate)
      await qc.refetchQueries({ queryKey: ["products", deviceId], type: "active" });
    },
  });
}
