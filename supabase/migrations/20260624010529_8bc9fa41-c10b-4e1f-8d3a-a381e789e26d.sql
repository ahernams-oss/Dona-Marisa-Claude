
-- Revoke public/anon EXECUTE on all custom SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_list_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_list_shared_with(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.find_user_by_email(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Ensure required roles still have access for RLS policy evaluation and app calls
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_list_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_list_shared_with(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO authenticated, service_role;

-- Add missing UPDATE policy on price-photos storage bucket
CREATE POLICY "Users can update own price photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'price-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'price-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
