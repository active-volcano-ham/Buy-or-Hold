import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIRECRAWL_V2 = 'https://api.firecrawl.dev/v2';

type ScrapeOutcome =
  | { kind: 'ok'; price: number }
  | { kind: 'unavailable'; reason: '404' | 'out_of_stock' }
  | { kind: 'error' };

async function scrapePrice(url: string): Promise<ScrapeOutcome> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY')!;
  const schema = {
    type: "object",
    properties: {
      current_price: { type: ["number", "null"], description: "Current price as number, or null if unavailable/out of stock" },
      out_of_stock: { type: "boolean", description: "True if the product page indicates sold out / out of stock / 품절 / 일시품절 / 판매중지" },
      page_not_found: { type: "boolean", description: "True if the page is a 404 / not found / removed listing" },
    },
  };
  try {
    const res = await fetch(`${FIRECRAWL_V2}/scrape`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: [{ type: 'json', schema }], onlyMainContent: false, waitFor: 1500 }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('scrape failed', url, res.status, data);
      const status = data?.data?.metadata?.statusCode ?? data?.metadata?.statusCode;
      if (status === 404 || status === 410) return { kind: 'unavailable', reason: '404' };
      return { kind: 'error' };
    }
    const meta = data?.data?.metadata ?? data?.metadata ?? {};
    const j = data?.data?.json ?? data?.json ?? {};
    if (meta.statusCode === 404 || meta.statusCode === 410 || j.page_not_found === true) {
      return { kind: 'unavailable', reason: '404' };
    }
    if (j.out_of_stock === true) return { kind: 'unavailable', reason: 'out_of_stock' };
    const p = j.current_price;
    const num = typeof p === 'number' ? p : Number(p);
    if (p == null || isNaN(num)) {
      // No price extractable -> treat as out of stock signal
      return { kind: 'unavailable', reason: 'out_of_stock' };
    }
    return { kind: 'ok', price: num };
  } catch (e) {
    console.error('scrape exception', url, e);
    return { kind: 'error' };
  }
}

function isTargetHit(price: number, original: number | null, wish: number | null, discountPct: number | null): boolean {
  if (wish != null && price <= wish) return true;
  if (discountPct != null && original && original > 0) {
    const actualPct = ((original - price) / original) * 100;
    if (actualPct >= discountPct) return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
    let VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@example.com';
    if (!/^mailto:/i.test(VAPID_SUBJECT) && !/^https?:\/\//i.test(VAPID_SUBJECT)) {
      VAPID_SUBJECT = `mailto:${VAPID_SUBJECT}`;
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    let body: any = {};
    try { body = await req.json(); } catch (_) { /* cron has no body */ }

    let query = supabase.from('products').select('*');
    if (body?.product_id) query = query.eq('id', body.product_id);
    const { data: products, error } = await query;
    if (error) throw error;

    let checked = 0, notified = 0;

    for (const p of products ?? []) {
      const outcome = await scrapePrice(p.url);
      if (outcome.kind === 'error') continue;
      checked++;

      const nowIso = new Date().toISOString();

      if (outcome.kind === 'unavailable') {
        await supabase.from('products').update({
          unavailable: true,
          unavailable_reason: outcome.reason,
          last_checked_at: nowIso,
        }).eq('id', p.id);
        continue;
      }

      const newPrice = outcome.price;
      await supabase.from('price_history').insert({ product_id: p.id, price: newPrice });

      const hit = isTargetHit(newPrice, p.original_price, p.wish_price, p.target_discount_percent);
      const updates: any = {
        current_price: newPrice,
        last_checked_at: nowIso,
        unavailable: false,
        unavailable_reason: null,
      };

      const shouldNotify = hit && !p.target_hit;
      if (hit) {
        updates.target_hit = true;
        if (!p.target_hit) updates.target_hit_at = nowIso;
      } else if (p.target_hit) {
        updates.target_hit = false;
      }

      await supabase.from('products').update(updates).eq('id', p.id);

      if (shouldNotify) {
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('device_id', p.device_id);

        const payload = JSON.stringify({
          title: '🎯 목표가 도달!',
          body: `${p.title ?? p.site_name}: ${newPrice.toLocaleString()} ${p.currency ?? 'KRW'}`,
          url: p.url,
          product_id: p.id,
        });

        for (const s of subs ?? []) {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload,
            );
            notified++;
          } catch (e: any) {
            console.error('push send failed', s.endpoint, e?.statusCode, e?.body);
            if (e?.statusCode === 404 || e?.statusCode === 410) {
              await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, checked, notified }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('refresh-prices error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
