import { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, X } from "lucide-react";
import { StockRow, useDeleteStock } from "@/hooks/useStocks";

export const StockCard = ({
  stock,
  onLongPress,
}: {
  stock: StockRow;
  onLongPress?: (s: StockRow) => void;
}) => {
  const del = useDeleteStock();
  const price = stock.current_price ?? 0;
  const change = stock.change_percent ?? 0;
  const up = change >= 0;
  const target = stock.target_buy_price;
  const targetSell = (stock as any).target_sell_price as number | null | undefined;
  const hit = target != null && price > 0 && price <= target;

  const fmt = (n: number) => {
    const cur = stock.currency ?? (stock.market === "US" ? "USD" : "KRW");
    const digits = cur === "KRW" ? 0 : 2;
    return `${n.toLocaleString(undefined, { maximumFractionDigits: digits })} ${cur}`;
  };
  const fmtShort = (n: number) => {
    const cur = stock.currency ?? (stock.market === "US" ? "USD" : "KRW");
    const digits = cur === "KRW" ? 0 : 2;
    return n.toLocaleString(undefined, { maximumFractionDigits: digits });
  };

  const isKR = stock.market === "KR";
  const noData = stock.current_price == null;
  const displayName = stock.name ?? stock.ticker;

  // Long press
  const timer = useRef<number | null>(null);
  const triggered = useRef(false);
  const start = () => {
    triggered.current = false;
    timer.current = window.setTimeout(() => {
      triggered.current = true;
      onLongPress?.(stock);
    }, 550);
  };
  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return (
    <div
      onMouseDown={start}
      onMouseUp={cancel}
      onMouseLeave={cancel}
      onTouchStart={start}
      onTouchEnd={cancel}
      onTouchCancel={cancel}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress?.(stock);
      }}
      className="relative bg-card border border-border rounded-2xl p-3 shadow-sm hover:shadow-md transition-all flex flex-col gap-2 select-none cursor-pointer"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          del.mutate(stock.id);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
        aria-label="삭제"
      >
        <X className="h-3 w-3" />
      </button>

      <div className="flex items-start justify-between pr-7 gap-1">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 leading-tight">
            <span>{stock.market === "US" ? "🇺🇸" : "🇰🇷"}</span>
            <span className="truncate">{stock.ticker}</span>
          </p>
          <h3 className="text-xs font-semibold whitespace-nowrap overflow-hidden text-ellipsis leading-tight">
            {displayName.length > 6 ? displayName.slice(0, 6) : displayName}
          </h3>
        </div>
        {!noData && (
          <Badge
            variant="secondary"
            className={`flex items-center gap-0.5 px-1.5 py-0 text-[10px] shrink-0 ${up ? "text-emerald-600" : "text-destructive"}`}
          >
            {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {up ? "+" : ""}
            {change.toFixed(2)}%
          </Badge>
        )}
      </div>

      <div>
        {noData ? (
          <div className="text-xs text-muted-foreground">
            {isKR ? "KR 시세 연동 예정" : "시세 업데이트 대기 중…"}
          </div>
        ) : (
          <div className="text-[0.5rem] font-bold tracking-tight leading-tight">{fmt(price)}</div>
        )}
        {(target != null || targetSell != null) && (
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {target != null && (
              <span className="text-primary/80">B: {fmtShort(target)}</span>
            )}
            {targetSell != null && (
              <span className="text-emerald-600">S: {fmtShort(targetSell)}</span>
            )}
          </div>
        )}
      </div>

      {hit && (
        <Badge className="absolute bottom-1.5 right-1.5 bg-primary text-primary-foreground text-[9px] px-1.5 py-0">
          🎯
        </Badge>
      )}
    </div>
  );
};
