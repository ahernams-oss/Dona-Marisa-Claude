
-- 1. Add moderator to app_role enum (cannot use new value in same tx — we use text casts in policies)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';

-- 2. Helper: is staff (admin or moderator). Uses text cast to avoid referencing new enum literal in same tx.
CREATE OR REPLACE FUNCTION private.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin','moderator')
  )
$$;

GRANT EXECUTE ON FUNCTION private.is_staff(uuid) TO authenticated;

-- 3. brands table
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  normalized_name text NOT NULL UNIQUE,
  category text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brands readable by authenticated"
  ON public.brands FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff insert brands"
  ON public.brands FOR INSERT TO authenticated
  WITH CHECK (private.is_staff(auth.uid()));

CREATE POLICY "Staff update brands"
  ON public.brands FOR UPDATE TO authenticated
  USING (private.is_staff(auth.uid()))
  WITH CHECK (private.is_staff(auth.uid()));

CREATE POLICY "Staff delete brands"
  ON public.brands FOR DELETE TO authenticated
  USING (private.is_staff(auth.uid()));

CREATE TRIGGER brands_set_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX brands_normalized_name_idx ON public.brands (normalized_name);
CREATE INDEX brands_category_idx ON public.brands (category);

-- 4. brand_requests table
CREATE TABLE public.brand_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  normalized_name text NOT NULL,
  suggested_category text,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  approved_brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_requests_status_check CHECK (status IN ('pending','approved','rejected'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_requests TO authenticated;
GRANT ALL ON public.brand_requests TO service_role;
ALTER TABLE public.brand_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own brand requests"
  ON public.brand_requests FOR SELECT TO authenticated
  USING (auth.uid() = requested_by OR private.is_staff(auth.uid()));

CREATE POLICY "Users insert own brand requests"
  ON public.brand_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Staff update brand requests"
  ON public.brand_requests FOR UPDATE TO authenticated
  USING (private.is_staff(auth.uid()))
  WITH CHECK (private.is_staff(auth.uid()));

CREATE POLICY "Staff delete brand requests"
  ON public.brand_requests FOR DELETE TO authenticated
  USING (private.is_staff(auth.uid()));

CREATE TRIGGER brand_requests_set_updated_at
  BEFORE UPDATE ON public.brand_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX brand_requests_status_idx ON public.brand_requests (status);
CREATE INDEX brand_requests_requested_by_idx ON public.brand_requests (requested_by);

-- 5. Add brand_id to price_reports
ALTER TABLE public.price_reports
  ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;

CREATE INDEX price_reports_brand_id_idx ON public.price_reports (brand_id);

-- 6. Seed brands (Sem marca + ~80 marcas brasileiras comuns)
INSERT INTO public.brands (name, normalized_name, category) VALUES
  ('Sem marca', 'sem-marca', NULL),
  -- Mercearia / grãos
  ('Tio João', 'tio-joao', 'mercearia'),
  ('Camil', 'camil', 'mercearia'),
  ('Prato Fino', 'prato-fino', 'mercearia'),
  ('Tio Urbano', 'tio-urbano', 'mercearia'),
  ('Kicaldo', 'kicaldo', 'mercearia'),
  ('Caldo Bom', 'caldo-bom', 'mercearia'),
  ('Broto Legal', 'broto-legal', 'mercearia'),
  ('Yoki', 'yoki', 'mercearia'),
  ('Quaker', 'quaker', 'mercearia'),
  ('Mãe Terra', 'mae-terra', 'mercearia'),
  ('Renata', 'renata', 'mercearia'),
  ('Adria', 'adria', 'mercearia'),
  ('Barilla', 'barilla', 'mercearia'),
  ('Galo', 'galo', 'mercearia'),
  ('União', 'uniao', 'mercearia'),
  ('Cristal', 'cristal', 'mercearia'),
  ('Dona Benta', 'dona-benta', 'mercearia'),
  ('Sol', 'sol', 'mercearia'),
  ('Cisne', 'cisne', 'mercearia'),
  ('Soya', 'soya', 'mercearia'),
  ('Liza', 'liza', 'mercearia'),
  ('Sadia', 'sadia', 'mercearia'),
  ('Heinz', 'heinz', 'mercearia'),
  ('Hellmann''s', 'hellmanns', 'mercearia'),
  ('Quero', 'quero', 'mercearia'),
  ('Knorr', 'knorr', 'mercearia'),
  ('Maggi', 'maggi', 'mercearia'),
  ('Arisco', 'arisco', 'mercearia'),
  ('Pomarola', 'pomarola', 'mercearia'),
  ('Predilecta', 'predilecta', 'mercearia'),
  ('Bonduelle', 'bonduelle', 'mercearia'),
  -- Laticínios
  ('Piracanjuba', 'piracanjuba', 'laticinios'),
  ('Italac', 'italac', 'laticinios'),
  ('Parmalat', 'parmalat', 'laticinios'),
  ('Nestlé', 'nestle', 'laticinios'),
  ('Danone', 'danone', 'laticinios'),
  ('Vigor', 'vigor', 'laticinios'),
  ('Tirol', 'tirol', 'laticinios'),
  ('Elegê', 'elege', 'laticinios'),
  ('Ninho', 'ninho', 'laticinios'),
  ('Molico', 'molico', 'laticinios'),
  ('Polenghi', 'polenghi', 'laticinios'),
  ('Tirolez', 'tirolez', 'laticinios'),
  ('Catupiry', 'catupiry', 'laticinios'),
  ('Président', 'president', 'laticinios'),
  ('Quatá', 'quata', 'laticinios'),
  -- Carnes / frios
  ('Seara', 'seara', 'carnes'),
  ('Perdigão', 'perdigao', 'carnes'),
  ('Friboi', 'friboi', 'carnes'),
  ('Aurora', 'aurora', 'carnes'),
  ('Swift', 'swift', 'carnes'),
  ('Pamplona', 'pamplona', 'carnes'),
  ('Marba', 'marba', 'carnes'),
  -- Bebidas
  ('Coca-Cola', 'coca-cola', 'bebidas'),
  ('Pepsi', 'pepsi', 'bebidas'),
  ('Guaraná Antarctica', 'guarana-antarctica', 'bebidas'),
  ('Sukita', 'sukita', 'bebidas'),
  ('Fanta', 'fanta', 'bebidas'),
  ('Sprite', 'sprite', 'bebidas'),
  ('Schweppes', 'schweppes', 'bebidas'),
  ('Crystal', 'crystal', 'bebidas'),
  ('Minalba', 'minalba', 'bebidas'),
  ('Bonafont', 'bonafont', 'bebidas'),
  ('Del Valle', 'del-valle', 'bebidas'),
  ('Suvalan', 'suvalan', 'bebidas'),
  ('Tang', 'tang', 'bebidas'),
  ('Clight', 'clight', 'bebidas'),
  ('Heineken', 'heineken', 'bebidas'),
  ('Brahma', 'brahma', 'bebidas'),
  ('Skol', 'skol', 'bebidas'),
  ('Antarctica', 'antarctica', 'bebidas'),
  ('Itaipava', 'itaipava', 'bebidas'),
  -- Higiene
  ('Colgate', 'colgate', 'higiene'),
  ('Sorriso', 'sorriso', 'higiene'),
  ('Oral-B', 'oral-b', 'higiene'),
  ('Close Up', 'close-up', 'higiene'),
  ('Dove', 'dove', 'higiene'),
  ('Lux', 'lux', 'higiene'),
  ('Protex', 'protex', 'higiene'),
  ('Palmolive', 'palmolive', 'higiene'),
  ('Rexona', 'rexona', 'higiene'),
  ('Nivea', 'nivea', 'higiene'),
  ('Seda', 'seda', 'higiene'),
  ('Pantene', 'pantene', 'higiene'),
  ('Elseve', 'elseve', 'higiene'),
  ('Johnson''s', 'johnsons', 'higiene'),
  ('Sundown', 'sundown', 'higiene'),
  ('Always', 'always', 'higiene'),
  ('Sempre Livre', 'sempre-livre', 'higiene'),
  ('Pampers', 'pampers', 'higiene'),
  ('Huggies', 'huggies', 'higiene'),
  -- Limpeza
  ('Omo', 'omo', 'limpeza'),
  ('Ariel', 'ariel', 'limpeza'),
  ('Tixan Ypê', 'tixan-ype', 'limpeza'),
  ('Ypê', 'ype', 'limpeza'),
  ('Brilhante', 'brilhante', 'limpeza'),
  ('Surf', 'surf', 'limpeza'),
  ('Comfort', 'comfort', 'limpeza'),
  ('Vanish', 'vanish', 'limpeza'),
  ('Veja', 'veja', 'limpeza'),
  ('Cif', 'cif', 'limpeza'),
  ('Pinho Sol', 'pinho-sol', 'limpeza'),
  ('Bombril', 'bombril', 'limpeza'),
  ('Assolan', 'assolan', 'limpeza')
ON CONFLICT (normalized_name) DO NOTHING;

-- 7. Backfill existing price_reports with "Sem marca"
UPDATE public.price_reports pr
SET brand_id = b.id
FROM public.brands b
WHERE pr.brand_id IS NULL
  AND b.normalized_name = 'sem-marca';

-- 8. Make brand_id required going forward
ALTER TABLE public.price_reports
  ALTER COLUMN brand_id SET NOT NULL;
