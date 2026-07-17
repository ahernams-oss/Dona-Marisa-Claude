
-- Geolocalização nos mercados
ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

-- Categoria de corredor
ALTER TABLE public.list_items
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'outros';
ALTER TABLE public.price_reports
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'outros';

-- Compartilhamento de listas
CREATE TABLE IF NOT EXISTS public.list_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  shared_with_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_id, shared_with_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_shares TO authenticated;
GRANT ALL ON public.list_shares TO service_role;

ALTER TABLE public.list_shares ENABLE ROW LEVEL SECURITY;

-- Função security definer para checar se usuário tem acesso a uma lista
CREATE OR REPLACE FUNCTION public.has_list_access(_list_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shopping_lists WHERE id = _list_id AND user_id = _user_id
    UNION
    SELECT 1 FROM public.list_shares WHERE list_id = _list_id AND shared_with_user_id = _user_id
  );
$$;

-- Políticas list_shares: dono da lista gerencia, convidado vê seus próprios shares
CREATE POLICY "Owner manages list shares" ON public.list_shares
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shopping_lists l WHERE l.id = list_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shopping_lists l WHERE l.id = list_id AND l.user_id = auth.uid()));

CREATE POLICY "Invited user sees own share" ON public.list_shares
  FOR SELECT TO authenticated
  USING (shared_with_user_id = auth.uid());

-- Atualiza políticas de shopping_lists para incluir convidados
DROP POLICY IF EXISTS "Users manage own lists" ON public.shopping_lists;
CREATE POLICY "Owner manages own lists" ON public.shopping_lists
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Shared users view lists" ON public.shopping_lists
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.list_shares s WHERE s.list_id = id AND s.shared_with_user_id = auth.uid()));
CREATE POLICY "Shared users update lists" ON public.shopping_lists
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.list_shares s WHERE s.list_id = id AND s.shared_with_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.list_shares s WHERE s.list_id = id AND s.shared_with_user_id = auth.uid()));

-- Atualiza políticas de list_items para incluir convidados
DROP POLICY IF EXISTS "Users manage items of own lists" ON public.list_items;
CREATE POLICY "Users manage items via list access" ON public.list_items
  FOR ALL TO authenticated
  USING (public.has_list_access(list_id, auth.uid()))
  WITH CHECK (public.has_list_access(list_id, auth.uid()));

-- Permitir buscar usuários por e-mail para compartilhar (função security definer)
CREATE OR REPLACE FUNCTION public.find_user_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE email = lower(trim(_email)) LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_list_access(uuid, uuid) TO authenticated;
