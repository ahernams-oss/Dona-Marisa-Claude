
GRANT EXECUTE ON FUNCTION public.has_list_access(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_list_shared_with(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO authenticated;
