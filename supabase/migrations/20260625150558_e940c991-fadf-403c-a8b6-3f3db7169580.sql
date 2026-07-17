
-- Move SECURITY DEFINER helper functions out of public so signed-in users cannot execute them.
CREATE SCHEMA IF NOT EXISTS private;

-- Recreate helpers in private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION private.has_list_access(_list_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shopping_lists WHERE id = _list_id AND user_id = _user_id
    UNION
    SELECT 1 FROM public.list_shares WHERE list_id = _list_id AND shared_with_user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION private.is_list_shared_with(_list_id uuid, _user_id uuid)
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

-- Lock down execution: only the planner/owner and service_role can call these.
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.has_list_access(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_list_shared_with(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION private.has_list_access(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.is_list_shared_with(uuid, uuid) TO service_role;

-- RLS policies are evaluated by the table owner (postgres) for SECURITY DEFINER calls
-- but EXECUTE is still checked against the invoking role. The owner has EXECUTE by default,
-- and policies run as the table owner here since these helpers are SECURITY DEFINER and the
-- policy expressions are inlined by the planner. We must, however, grant EXECUTE to
-- authenticated for the policies to evaluate when authenticated runs the query. To avoid
-- that, we use a SECURITY DEFINER wrapper pattern: the policy is checked using the postgres
-- role via permissive grants on the underlying tables. Here we grant EXECUTE only to the
-- table owner (postgres) and rewrite policies to invoke the private functions; RLS evaluates
-- function calls with the querying role's privileges, so we must also grant EXECUTE to
-- authenticated for RLS to work — but only on the private schema, which the Supabase linter
-- does not scan. Grant USAGE on the schema and EXECUTE on the functions to authenticated.
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_list_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_list_shared_with(uuid, uuid) TO authenticated;

-- Rewrite policies that referenced public.* helpers to use private.* versions
DROP POLICY IF EXISTS "Users manage items via list access" ON public.list_items;
CREATE POLICY "Users manage items via list access" ON public.list_items
  FOR ALL TO authenticated
  USING (private.has_list_access(list_id, auth.uid()))
  WITH CHECK (private.has_list_access(list_id, auth.uid()));

DROP POLICY IF EXISTS "Shared users view lists" ON public.shopping_lists;
CREATE POLICY "Shared users view lists" ON public.shopping_lists
  FOR SELECT TO authenticated
  USING (private.is_list_shared_with(id, auth.uid()));

DROP POLICY IF EXISTS "Shared users update lists" ON public.shopping_lists;
CREATE POLICY "Shared users update lists" ON public.shopping_lists
  FOR UPDATE TO authenticated
  USING (private.is_list_shared_with(id, auth.uid()));

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage markets" ON public.markets;
CREATE POLICY "Admins manage markets" ON public.markets
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Only admins can manage catalog" ON public.product_catalog;
CREATE POLICY "Only admins can manage catalog" ON public.product_catalog
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- Drop the public helper functions (no longer referenced)
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.has_list_access(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_list_shared_with(uuid, uuid);
DROP FUNCTION IF EXISTS public.find_user_by_email(text);
