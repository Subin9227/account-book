import { useState } from 'react'
import { extractTextFromImage } from '../lib/ocr'
import { parseReceiptText } from '../lib/gpt'
import { supabase } from '../lib/supabase'

const EMPTY_ITEM = {
  raw_name: '',
  name: '',
  price: '',
  discount: '',
  quantity: 1,
  unit_amount: '',
  unit_type: '',
  category_large: '식료품',
  category_medium: '',
}

export default function UploadPage() {
  const [mode, setMode] = useState('scan') // scan | manual
  const [step, setStep] = useState('upload') // upload → processing → review → done
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [ocrText, setOcrText] = useState('')
  const [parsedData, setParsedData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 단수할인
  const [roundingDiscount, setRoundingDiscount] = useState('')

  // 수동 입력용 상태
  const [manualStore, setManualStore] = useState('')
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split('T')[0])
  const [manualItems, setManualItems] = useState([{ ...EMPTY_ITEM }])

  // 이미지 선택/촬영
  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setError('')
  }

  // OCR + GPT 처리 시작
  const handleProcess = async () => {
    if (!imageFile) return
    setLoading(true)
    setError('')
    setStep('processing')

    try {
      const text = await extractTextFromImage(imageFile)
      setOcrText(text)

      if (!text.trim()) {
        throw new Error('영수증에서 텍스트를 읽을 수 없습니다. 다시 촬영해주세요.')
      }

      const result = await parseReceiptText(text)
      const validLarge = ['식료품', '생활용품', '기타']
      result.items = result.items.map((item) => {
        const large = (item.category_large || '').trim()
        const medium = (item.category_medium || '').trim()
        return {
          ...item,
          discount: item.discount || 0,
          category_large: validLarge.includes(large) ? large : '식료품',
          category_medium: medium,
        }
      })
      // 단수할인 자동 설정
      setRoundingDiscount(result.rounding_discount ? String(result.rounding_discount) : '')
      setParsedData(result)
      setStep('review')
    } catch (err) {
      setError(err.message || '처리 중 오류가 발생했습니다.')
      setStep('upload')
    } finally {
      setLoading(false)
    }
  }

  // 스캔 모드 품목 수정
  const handleItemChange = (index, field, value) => {
    const updated = { ...parsedData }
    updated.items = [...updated.items]
    if (field === 'category_large_with_reset') {
      updated.items[index] = { ...updated.items[index], category_large: value, category_medium: '' }
    } else {
      updated.items[index] = { ...updated.items[index], [field]: value }
    }
    setParsedData(updated)
  }

  // 스캔 모드 품목 삭제
  const handleItemDelete = (index) => {
    const updated = { ...parsedData }
    updated.items = updated.items.filter((_, i) => i !== index)
    setParsedData(updated)
  }

  // 수동 입력 품목 수정
  const handleManualItemChange = (index, field, value) => {
    const updated = [...manualItems]
    if (field === 'category_large_with_reset') {
      updated[index] = { ...updated[index], category_large: value, category_medium: '' }
    } else {
      updated[index] = { ...updated[index], [field]: value }
    }
    setManualItems(updated)
  }

  // 수동 입력 품목 삭제
  const handleManualItemDelete = (index) => {
    if (manualItems.length === 1) return
    setManualItems(manualItems.filter((_, i) => i !== index))
  }

  // 수동 입력 품목 추가
  const handleManualItemAdd = () => {
    setManualItems([...manualItems, { ...EMPTY_ITEM }])
  }

  // DB에 저장 (스캔/수동 공용)
  const handleSave = async (items, storeName, purchasedAt, rounding = 0) => {
    setLoading(true)
    setError('')

    try {
      // 이미지 업로드 (스캔 모드만)
      let imageUrl = null
      if (imageFile) {
        const fileName = `${Date.now()}_${imageFile.name}`
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, imageFile)
        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(fileName)
        imageUrl = urlData.publicUrl
      }

      // 총액 계산: 단가 × 수량 - 할인 - 단수할인
      const itemsTotal = items.reduce((sum, item) => {
        const price = Number(item.price) || 0
        const quantity = Number(item.quantity) || 1
        const discount = Number(item.discount) || 0
        return sum + (price * quantity - discount)
      }, 0)
      const totalAmount = itemsTotal - (Number(rounding) || 0)

      // 영수증 저장
      const { data: receipt, error: receiptError } = await supabase
        .from('receipts')
        .insert({
          store_name: storeName || null,
          purchased_at: purchasedAt || new Date().toISOString().split('T')[0],
          total_amount: totalAmount,
          image_url: imageUrl,
          raw_ocr_text: ocrText || null,
        })
        .select()
        .single()

      if (receiptError) throw receiptError

      // 카테고리 ID 조회
      const { data: largeCats } = await supabase.from('categories_large').select('*')
      const { data: mediumCats } = await supabase.from('categories_medium').select('*')

      // 품목들 저장
      const itemsToInsert = items
        .filter((item) => item.name && Number(item.price) > 0)
        .map((item) => {
          const largeCat = largeCats?.find((c) => c.name === item.category_large)
          const mediumCat = mediumCats?.find((c) => c.name === item.category_medium)

          const quantity = Number(item.quantity) || 1
          const totalItemPrice = (Number(item.price) || 0) * quantity - (Number(item.discount) || 0)
          const actualPrice = Math.round(totalItemPrice / quantity)

          let pricePer100 = null
          if (item.unit_amount && item.unit_type) {
            const amountInBase = convertToBaseUnit(Number(item.unit_amount), item.unit_type)
            if (amountInBase) {
              pricePer100 = Math.round((actualPrice / amountInBase) * 100)
            }
          }

          return {
            receipt_id: receipt.id,
            raw_name: item.raw_name || item.name,
            name: item.name,
            category_large_id: largeCat?.id || null,
            category_medium_id: mediumCat?.id || null,
            price: actualPrice,
            quantity: Number(item.quantity) || 1,
            unit_amount: item.unit_amount ? Number(item.unit_amount) : null,
            unit_type: item.unit_type || null,
            price_per_100: pricePer100,
          }
        })

      const { error: itemsError } = await supabase.from('items').insert(itemsToInsert)
      if (itemsError) throw itemsError

      setStep('done')
    } catch (err) {
      setError(err.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 초기화
  const handleReset = () => {
    setStep('upload')
    setImageFile(null)
    setImagePreview(null)
    setOcrText('')
    setParsedData(null)
    setError('')
    setRoundingDiscount('')
    setManualStore('')
    setManualDate(new Date().toISOString().split('T')[0])
    setManualItems([{ ...EMPTY_ITEM }])
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">영수증 등록</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* 모드 탭 (완료 화면에서는 숨김) */}
      {step !== 'done' && step !== 'processing' && (
        <div className="flex mb-4 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => { setMode('scan'); setStep('upload') }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'scan' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
            }`}
          >
            📷 사진 촬영
          </button>
          <button
            onClick={() => { setMode('manual'); setStep('upload') }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'manual' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
            }`}
          >
            ✏️ 직접 입력
          </button>
        </div>
      )}

      {/* ===== 사진 촬영 모드 ===== */}
      {mode === 'scan' && (
        <>
          {step === 'upload' && (
            <div>
              <label className="block w-full cursor-pointer">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                  {imagePreview ? (
                    <img src={imagePreview} alt="영수증" className="max-h-64 mx-auto rounded" />
                  ) : (
                    <div>
                      <span className="text-4xl block mb-2">📷</span>
                      <p className="text-gray-600">영수증 사진을 촬영하거나 선택하세요</p>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>

              {imagePreview && (
                <button
                  onClick={handleProcess}
                  disabled={loading}
                  className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400"
                >
                  영수증 분석하기
                </button>
              )}
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center py-12">
              <div className="animate-spin text-4xl mb-4">⏳</div>
              <p className="text-gray-600">영수증을 분석하고 있습니다...</p>
              <p className="text-sm text-gray-400 mt-2">OCR + AI 분류 처리 중</p>
            </div>
          )}

          {step === 'review' && parsedData && (
            <div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <input
                      type="text"
                      value={parsedData.store_name || ''}
                      onChange={(e) => setParsedData({ ...parsedData, store_name: e.target.value })}
                      placeholder="매장명"
                      className="font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="date"
                      value={parsedData.purchased_at || ''}
                      onChange={(e) => setParsedData({ ...parsedData, purchased_at: e.target.value })}
                      className="block text-sm text-gray-600 bg-transparent mt-1 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <h2 className="font-bold mb-2">품목 ({parsedData.items.length}개)</h2>

              <div className="space-y-3">
                {parsedData.items.map((item, index) => (
                  <ItemCard
                    key={index}
                    item={item}
                    onChange={(field, value) => handleItemChange(index, field, value)}
                    onDelete={() => handleItemDelete(index)}
                    showRawName
                  />
                ))}
              </div>

              {/* 총 결제금액 */}
              <TotalSummary
                items={parsedData.items}
                roundingDiscount={roundingDiscount}
                onRoundingChange={setRoundingDiscount}
              />

              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleReset}
                  className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  다시 촬영
                </button>
                <button
                  onClick={() => handleSave(parsedData.items, parsedData.store_name, parsedData.purchased_at, roundingDiscount)}
                  disabled={loading}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? '저장 중...' : '저장하기'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== 직접 입력 모드 ===== */}
      {mode === 'manual' && step !== 'done' && (
        <div>
          {/* 매장 정보 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500">매장명</label>
                <input
                  type="text"
                  value={manualStore}
                  onChange={(e) => setManualStore(e.target.value)}
                  placeholder="예: 이마트, 홈플러스"
                  className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">날짜</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 품목 리스트 */}
          <h2 className="font-bold mb-2">품목 ({manualItems.length}개)</h2>

          <div className="space-y-3">
            {manualItems.map((item, index) => (
              <ItemCard
                key={index}
                item={item}
                onChange={(field, value) => handleManualItemChange(index, field, value)}
                onDelete={() => handleManualItemDelete(index)}
                canDelete={manualItems.length > 1}
              />
            ))}
          </div>

          {/* 품목 추가 버튼 */}
          <button
            onClick={handleManualItemAdd}
            className="w-full mt-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 text-sm"
          >
            + 품목 추가
          </button>

          {/* 총 결제금액 */}
          <TotalSummary
            items={manualItems}
            roundingDiscount={roundingDiscount}
            onRoundingChange={setRoundingDiscount}
          />

          {/* 저장 */}
          <button
            onClick={() => handleSave(manualItems, manualStore, manualDate, roundingDiscount)}
            disabled={loading}
            className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? '저장 중...' : '저장하기'}
          </button>
        </div>
      )}

      {/* 완료 */}
      {step === 'done' && (
        <div className="text-center py-12">
          <span className="text-5xl block mb-4">✅</span>
          <p className="text-lg font-medium mb-2">저장 완료!</p>
          <p className="text-gray-600 mb-6">영수증이 성공적으로 등록되었습니다.</p>
          <button
            onClick={handleReset}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            다른 영수증 등록하기
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * 품목 입력 카드 컴포넌트 (스캔/수동 공용)
 */
function ItemCard({ item, onChange, onDelete, canDelete = true, showRawName = false }) {
  const price = Number(item.price) || 0
  const quantity = Number(item.quantity) || 1
  const discount = Number(item.discount) || 0
  const totalBeforeDiscount = price * quantity
  const totalAfterDiscount = totalBeforeDiscount - discount

  return (
    <div className="bg-white border rounded-lg p-3 space-y-2">
      {/* 품목명 + 삭제 */}
      <div className="flex justify-between items-center">
        <input
          type="text"
          value={item.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="품목명 (예: 삼겹살)"
          className="font-medium flex-1 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none"
        />
        {canDelete && (
          <button onClick={onDelete} className="text-red-400 text-xs ml-2 hover:text-red-600">
            삭제
          </button>
        )}
      </div>
      <input
        type="text"
        value={item.raw_name || ''}
        onChange={(e) => onChange('raw_name', e.target.value)}
        placeholder="원본 상품명 (예: 오뚜기 감자면 5입)"
        className="w-full text-xs text-gray-400 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none"
      />

      {/* 가격 + 할인 + 수량 */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-gray-500">가격 (원)</label>
          <input
            type="number"
            value={item.price}
            onChange={(e) => onChange('price', e.target.value)}
            placeholder="0"
            className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500">할인 (원)</label>
          <input
            type="number"
            value={item.discount}
            onChange={(e) => onChange('discount', e.target.value)}
            placeholder="0"
            className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-red-500"
          />
        </div>
        <div className="w-16">
          <label className="text-xs text-gray-500">수량</label>
          <input
            type="number"
            value={item.quantity}
            onChange={(e) => onChange('quantity', e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 실결제가 표시 */}
      {discount > 0 && (
        <p className="text-xs text-green-600">
          {quantity > 1 && `${price.toLocaleString()} × ${quantity} = ${totalBeforeDiscount.toLocaleString()}원 → `}
          실결제가: {totalAfterDiscount.toLocaleString()}원
        </p>
      )}

      {/* 용량 */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-gray-500">용량</label>
          <input
            type="number"
            value={item.unit_amount}
            onChange={(e) => onChange('unit_amount', e.target.value)}
            placeholder="예: 300"
            className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="w-24">
          <label className="text-xs text-gray-500">단위</label>
          <select
            value={item.unit_type}
            onChange={(e) => onChange('unit_type', e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">없음</option>
            <option value="g">g</option>
            <option value="kg">kg</option>
            <option value="ml">ml</option>
            <option value="L">L</option>
            <option value="개">개</option>
            <option value="입">입</option>
          </select>
        </div>
      </div>

      {/* 카테고리 */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-gray-500">대분류</label>
          <select
            value={item.category_large}
            onChange={(e) => onChange('category_large_with_reset', e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="식료품">식료품</option>
            <option value="생활용품">생활용품</option>
            <option value="기타">기타</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500">중분류</label>
          <select
            value={item.category_medium}
            onChange={(e) => onChange('category_medium', e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">선택</option>
            {getMediumCategories(item.category_large).map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

/**
 * 총 결제금액 요약 컴포넌트
 */
function TotalSummary({ items, roundingDiscount, onRoundingChange }) {
  const totalBefore = items.reduce((sum, item) => {
    return sum + (Number(item.price) || 0) * (Number(item.quantity) || 1)
  }, 0)
  const totalItemDiscount = items.reduce((sum, item) => {
    return sum + (Number(item.discount) || 0)
  }, 0)
  const rounding = Number(roundingDiscount) || 0
  const totalDiscount = totalItemDiscount + rounding
  const totalAfter = totalBefore - totalDiscount

  return (
    <div className="bg-gray-900 text-white rounded-lg p-4 mt-4">
      <div className="flex justify-between text-sm text-gray-400 mb-1">
        <span>합계</span>
        <span>{totalBefore.toLocaleString()}원</span>
      </div>
      {totalItemDiscount > 0 && (
        <div className="flex justify-between text-sm text-red-400 mb-1">
          <span>품목 할인</span>
          <span>-{totalItemDiscount.toLocaleString()}원</span>
        </div>
      )}
      <div className="flex justify-between items-center text-sm text-red-400 mb-2">
        <span>단수할인</span>
        <div className="flex items-center gap-1">
          <span>-</span>
          <input
            type="number"
            value={roundingDiscount}
            onChange={(e) => onRoundingChange(e.target.value)}
            placeholder="0"
            className="w-20 px-2 py-0.5 bg-gray-800 border border-gray-600 rounded text-right text-red-400 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <span>원</span>
        </div>
      </div>
      <div className="border-t border-gray-700 pt-2 flex justify-between text-lg font-bold">
        <span>총 결제금액</span>
        <span>{totalAfter.toLocaleString()}원</span>
      </div>
    </div>
  )
}

function getMediumCategories(large) {
  const map = {
    '식료품': ['과일', '채소', '고기', '어류/해산물', '유제품', '음료', '간식', '양념/조미료', '냉동식품', '가공식품', '쌀/잡곡', '빵/베이커리', '면/국수', '밀키트', '주류', '두부/달걀', '견과류', '해조류', '김치/절임', '기타'],
    '생활용품': ['세제/청소', '위생용품', '생리용품', '주방용품', '기타'],
    '기타': ['기타'],
  }
  return map[large] || ['기타']
}

function convertToBaseUnit(amount, unit) {
  switch (unit?.toLowerCase()) {
    case 'g': return amount
    case 'kg': return amount * 1000
    case 'ml': return amount
    case 'l': return amount * 1000
    default: return null
  }
}
