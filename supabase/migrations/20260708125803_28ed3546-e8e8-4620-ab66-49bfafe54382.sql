
CREATE POLICY "Anyone can read people photos" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'people-photos');
CREATE POLICY "Anyone can upload people photos" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'people-photos');
CREATE POLICY "Anyone can update people photos" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'people-photos') WITH CHECK (bucket_id = 'people-photos');
CREATE POLICY "Anyone can delete people photos" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'people-photos');
