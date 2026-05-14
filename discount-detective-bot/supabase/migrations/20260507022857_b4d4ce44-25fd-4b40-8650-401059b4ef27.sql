ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.stocks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stocks;