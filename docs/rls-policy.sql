-- RLS 정책: 모든 테이블에 대해 anon 키로 자유롭게 접근 허용
-- (가족용 비공개 앱이므로 인증 없이 사용)

-- receipts
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_receipts" ON receipts FOR ALL USING (true) WITH CHECK (true);

-- items
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_items" ON items FOR ALL USING (true) WITH CHECK (true);

-- budgets
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_budgets" ON budgets FOR ALL USING (true) WITH CHECK (true);

-- categories_large
ALTER TABLE categories_large ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_categories_large" ON categories_large FOR ALL USING (true) WITH CHECK (true);

-- categories_medium
ALTER TABLE categories_medium ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_categories_medium" ON categories_medium FOR ALL USING (true) WITH CHECK (true);

-- 중분류 추가
INSERT INTO categories_medium (large_id, name) VALUES
  (1, '면/국수'),
  (1, '밀키트'),
  (1, '주류');
