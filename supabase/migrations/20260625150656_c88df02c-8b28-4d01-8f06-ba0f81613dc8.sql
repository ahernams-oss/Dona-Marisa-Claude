
-- Make access-check helpers SECURITY INVOKER (they only query data the caller can already see via RLS)
ALTER FUNCTION private.has_role(uuid, public.app_role) SECURITY INVOKER;
ALTER FUNCTION private.has_list_access(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION private.is_list_shared_with(uuid, uuid) SECURITY INVOKER;

-- Avoid recursion: self-read on user_roles must not call has_role
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
