# 우리집 가계부

가족용 영수증 기반 가계부 웹앱. 영수증을 촬영하면 자동으로 품목을 분류하고, 가격 추이를 추적할 수 있습니다.

## 왜 만들었나

마트에서 장을 볼 때마다 **"이거 저번에 얼마였지?"**, **"이번 달에 얼마나 썼지?"** 라는 의문이 있었습니다. 기존 가계부 앱은 직접 입력이 번거롭고, 품목별 가격 비교 기능이 없었습니다.

**영수증 한 장 찍으면 자동으로 정리되고, 품목별 가격 추이까지 볼 수 있는 가계부**를 만들고 싶었습니다.

## 주요 기능

- **영수증 OCR** — 사진 촬영 → Google Vision OCR → GPT-4o-mini 자동 분류
- **수동 입력** — API 비용 없이 직접 입력 가능
- **할인/단수할인** — 품목별 할인, 단수할인 자동 인식 및 수동 입력
- **3단계 카테고리 분류** — 대분류(식료품/생활용품) > 중분류(고기/채소/...) > 품목명
- **품목 가격 비교** — 품목 검색 → 가격 추이 그래프 + 최저/최고/평균
- **월별 지출 요약** — 카테고리별 지출 현황, 월 이동
- **예산 관리** — 월별 예산 설정 및 진행률
- **내역 수정/삭제** — 저장된 품목 수정, 개별/전체 삭제
- **비밀번호 잠금** — 간단한 접근 제한
- **PWA** — 모바일에서 앱처럼 설치 가능

## 아키텍처

```
┌──────────────────────────────────────────────┐
│              클라이언트 (PWA)                   │
│          React + TailwindCSS + Recharts        │
│                  Vercel 배포                    │
└──────────┬───────────┬───────────┬────────────┘
           │           │           │
     ┌─────▼─────┐ ┌───▼───┐ ┌────▼─────┐
     │ Supabase  │ │Google │ │ OpenAI   │
     │           │ │Cloud  │ │          │
     │ - Auth    │ │Vision │ │ GPT-4o   │
     │ - Postgres│ │  API  │ │  -mini   │
     │ - Storage │ │(OCR)  │ │(분류)    │
     └───────────┘ └───────┘ └──────────┘
```

### 영수증 처리 흐름

```
📸 영수증 사진
    ↓
🔍 Google Cloud Vision API (무료 월 1,000건)
    → 텍스트 추출
    ↓
🤖 GPT-4o-mini (장당 5~10원)
    → 품목명 정규화 + 카테고리 분류 + 할인/단수할인 추출
    ↓
👤 사용자 확인/수정
    → 품목명, 가격, 할인, 용량, 카테고리 수정 가능
    ↓
💾 Supabase PostgreSQL 저장
```

## 기술 스택

| 영역 | 기술 | 선택 이유 |
|------|------|----------|
| 프론트엔드 | React + Vite | 빠른 개발, HMR |
| 스타일링 | TailwindCSS | 유틸리티 기반, 빠른 UI 구성 |
| 차트 | Recharts | React 네이티브 차트 라이브러리 |
| 백엔드/DB | Supabase (PostgreSQL) | 무료 티어, Auth + DB + Storage 통합 |
| OCR | Google Cloud Vision API | 한국어 영수증 인식 정확도 높음, 월 1,000건 무료 |
| 텍스트 분류 | OpenAI GPT-4o-mini | 저렴한 비용으로 품목 분류 + 할인 추출 |
| 배포 | Vercel | GitHub 연동 자동 배포, 무료 |

## 비용

| 항목 | 비용 |
|------|------|
| Supabase | 무료 (DB 500MB, Storage 1GB) |
| Google Vision | 무료 (월 1,000건) |
| GPT-4o-mini | 영수증 1장당 약 5~10원 |
| Vercel | 무료 |
| **월 예상 비용** | **150~600원** (월 30~60장 기준) |

## 개발 기간

- **2026년 4월 4일 ~ 4월 6일 (3일)**
- Claude Code와 페어 프로그래밍으로 개발

## 프로젝트 구조

```
src/
├── components/
│   ├── Layout.jsx          # 하단 네비게이션 레이아웃
│   └── LockScreen.jsx      # 비밀번호 잠금 화면
├── pages/
│   ├── HomePage.jsx        # 월별 지출 요약 + 카테고리별 현황
│   ├── UploadPage.jsx      # 영수증 촬영/수동 입력
│   ├── HistoryPage.jsx     # 지출 내역 리스트 + 수정/삭제
│   ├── PricePage.jsx       # 품목 가격 비교 그래프
│   └── BudgetPage.jsx      # 월별 예산 관리
├── lib/
│   ├── supabase.js         # Supabase 클라이언트
│   ├── ocr.js              # Google Vision OCR
│   └── gpt.js              # GPT-4o-mini 영수증 파싱
├── App.jsx                 # 라우터 + 비밀번호 잠금
├── main.jsx
└── index.css               # TailwindCSS
```

## DB 스키마

```
categories_large (대분류: 식료품, 생활용품, 기타)
  └── categories_medium (중분류: 과일, 채소, 고기, ...)

receipts (영수증: 매장명, 날짜, 총액, 이미지)
  └── items (품목: 품목명, 가격, 할인, 용량, 카테고리)

budgets (월별 예산)
```

## 환경 변수

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_OPENAI_API_KEY=your-openai-api-key
VITE_GOOGLE_CLOUD_API_KEY=your-google-cloud-api-key
```

## 추후 개선 예정

### 기능 추가
- [ ] 영수증 품목 추가 — OCR 분석 후 누락된 품목을 수동으로 추가할 수 있는 "품목 추가" 버튼
- [ ] 입금 관리 — 생활비 입금 여부 체크 (입금 받음/미입금 상태 관리)
- [ ] 품목 검색 개선 — 포함 검색으로 "소면" 검색 시 "홋카이도산 소면", "오뚜기 소면" 모두 표시
- [ ] 장보기 목록 — 사야 할 품목 메모 기능
- [ ] 월별 지출 비교 — 이번 달 vs 지난 달 비교 그래프
- [ ] 카테고리별 예산 — 고기에 얼마, 과일에 얼마 등 세부 예산
- [ ] 데이터 내보내기 — CSV/엑셀로 내보내기

### 개선 사항
- [ ] 보안 강화 — Supabase Auth를 활용한 로그인 방식으로 전환
- [ ] API 키 보호 — 프론트엔드에서 API 키 노출 방지 (Supabase Edge Functions 활용)
- [ ] 100g당 단가 비교 — 같은 품목의 용량별 단가 비교 시각화
- [ ] OCR 정확도 향상 — 영수증 이미지 전처리 (회전 보정, 대비 조절)
- [ ] 오프라인 지원 — PWA Service Worker로 오프라인에서도 내역 조회
