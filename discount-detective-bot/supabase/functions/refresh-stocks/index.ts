import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

type Quote = {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  changePercent: number | null;
  currency: string | null;
  name: string | null;
};

async function fetchChartQuote(symbol: string): Promise<Quote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) {
      console.error(`Yahoo chart HTTP ${res.status} for ${symbol}`);
      return null;
    }
    const json = await res.json();
    const r = json?.chart?.result?.[0];
    if (!r) return null;
    const meta = r.meta ?? {};
    const price = meta.regularMarketPrice ?? null;
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const changePct = price != null && prev ? ((price - prev) / prev) * 100 : null;
    return {
      symbol,
      price,
      previousClose: prev,
      changePercent: changePct,
      currency: meta.currency ?? null,
      name: meta.shortName ?? meta.longName ?? symbol,
    };
  } catch (e) {
    console.error(`Yahoo fetch failed for ${symbol}:`, e);
    return null;
  }
}

// For KR tickers, try the stored ticker first. If it lacks a suffix, try .KS then .KQ.
async function fetchKrQuote(ticker: string): Promise<Quote | null> {
  const t = ticker.trim().toUpperCase();
  const candidates: string[] =
    t.endsWith(".KS") || t.endsWith(".KQ") ? [t] : [`${t}.KS`, `${t}.KQ`];
  for (const sym of candidates) {
    const q = await fetchChartQuote(sym);
    if (q && q.price != null) return q;
  }
  return null;
}

async function refreshFx(supabase: any): Promise<number | null> {
  try {
    const q = await fetchChartQuote("KRW=X");
    if (q?.price) {
      await supabase
        .from("fx_rates")
        .upsert({ pair: "USDKRW", rate: q.price, fetched_at: new Date().toISOString() }, { onConflict: "pair" });
      return q.price;
    }
  } catch (e) {
    console.error("FX refresh failed:", e);
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

    // Setup web-push (best-effort)
    let pushReady = false;
    try {
      const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY");
      const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
      let VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@example.com";
      if (!/^mailto:/i.test(VAPID_SUBJECT) && !/^https?:\/\//i.test(VAPID_SUBJECT)) {
        VAPID_SUBJECT = `mailto:${VAPID_SUBJECT}`;
      }
      if (VAPID_PUBLIC && VAPID_PRIVATE) {
        webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
        pushReady = true;
      }
    } catch (e) {
      console.error("VAPID setup failed:", e);
    }

    // FX is refreshed by its own dedicated 24/7 hourly cron (fx-rate function).
    // Skipping FX here keeps the 15-min stock batch lightweight and avoids extra Yahoo calls.

    // Determine current KST hour to scope which markets we fetch this run.
    const kstHourNow = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        hour12: false,
      }).format(new Date()),
    );
    const inUsWindowNow = kstHourNow >= 18 || kstHourNow < 7;
    const inKrWindowNow = kstHourNow >= 8 && kstHourNow < 20;

    let stocksQuery = supabase
      .from("stocks")
      .select("id, device_id, ticker, market, name, target_buy_price, target_sell_price");
    if (inUsWindowNow && !inKrWindowNow) stocksQuery = stocksQuery.eq("market", "US");
    else if (inKrWindowNow && !inUsWindowNow) stocksQuery = stocksQuery.eq("market", "KR");
    // If neither window is active (shouldn't happen with cron), fetch nothing heavy.
    else if (!inUsWindowNow && !inKrWindowNow) stocksQuery = stocksQuery.eq("market", "__none__");

    const { data: stocks, error } = await stocksQuery;
    if (error) throw error;

    let updated = 0;
    let failed = 0;
    let notified = 0;
    for (const s of stocks ?? []) {
      let q: Quote | null = null;
      try {
        if (s.market === "US") {
          q = await fetchChartQuote(s.ticker);
        } else if (s.market === "KR") {
          q = await fetchKrQuote(s.ticker);
        }
      } catch (e) {
        console.error(`Refresh failed for ${s.ticker}:`, e);
      }
      // Robust error handling: if fetch fails, keep existing "Last Updated" price untouched.
      if (!q || q.price == null) {
        failed++;
        continue;
      }
      const now = new Date().toISOString();
      const displayName = q.name || s.name || s.ticker;
      const currency = q.currency || (s.market === "KR" ? "KRW" : "USD");
      await supabase
        .from("stocks")
        .update({
          name: displayName,
          currency,
          current_price: q.price,
          previous_close: q.previousClose,
          change_percent: q.changePercent,
          last_checked_at: now,
        })
        .eq("id", s.id);
      await supabase.from("stock_price_history").insert({
        stock_id: s.id,
        price: q.price,
      });
      updated++;

      // Proximity push notifications: within ±1% of target buy/sell.
      // Only send during the market's batch window (KST):
      //   US: 18:00–07:00 KST | KR: 08:00–20:00 KST
      if (!pushReady) continue;

      const kstHour = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Seoul",
          hour: "2-digit",
          hour12: false,
        }).format(new Date()),
      );
      const inUsWindow = kstHour >= 18 || kstHour < 7;
      const inKrWindow = kstHour >= 8 && kstHour < 20;
      const inWindow = (s.market === "US" && inUsWindow) || (s.market === "KR" && inKrWindow);
      if (!inWindow) continue;

      const price = q.price;
      const fmtPrice = (n: number) =>
        currency === "KRW" ? `₩${Math.round(n).toLocaleString()}` : `$${n.toFixed(2)}`;

      const alerts: { title: string; body: string; target: number }[] = [];
      const buy = s.target_buy_price as number | null;
      const sell = s.target_sell_price as number | null;
      if (buy && buy > 0 && Math.abs(price - buy) / buy <= 0.01) {
        alerts.push({
          title: "🎯 Target Price Alert",
          body: `${displayName} is within 1% of your target price! Current: ${fmtPrice(price)} / Target: ${fmtPrice(buy)}`,
          target: buy,
        });
      }
      if (sell && sell > 0 && Math.abs(price - sell) / sell <= 0.01) {
        alerts.push({
          title: "💰 Target Price Alert",
          body: `${displayName} is within 1% of your target price! Current: ${fmtPrice(price)} / Target: ${fmtPrice(sell)}`,
          target: sell,
        });
      }
      if (alerts.length === 0) continue;

      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("device_id", s.device_id);

      for (const a of alerts) {
        const payload = JSON.stringify({ title: a.title, body: a.body, product_id: s.id });
        for (const sub of subs ?? []) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
            );
            notified++;
          } catch (e: any) {
            console.error("push send failed", sub.endpoint, e?.statusCode, e?.body);
            if (e?.statusCode === 404 || e?.statusCode === 410) {
              await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ updated, failed, notified, total: stocks?.length ?? 0 }), {
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
