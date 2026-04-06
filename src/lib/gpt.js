const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY

/**
 * OCR 텍스트를 GPT-4o-mini로 구조화된 JSON으로 변환
 */
export async function parseReceiptText(ocrText, storeName = '') {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `너는 한국 마트 영수증 텍스트를 분석하는 전문가야.
영수증 텍스트를 받으면 아래 JSON 형식으로 품목을 추출해.

규칙:
- 같은 식재료는 하나의 품목명으로 통일 (예: "노르웨이 연어(대)", "연어회" → 품목명: "연어")
- 부위가 다르면 분리 (예: "닭가슴살", "닭똥집" → 각각 다른 품목)
- 용량/무게 정보가 상품명에 있으면 추출, 없으면 null
- 대분류: 식료품, 생활용품, 기타
- 중분류: 과일, 채소, 고기, 어류/해산물, 유제품, 음료, 간식, 양념/조미료, 냉동식품, 가공식품, 쌀/잡곡, 빵/베이커리, 면/국수, 밀키트, 주류, 두부/달걀, 견과류, 해조류, 김치/절임, 세제/청소, 위생용품, 생리용품, 주방용품, 기타
- 각 품목의 할인 금액을 반드시 추출해. 영수증에서 품목 아래에 "할인", "즉시할인", "행사할인", "쿠폰할인" 등으로 표시된 금액이 해당 품목의 discount 값이야. 할인이 없으면 0.
- 영수증 하단의 "단수할인" 금액도 반드시 추출해. 없으면 0.
- price는 할인 전 원래 가격(정가)이야. 할인 금액은 discount에 넣어.

응답 형식:
{
  "store_name": "매장명 (추출 가능하면)",
  "purchased_at": "YYYY-MM-DD (추출 가능하면)",
  "items": [
    {
      "raw_name": "영수증 원본 텍스트",
      "name": "정규화된 품목명",
      "category_large": "대분류",
      "category_medium": "중분류",
      "price": 정가 숫자,
      "discount": 할인금액 숫자,
      "quantity": 숫자,
      "unit_amount": 숫자 또는 null,
      "unit_type": "g/kg/ml/L/개/입" 또는 null
    }
  ],
  "rounding_discount": 단수할인 숫자,
  "total_amount": 최종 결제 총액 숫자
}

JSON만 응답해. 다른 텍스트 없이.`,
        },
        {
          role: 'user',
          content: `매장: ${storeName || '알 수 없음'}\n\n영수증 텍스트:\n${ocrText}`,
        },
      ],
      temperature: 0.1,
    }),
  })

  const data = await response.json()
  return JSON.parse(data.choices[0].message.content)
}
