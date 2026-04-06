-- Storage RLS 정책: receipts 버킷에 누구나 업로드/읽기 허용
CREATE POLICY "allow_upload_receipts" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "allow_read_receipts" ON storage.objects
  FOR SELECT USING (bucket_id = 'receipts');

-- 생활용품에 중분류 추가
INSERT INTO categories_medium (large_id, name) VALUES
  (2, '생리용품');
