-- Stocks watchlist + price history
CREATE TABLE public.stocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('US','KR')),
  name TEXT,
  currency TEXT,
  current_price NUMERIC,
  previous_close NUMERIC,
  change_percent NUMERIC,
  target_buy_price NUMERIC,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(device_id, ticker)
);

ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view stocks" ON public.stocks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert stocks" ON public.stocks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update stocks" ON public.stocks FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete stocks" ON public.stocks FOR DELETE USING (true);

CREATE TRIGGER update_stocks_updated_at
BEFORE UPDATE ON public.stocks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_stocks_device ON public.stocks(device_id);
CREATE INDEX idx_stocks_market ON public.stocks(market);

CREATE TABLE public.stock_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_id UUID NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view stock_price_history" ON public.stock_price_history FOR SELECT USING (true);
CREATE POLICY "Anyone can insert stock_price_history" ON public.stock_price_history FOR INSERT WITH CHECK (true);

CREATE INDEX idx_sph_stock ON public.stock_price_history(stock_id, checked_at DESC);

-- FX rate cache (single row, USDKRW)
CREATE TABLE public.fx_rates (
  pair TEXT NOT NULL PRIMARY KEY,
  rate NUMERIC NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view fx_rates" ON public.fx_rates FOR SELECT USING (true);
CREATE POLICY "Anyone can upsert fx_rates" ON public.fx_rates FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update fx_rates" ON public.fx_rates FOR UPDATE USING (true);