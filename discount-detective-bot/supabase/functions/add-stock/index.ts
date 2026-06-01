import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchYahooQuote(ticker: string, locale?: "kr" | "us") {
  const isKr = locale === "kr" || ticker.endsWith(".KS") || ticker.endsWith(".KQ");
  const langParam = isKr ? "&lang=ko-KR&region=KR" : "&lang=en-US&region=US";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d${langParam}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "application/json",
      "Accept-Language": isKr ? "ko-KR,ko;q=0.9,en;q=0.5" : "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  const meta = r?.meta;
  if (!meta) throw new Error("Ticker not found on Yahoo Finance");
  const price = meta.regularMarketPrice ?? null;
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? null;
  // For KR tickers, prefer longName (full Korean name) over shortName (English abbrev).
  const name = isKr
    ? (meta.longName || meta.shortName || meta.symbol || ticker)
    : (meta.shortName || meta.longName || meta.symbol || ticker);
  return {
    symbol: meta.symbol || ticker,
    name,
    currency: meta.currency || "USD",
    price,
    previousClose: prev,
    changePercent: price != null && prev ? ((price - prev) / prev) * 100 : null,
  };
}

// Fetch Korean stock name from Naver (Yahoo returns English regardless of locale).
async function fetchNaverKrName(ticker: string): Promise<string | null> {
  const code = ticker.trim().toUpperCase().replace(/\.(KS|KQ)$/i, "");
  if (!/^\d{6}$/.test(code)) return null;
  try {
    const res = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const name = json?.stockName;
    return typeof name === "string" && name.length > 0 ? name : null;
  } catch (e) {
    console.error(`Naver name fetch failed for ${ticker}:`, e);
    return null;
  }
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
      const q = await fetchYahooQuote(sym, "kr");
      if (q.price != null) {
        const krName = await fetchNaverKrName(sym);
        if (krName) q.name = krName;
        return q;
      }
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
