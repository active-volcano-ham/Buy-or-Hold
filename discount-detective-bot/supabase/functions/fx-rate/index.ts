import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const PAIRS: Record<string, string> = {
  USDKRW: "KRW=X",
  JPYKRW: "JPYKRW=X",
  EURKRW: "EURKRW=X",
};

async function fetchYahooChart(symbol: string): Promise<number | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Yahoo chart HTTP ${res.status}`);
  const json = await res.json();
  return json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
}

async function fetchFallback(): Promise<Record<string, number> | null> {
  // open.er-api.com base USD
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) return null;
    const json = await res.json();
    const krw = json?.rates?.KRW;
    const jpy = json?.rates?.JPY;
    const eur = json?.rates?.EUR;
    if (!krw) return null;
    return {
      USDKRW: krw,
      JPYKRW: jpy ? krw / jpy : 0,
      EURKRW: eur ? krw / eur : 0,
    };
  } catch {
    return null;
  }
}

async function getRate(pair: string): Promise<number | null> {
  try {
    const r = await fetchYahooChart(PAIRS[pair]);
    if (r) return r;
  } catch (e) {
    console.error(`Yahoo failed for ${pair}:`, e);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const pairs = Object.keys(PAIRS);

    // Pull cached rows
    const { data: cachedRows } = await supabase
      .from("fx_rates")
      .select("pair, rate, fetched_at")
      .in("pair", pairs);
    const cachedMap = new Map<string, { rate: number; fetched_at: string }>();
    for (const r of cachedRows ?? []) cachedMap.set(r.pair, { rate: Number(r.rate), fetched_at: r.fetched_at });

    const result: Record<string, { rate: number; fetched_at: string; cached: boolean; stale?: boolean }> = {};
    const toFetch: string[] = [];

    for (const p of pairs) {
      const c = cachedMap.get(p);
      const ageMs = c ? Date.now() - new Date(c.fetched_at).getTime() : Infinity;
      if (c && ageMs < 60 * 60 * 1000) {
        result[p] = { rate: c.rate, fetched_at: c.fetched_at, cached: true };
      } else {
        toFetch.push(p);
      }
    }

    // Try Yahoo per pair
    let needFallback = false;
    for (const p of toFetch) {
      const rate = await getRate(p);
      if (rate) {
        const fetched_at = new Date().toISOString();
        await supabase.from("fx_rates").upsert({ pair: p, rate, fetched_at }, { onConflict: "pair" });
        result[p] = { rate, fetched_at, cached: false };
      } else {
        needFallback = true;
      }
    }

    // Fallback for any remaining missing
    if (needFallback) {
      const fb = await fetchFallback();
      if (fb) {
        for (const p of toFetch) {
          if (result[p]) continue;
          const rate = fb[p];
          if (rate) {
            const fetched_at = new Date().toISOString();
            await supabase.from("fx_rates").upsert({ pair: p, rate, fetched_at }, { onConflict: "pair" });
            result[p] = { rate, fetched_at, cached: false };
          }
        }
      }
    }

    // Stale cache as last resort
    for (const p of pairs) {
      if (!result[p]) {
        const c = cachedMap.get(p);
        if (c) result[p] = { rate: c.rate, fetched_at: c.fetched_at, cached: true, stale: true };
      }
    }

    // Backwards compatible top-level USDKRW fields
    const usd = result.USDKRW;
    return new Response(
      JSON.stringify({
        rates: result,
        pair: "USDKRW",
        rate: usd?.rate ?? null,
        fetched_at: usd?.fetched_at ?? null,
        cached: usd?.cached ?? false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
