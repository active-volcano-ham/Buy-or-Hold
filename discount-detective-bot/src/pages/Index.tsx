import { useState } from "react";
import { AddProductForm } from "@/components/AddProductForm";
import { ProductCard } from "@/components/ProductCard";
import { PriceTargetDialog } from "@/components/PriceTargetDialog";
import { PushBanner } from "@/components/PushBanner";
import { StockCard } from "@/components/StockCard";
import { StockTargetDialog } from "@/components/StockTargetDialog";
import { AddStockForm } from "@/components/AddStockForm";
import { useProducts, Product } from "@/hooks/useProducts";
import { useStocks, useFxRate, StockRow } from "@/hooks/useStocks";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ShoppingBag, LineChart, ArrowRightLeft } from "lucide-react";

const Index = () => {
  useRealtimeSync();
  const { data: products, isLoading } = useProducts();
  const { data: stocks, isLoading: stocksLoading } = useStocks();
  const { data: fx } = useFxRate();
  const [target, setTarget] = useState<Product | null>(null);
  const [stockTarget, setStockTarget] = useState<StockRow | null>(null);
  const [tab, setTab] = useState<"shopping" | "stocks">("shopping");

  const usStocks = (stocks ?? []).filter((s) => s.market === "US");
  const krStocks = (stocks ?? []).filter((s) => s.market === "KR");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Buy or Hold</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "shopping" | "stocks")}>
          <TabsList className="grid w-full grid-cols-2 h-11 rounded-xl bg-muted p-1">
            <TabsTrigger value="shopping" className="rounded-lg text-sm gap-1.5">
              <ShoppingBag className="h-4 w-4" /> Shopping
            </TabsTrigger>
            <TabsTrigger value="stocks" className="rounded-lg text-sm gap-1.5">
              <LineChart className="h-4 w-4" /> Stocks
            </TabsTrigger>
          </TabsList>

          <div className="relative overflow-hidden mt-4">
            <TabsContent
              value="shopping"
              className="space-y-6 mt-0 data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-left-4 data-[state=active]:duration-300"
            >
              <AddProductForm />
              <PushBanner />

              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !products || products.length === 0 ? (
                <div className="text-center py-16 bg-card border border-dashed border-border rounded-2xl">
                  <div className="text-4xl mb-2">🛍️</div>
                  <p className="text-sm text-muted-foreground">상품 URL을 붙여넣어 첫 추적을 시작해보세요</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {products.map((p) => (
                    <ProductCard key={p.id} product={p} onSetTarget={setTarget} />
                  ))}
                </div>
              )}

              <p className="text-[10px] text-muted-foreground text-center px-1 pt-2 leading-snug">
                <span className="font-medium">Batch Schedule</span> · Shopping: Daily Update at 07:00 KST
              </p>
            </TabsContent>

            <TabsContent
              value="stocks"
              className="space-y-4 mt-0 data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-right-4 data-[state=active]:duration-300"
            >
              {/* FX rates banner */}
              <div className="rounded-2xl border border-border bg-gradient-to-r from-primary/10 to-primary/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">환율 (KRW)</p>
                  <p className="ml-auto text-[10px] text-muted-foreground">
                    {fx?.fetched_at ? new Date(fx.fetched_at).toLocaleTimeString() : ""}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: "USDKRW", label: "USD", symbol: "$" },
                    { key: "JPYKRW", label: "JPY", symbol: "¥" },
                    { key: "EURKRW", label: "EUR", symbol: "€" },
                  ] as const).map((p) => {
                    const r = fx?.rates?.[p.key]?.rate;
                    return (
                      <div key={p.key} className="rounded-xl bg-card/60 px-3 py-2 border border-border/50">
                        <p className="text-[10px] text-muted-foreground tracking-wide">
                          {p.symbol} {p.label} / KRW
                        </p>
                        <p className="text-sm font-bold tracking-tight">
                          {r ? `₩${r.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground text-center -mt-1 px-1 leading-snug">
                <span className="font-medium">Batch Schedule</span> · US: Every 1hr (18:00–07:00 KST) · KR: Every 1hr (08:00–16:00 KST)
              </p>

              {stocksLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {/* US column */}
                  <section className="space-y-3">
                    <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                      🇺🇸 US Stocks
                    </h2>
                    <AddStockForm market="US" />
                    {usStocks.length === 0 ? (
                      <div className="text-center py-10 bg-card border border-dashed border-border rounded-2xl">
                        <div className="text-3xl mb-1">📈</div>
                        <p className="text-xs text-muted-foreground">티커를 추가하세요</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {usStocks.map((s) => (
                          <StockCard key={s.id} stock={s} onLongPress={setStockTarget} />
                        ))}
                      </div>
                    )}
                  </section>

                  {/* KR column */}
                  <section className="space-y-3">
                    <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                      🇰🇷 KR Stocks
                    </h2>
                    <AddStockForm market="KR" />
                    {krStocks.length === 0 ? (
                      <div className="text-center py-10 bg-card border border-dashed border-border rounded-2xl">
                        <div className="text-3xl mb-1">📊</div>
                        <p className="text-xs text-muted-foreground">티커를 추가하세요</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {krStocks.map((s) => (
                          <StockCard key={s.id} stock={s} onLongPress={setStockTarget} />
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </main>

      <PriceTargetDialog
        product={target}
        open={!!target}
        onOpenChange={(v) => !v && setTarget(null)}
      />
      <StockTargetDialog
        stock={stockTarget}
        open={!!stockTarget}
        onOpenChange={(v) => !v && setStockTarget(null)}
      />
    </div>
  );
};

export default Index;
