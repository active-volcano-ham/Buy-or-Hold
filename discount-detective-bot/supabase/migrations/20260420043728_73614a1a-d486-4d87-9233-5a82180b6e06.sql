-- Products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  url TEXT NOT NULL,
  site_name TEXT,
  title TEXT,
  image_url TEXT,
  original_price NUMERIC,
  current_price NUMERIC,
  currency TEXT DEFAULT 'KRW',
  wish_price NUMERIC,
  target_discount_percent NUMERIC,
  target_hit BOOLEAN NOT NULL DEFAULT false,
  target_hit_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_device_id ON public.products(device_id);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Anyone can insert products" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update products" ON public.products FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete products" ON public.products FOR DELETE USING (true);

-- Price history
CREATE TABLE public.price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_history_product_id ON public.price_history(product_id);

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view price_history" ON public.price_history FOR SELECT USING (true);
CREATE POLICY "Anyone can insert price_history" ON public.price_history FOR INSERT WITH CHECK (true);

-- Push subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subs_device_id ON public.push_subscriptions(device_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view push_subscriptions" ON public.push_subscriptions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert push_subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update push_subscriptions" ON public.push_subscriptions FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete push_subscriptions" ON public.push_subscriptions FOR DELETE USING (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Schedule daily refresh at 07:00 KST (22:00 UTC previous day)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;