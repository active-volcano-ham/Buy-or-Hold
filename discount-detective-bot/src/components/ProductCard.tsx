import { Product, useDeleteProduct, useRefreshNow } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, RefreshCw, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const ProductCard = ({
  product,
  onSetTarget,
}: {
  product: Product;
  onSetTarget: (p: Product) => void;
}) => {
  const del = useDeleteProduct();
  const refresh = useRefreshNow();

  const fmt = (n: number | null) =>
    n == null ? "—" : `${n.toLocaleString()} ${product.currency ?? "KRW"}`;

  const discount =
    product.original_price && product.current_price && product.original_price > product.current_price
      ? Math.round(((product.original_price - product.current_price) / product.original_price) * 100)
      : 0;

  const unavailableLabel =
    product.unavailable_reason === "404"
      ? "페이지 없음 (404)"
      : product.unavailable_reason === "out_of_stock"
      ? "품절"
      : "현재 구매 불가";

  return (
    <div
      className={`relative bg-card border border-border rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-all ${
        product.unavailable ? "grayscale opacity-60 hover:opacity-75" : ""
      }`}
    >
      <div className="relative aspect-square bg-muted">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.title ?? "product"}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            이미지 없음
          </div>
        )}
        {product.target_hit && (
          <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground">🎯 목표가 도달</Badge>
        )}
        {discount > 0 && (
          <Badge variant="secondary" className="absolute top-2 right-2">-{discount}%</Badge>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide truncate">
          {product.site_name ?? new URL(product.url).hostname}
        </p>
        <h3 className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">
          {product.title ?? product.url}
        </h3>

        <div className="mt-auto">
          <div className="text-lg font-bold text-foreground">{fmt(product.current_price)}</div>
          {product.original_price && product.original_price > (product.current_price ?? 0) && (
            <div className="text-xs text-muted-foreground line-through">{fmt(product.original_price)}</div>
          )}

          {(product.wish_price || product.target_discount_percent) && (
            <div className="mt-2 text-xs text-primary/80 space-y-0.5">
              {product.wish_price && <div>희망가: {product.wish_price.toLocaleString()}</div>}
              {product.target_discount_percent && <div>할인 목표: {product.target_discount_percent}%</div>}
            </div>
          )}
        </div>

        <div className="flex gap-1.5 pt-2">
          <Button size="sm" onClick={() => onSetTarget(product)} className="flex-1 rounded-lg h-8 text-xs">
            <Target className="h-3 w-3 mr-1" />목표가
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg h-8 w-8 p-0"
            onClick={async () => {
              try {
                await refresh.mutateAsync(product.id);
                toast({ title: "가격 업데이트 완료" });
              } catch (e: any) {
                toast({ title: "업데이트 실패", description: e.message, variant: "destructive" });
              }
            }}
            disabled={refresh.isPending}
          >
            <RefreshCw className={`h-3 w-3 ${refresh.isPending ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" variant="outline" className="rounded-lg h-8 w-8 p-0" asChild>
            <a href={product.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /></a>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg h-8 w-8 p-0 text-destructive hover:text-destructive"
            onClick={() => del.mutate(product.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {product.unavailable && !refresh.isPending && (
        <div className="absolute top-2 left-2 right-2 z-10 flex justify-center pointer-events-none">
          <Badge variant="secondary" className="bg-background/95 text-foreground border border-border shadow-sm">
            {unavailableLabel}
          </Badge>
        </div>
      )}

      {refresh.isPending && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm rounded-2xl">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">가격 업데이트 중…</span>
        </div>
      )}
    </div>
  );
};
