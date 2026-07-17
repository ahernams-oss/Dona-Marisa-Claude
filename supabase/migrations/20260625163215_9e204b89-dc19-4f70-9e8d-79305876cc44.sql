-- Many-to-many: which brands sell each catalog product
CREATE TABLE public.product_brands (
  product_key text NOT NULL REFERENCES public.product_catalog(product_key) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_key, brand_id)
);

CREATE INDEX product_brands_brand_idx ON public.product_brands(brand_id);

GRANT SELECT ON public.product_brands TO authenticated, anon;
GRANT INSERT, DELETE ON public.product_brands TO authenticated;
GRANT ALL ON public.product_brands TO service_role;

ALTER TABLE public.product_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_brands readable by everyone"
  ON public.product_brands FOR SELECT
  USING (true);

CREATE POLICY "Staff manage product_brands insert"
  ON public.product_brands FOR INSERT
  TO authenticated
  WITH CHECK (private.is_staff(auth.uid()));

CREATE POLICY "Staff manage product_brands delete"
  ON public.product_brands FOR DELETE
  TO authenticated
  USING (private.is_staff(auth.uid()));

-- Backfill: link existing price_reports' (product_key, brand_id) pairs as associations
-- so the new picker immediately reflects what users have already reported.
INSERT INTO public.product_brands (product_key, brand_id)
SELECT DISTINCT pr.product_key, pr.brand_id
FROM public.price_reports pr
JOIN public.product_catalog pc ON pc.product_key = pr.product_key
JOIN public.brands b ON b.id = pr.brand_id
WHERE pr.brand_id IS NOT NULL
  AND b.normalized_name <> 'sem-marca'
ON CONFLICT DO NOTHING;
