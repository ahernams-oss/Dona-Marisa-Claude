
CREATE POLICY "Authenticated can view price photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'price-photos');
CREATE POLICY "Users upload own price photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'price-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own price photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'price-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
