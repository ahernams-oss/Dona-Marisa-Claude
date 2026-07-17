-- Allow admins to update and delete any price report (needed for merging duplicates)
CREATE POLICY "Admins manage all price reports update"
  ON public.price_reports FOR UPDATE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete any price report"
  ON public.price_reports FOR DELETE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update any list item (needed for merging duplicates)
CREATE POLICY "Admins manage all list items"
  ON public.list_items FOR UPDATE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));