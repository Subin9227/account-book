-- ============================================
-- 가계부 앱 DB 스키마 (Supabase PostgreSQL)
-- ============================================

-- 1. 대분류 카테고리
CREATE TABLE categories_large (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE  -- 식료품, 생활용품, 기타
);

INSERT INTO categories_large (name) VALUES
  ('식료품'),
  ('생활용품'),
  ('기타');

-- 2. 중분류 카테고리
CREATE TABLE categories_medium (
  id SERIAL PRIMARY KEY,
  large_id INTEGER NOT NULL REFERENCES categories_large(id),
  name VARCHAR(50) NOT NULL,
  UNIQUE(large_id, name)
);

INSERT INTO categories_medium (large_id, name) VALUES
  -- 식료품
  (1, '과일'), (1, '채소'), (1, '고기'), (1, '어류/해산물'),
  (1, '유제품'), (1, '음료'), (1, '간식'), (1, '양념/조미료'),
  (1, '냉동식품'), (1, '가공식품'), (1, '쌀/잡곡'), (1, '빵/베이커리'),
  -- 생활용품
  (2, '세제/청소'), (2, '위생용품'), (2, '주방용품'),
  -- 기타
  (3, '기타');

-- 3. 영수증 (한 번의 장보기)
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name VARCHAR(100),          -- 매장명 (이마트, 홈플러스 등)
  purchased_at DATE NOT NULL,       -- 구매 날짜
  total_amount INTEGER,             -- 영수증 총액
  image_url TEXT,                   -- 영수증 원본 이미지 (Supabase Storage)
  raw_ocr_text TEXT,                -- Google Vision OCR 원본 텍스트
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 구매 품목 (영수증 안의 각 항목)
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,

  -- 품목 정보
  raw_name VARCHAR(200) NOT NULL,   -- 영수증 원본 텍스트 ("노르웨이 연어(대) 300g")
  name VARCHAR(100) NOT NULL,       -- 정규화된 품목명 ("연어")

  -- 분류
  category_large_id INTEGER REFERENCES categories_large(id),
  category_medium_id INTEGER REFERENCES categories_medium(id),

  -- 가격
  price INTEGER NOT NULL,           -- 총 가격
  quantity INTEGER DEFAULT 1,       -- 수량

  -- 용량 (있으면 기록, 없으면 null)
  unit_amount NUMERIC(10,2),        -- 용량 숫자 (300, 1.5 등)
  unit_type VARCHAR(20),            -- 단위 (g, kg, ml, L, 개, 입 등)
  price_per_100 NUMERIC(10,2),      -- 100g(또는 100ml)당 가격 (자동 계산)

  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. 월별 예산
CREATE TABLE budgets (
  id SERIAL PRIMARY KEY,
  year_month VARCHAR(7) NOT NULL UNIQUE,  -- "2026-04" 형식
  amount INTEGER NOT NULL,                 -- 예산 금액
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 인덱스 (검색 성능)
-- ============================================

-- 품목명으로 검색 (연어 가격 조회 등)
CREATE INDEX idx_items_name ON items(name);

-- 날짜 범위 조회 (월별 지출 등)
CREATE INDEX idx_receipts_purchased_at ON receipts(purchased_at);

-- 카테고리별 조회
CREATE INDEX idx_items_category_medium ON items(category_medium_id);

-- 영수증별 품목 조회
CREATE INDEX idx_items_receipt_id ON items(receipt_id);

-- ============================================
-- 유용한 뷰
-- ============================================

-- 품목 가격 이력 뷰 (품목명 검색 + 가격 추이용)
CREATE VIEW item_price_history AS
SELECT
  i.name AS item_name,
  i.raw_name,
  r.store_name,
  r.purchased_at,
  i.price,
  i.quantity,
  i.unit_amount,
  i.unit_type,
  i.price_per_100,
  cm.name AS category_medium,
  cl.name AS category_large
FROM items i
JOIN receipts r ON i.receipt_id = r.id
LEFT JOIN categories_medium cm ON i.category_medium_id = cm.id
LEFT JOIN categories_large cl ON i.category_large_id = cl.id
ORDER BY r.purchased_at DESC;

-- 월별 카테고리 지출 요약 뷰
CREATE VIEW monthly_category_summary AS
SELECT
  TO_CHAR(r.purchased_at, 'YYYY-MM') AS year_month,
  cl.name AS category_large,
  cm.name AS category_medium,
  SUM(i.price) AS total_spent,
  COUNT(*) AS item_count
FROM items i
JOIN receipts r ON i.receipt_id = r.id
LEFT JOIN categories_medium cm ON i.category_medium_id = cm.id
LEFT JOIN categories_large cl ON i.category_large_id = cl.id
GROUP BY TO_CHAR(r.purchased_at, 'YYYY-MM'), cl.name, cm.name
ORDER BY year_month DESC, total_spent DESC;
