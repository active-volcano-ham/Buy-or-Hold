import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchYahooQuote(ticker: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  const meta = r?.meta;
  if (!meta) throw new Error("Ticker not found on Yahoo Finance");
  const price = meta.regularMarketPrice ?? null;
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? null;
  return {
    symbol: meta.symbol || ticker,
    name: meta.shortName || meta.longName || meta.symbol || ticker,
    currency: meta.currency || "USD",
    price,
    previousClose: prev,
    changePercent: price != null && prev ? ((price - prev) / prev) * 100 : null,
  };
}

// Try Yahoo Finance with KR suffixes (.KS for KOSPI, .KQ for KOSDAQ).
// If user already provided a suffix, respect it. Otherwise try .KS then .KQ.
async function fetchYahooKr(rawTicker: string) {
  const t = rawTicker.trim().toUpperCase();
  const candidates: string[] = [];
  if (t.endsWith(".KS") || t.endsWith(".KQ")) {
    candidates.push(t);
  } else {
    candidates.push(`${t}.KS`, `${t}.KQ`);
  }
  let lastErr: unknown = null;
  for (const sym of candidates) {
    try {
      const q = await fetchYahooQuote(sym);
      if (q.price != null) return q;
      lastErr = new Error(`No price for ${sym}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("KR ticker not found on Yahoo Finance");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { ticker, market, device_id } = await req.json();
    if (!ticker || !market || !device_id) {
      return new Response(JSON.stringify({ error: "Missing ticker, market, or device_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cleanTicker = String(ticker).trim().toUpperCase();
    let row: any = {
      device_id,
      ticker: cleanTicker,
      market,
    };

    try {
      const q = market === "US" ? await fetchYahooQuote(cleanTicker) : await fetchYahooKr(cleanTicker);
      row = {
        ...row,
        name: q.name,
        currency: q.currency || (market === "KR" ? "KRW" : "USD"),
        current_price: q.price,
        previous_close: q.previousClose,
        change_percent: q.changePercent,
        last_checked_at: new Date().toISOString(),
      };
    } catch (e) {
      console.error("Yahoo fetch failed:", e);
      return new Response(JSON.stringify({ error: `Failed to fetch ${cleanTicker}: ${e instanceof Error ? e.message : e}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("stocks")
      .upsert(row, { onConflict: "device_id,ticker" })
      .select()
      .single();
    if (error) throw error;

    if (row.current_price != null && data?.id) {
      await supabase.from("stock_price_history").insert({
        stock_id: data.id,
        price: row.current_price,
      });
    }

    return new Response(JSON.stringify({ stock: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
