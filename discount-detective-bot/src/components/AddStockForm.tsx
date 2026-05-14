import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddStock } from "@/hooks/useStocks";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus } from "lucide-react";

export const AddStockForm = ({ market }: { market: "US" | "KR" }) => {
  const [ticker, setTicker] = useState("");
  const add = useAddStock();

  const placeholder = market === "US" ? "예: AAPL, TSLA" : "예: 005930";
  const heading = market === "US" ? "🇺🇸 US Stocks" : "🇰🇷 KR Stocks";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = ticker.trim();
    if (!t) return;
    try {
      await add.mutateAsync({ ticker: t, market });
      setTicker("");
      toast({
        title: market === "US" ? "종목이 추가되었습니다 📈" : "종목이 추가되었습니다 📈",
      });
    } catch (err: any) {
      toast({ title: "추가 실패", description: err.message, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        placeholder={placeholder}
        value={ticker}
        onChange={(e) => setTicker(e.target.value)}
        className="flex-1 h-11 rounded-xl bg-card border-border uppercase text-sm"
        required
      />
      <Button type="submit" disabled={add.isPending} className="h-11 rounded-xl px-3 shrink-0">
        {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      </Button>
    </form>
  );
};
