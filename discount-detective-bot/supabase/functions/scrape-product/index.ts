import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIRECRAWL_V2 = 'https://api.firecrawl.dev/v2';

interface ScrapeResult {
  title?: string;
  image_url?: string;
  current_price?: number;
  original_price?: number;
  site_name?: string;
  currency?: string;
}

async function scrapeWithFirecrawl(url: string): Promise<ScrapeResult> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY not configured');

  const schema = {
    type: "object",
    properties: {
      title: { type: "string", description: "Product name/title" },
      image_url: { type: "string", description: "Main product image URL (absolute)" },
      current_price: { type: "number", description: "Current selling price as a plain number, no currency symbol" },
      original_price: { type: "number", description: "Original/list price before discount, as a plain number. Same as current_price if no discount." },
      site_name: { type: "string", description: "Shopping site name e.g. Coupang, Amazon, 11Street" },
      currency: { type: "string", description: "ISO currency code e.g. KRW, USD" },
    },
    required: ["title", "current_price"],
  };

  const res = await fetch(`${FIRECRAWL_V2}/scrape`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      formats: [{ type: 'json', schema }],
      onlyMainContent: false,
      waitFor: 1500,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Firecrawl failed [${res.status}]: ${JSON.stringify(data)}`);

  const meta = data?.data?.metadata ?? data?.metadata ?? {};
  if (meta.statusCode === 404 || meta.statusCode === 410) {
    const err: any = new Error('PAGE_NOT_FOUND');
    err.code = 'PAGE_NOT_FOUND';
    throw err;
  }

  const j = data?.data?.json ?? data?.json ?? {};
  return {
    title: j.title ?? meta.title,
    image_url: j.image_url ?? meta.ogImage,
    current_price: typeof j.current_price === 'number' ? j.current_price : Number(j.current_price),
    original_price: typeof j.original_price === 'number' ? j.original_price : Number(j.original_price ?? j.current_price),
    site_name: j.site_name ?? new URL(url).hostname.replace('www.', ''),
    currency: j.currency ?? 'KRW',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { url, device_id } = await req.json();
    if (!url || !device_id) {
      return new Response(JSON.stringify({ error: 'url and device_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const scraped = await scrapeWithFirecrawl(url);
    if (!scraped.current_price || isNaN(scraped.current_price)) {
      return new Response(JSON.stringify({ error: 'Could not extract price from this page' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: product, error } = await supabase.from('products').insert({
      device_id,
      url,
      title: scraped.title,
      image_url: scraped.image_url,
      current_price: scraped.current_price,
      original_price: scraped.original_price ?? scraped.current_price,
      site_name: scraped.site_name,
      currency: scraped.currency ?? 'KRW',
      last_checked_at: new Date().toISOString(),
    }).select().single();

    if (error) throw error;

    await supabase.from('price_history').insert({
      product_id: product.id,
      price: scraped.current_price,
    });

    return new Response(JSON.stringify({ success: true, product }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('scrape-product error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
