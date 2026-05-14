import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Product, useUpdateTargets } from "@/hooks/useProducts";
import { toast } from "@/hooks/use-toast";

export const PriceTargetDialog = ({
  product,
  open,
  onOpenChange,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const [wish, setWish] = useState<string>("");
  const [pct, setPct] = useState<string>("");
  const update = useUpdateTargets();

  useEffect(() => {
    if (product) {
      setWish(product.wish_price?.toString() ?? "");
      setPct(product.target_discount_percent?.toString() ?? "");
    }
  }, [product]);

  if (!product) return null;

  const save = async () => {
    const w = wish.trim() ? Number(wish) : null;
    const p = pct.trim() ? Number(pct) : null;
    if (w == null && p == null) {
      toast({ title: "최소 하나는 입력해주세요", variant: "destructive" });
      return;
    }
    try {
      await update.mutateAsync({ id: product.id, wish_price: w, target_discount_percent: p });
      toast({ title: "목표가 저장됨", description: "둘 중 하나라도 도달하면 알림이 갑니다." });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>목표가 설정</DialogTitle>
          <DialogDescription>
            희망 가격 또는 목표 할인율 중 <strong>둘 중 하나라도</strong> 만족하면 푸시 알림을 보냅니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="wish">희망 가격 ({product.currency ?? "KRW"})</Label>
            <Input
              id="wish"
              type="number"
              inputMode="numeric"
              placeholder={`예: ${product.current_price ? Math.floor(product.current_price * 0.8) : 30000}`}
              value={wish}
              onChange={(e) => setWish(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="pct">목표 할인율 (%)</Label>
            <Input
              id="pct"
              type="number"
              inputMode="numeric"
              placeholder="예: 30"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              className="rounded-xl"
            />
            {product.original_price ? (
              <p className="text-xs text-muted-foreground mt-1">
                정가 {product.original_price.toLocaleString()} 기준
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">취소</Button>
          <Button onClick={save} disabled={update.isPending} className="rounded-xl">저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
