ALTER TABLE public.brand_requests
  ADD COLUMN product_key text REFERENCES public.product_catalog(product_key) ON DELETE SET NULL;
