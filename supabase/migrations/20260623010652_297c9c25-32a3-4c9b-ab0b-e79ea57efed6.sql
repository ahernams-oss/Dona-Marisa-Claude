
DROP POLICY IF EXISTS "Shared users view lists" ON public.shopping_lists;
DROP POLICY IF EXISTS "Shared users update lists" ON public.shopping_lists;

CREATE OR REPLACE FUNCTION public.is_list_shared_with(_list_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.list_shares
    WHERE list_id = _list_id AND shared_with_user_id = _user_id
  );
$$;

CREATE POLICY "Shared users view lists"
ON public.shopping_lists FOR SELECT
USING (public.is_list_shared_with(id, auth.uid()));

CREATE POLICY "Shared users update lists"
ON public.shopping_lists FOR UPDATE
USING (public.is_list_shared_with(id, auth.uid()));
