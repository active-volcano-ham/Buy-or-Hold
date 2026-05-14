import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rolling 3-day retention for historical/log data only.
// User-saved settings (stocks, products, target prices, tickers, URLs, push_subscriptions) are NEVER touched.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { count: stockHist, error: e1 } = await supabase
      .from("stock_price_history")
      .delete({ count: "exact" })
      .lt("checked_at", cutoff);
    if (e1) console.error("stock_price_history purge failed:", e1);

    const { count: priceHist, error: e2 } = await supabase
      .from("price_history")
      .delete({ count: "exact" })
      .lt("checked_at", cutoff);
    if (e2) console.error("price_history purge failed:", e2);

    // Stale FX rows beyond retention (keeps current row since it's upserted hourly).
    const { count: fxOld, error: e3 } = await supabase
      .from("fx_rates")
      .delete({ count: "exact" })
      .lt("fetched_at", cutoff);
    if (e3) console.error("fx_rates purge failed:", e3);

    return new Response(
      JSON.stringify({
        success: true,
        cutoff,
        deleted: { stock_price_history: stockHist ?? 0, price_history: priceHist ?? 0, fx_rates: fxOld ?? 0 },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("purge-old-data error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
