import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device";

/**
 * Subscribes to realtime changes on products & stocks for this device,
 * and refetches the relevant queries when the app regains focus/visibility.
 * This way the UI reflects batch-updated prices without a manual refresh.
 */
export function useRealtimeSync() {
  const qc = useQueryClient();
  const deviceId = getDeviceId();

  useEffect(() => {
    const channel = supabase
      .channel("price-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products", filter: `device_id=eq.${deviceId}` },
        () => qc.invalidateQueries({ queryKey: ["products", deviceId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stocks", filter: `device_id=eq.${deviceId}` },
        () => qc.invalidateQueries({ queryKey: ["stocks", deviceId] }),
      )
      .subscribe();

    const refetchAll = () => {
      qc.invalidateQueries({ queryKey: ["products", deviceId] });
      qc.invalidateQueries({ queryKey: ["stocks", deviceId] });
      qc.invalidateQueries({ queryKey: ["fx-rate"] });
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refetchAll();
    };
    window.addEventListener("focus", refetchAll);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", refetchAll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [qc, deviceId]);
}
