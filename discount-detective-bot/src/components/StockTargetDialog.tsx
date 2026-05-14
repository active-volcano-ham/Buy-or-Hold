import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StockRow } from "@/hooks/useStocks";
import { getDeviceId } from "@/lib/device";
import { toast } from "@/hooks/use-toast";

export const StockTargetDialog = ({
  stock,
  open,
  onOpenChange,
}: {
  stock: StockRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const [buy, setBuy] = useState("");
  const [sell, setSell] = useState("");
  const qc = useQueryClient();
  const deviceId = getDeviceId();

  useEffect(() => {
    if (stock) {
      setBuy(stock.target_buy_price?.toString() ?? "");
      setSell((stock as any).target_sell_price?.toString() ?? "");
    }
  }, [stock]);

  const update = useMutation({
    mutationFn: async () => {
      if (!stock) return;
      const b = buy.trim() ? Number(buy) : null;
      const s = sell.trim() ? Number(sell) : null;
      const { error } = await supabase
        .from("stocks")
        .update({ target_buy_price: b, target_sell_price: s } as any)
        .eq("id", stock.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stocks", deviceId] });
      toast({ title: "목표가 저장됨" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  if (!stock) return null;
  const cur = stock.currency ?? (stock.market === "US" ? "USD" : "KRW");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{stock.name ?? stock.ticker} 목표가 설정</DialogTitle>
          <DialogDescription>매수/매도 희망가를 설정하세요.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="buy">매수 희망가 ({cur})</Label>
            <Input id="buy" type="number" inputMode="decimal" value={buy}
              onChange={(e) => setBuy(e.target.value)} className="rounded-xl" placeholder="예: 150" />
          </div>
          <div>
            <Label htmlFor="sell">매도 희망가 ({cur})</Label>
            <Input id="sell" type="number" inputMode="decimal" value={sell}
              onChange={(e) => setSell(e.target.value)} className="rounded-xl" placeholder="예: 180" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">취소</Button>
          <Button onClick={() => update.mutate()} disabled={update.isPending} className="rounded-xl">저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
