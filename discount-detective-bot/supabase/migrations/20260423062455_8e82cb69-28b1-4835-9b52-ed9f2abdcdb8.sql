ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unavailable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unavailable_reason text;