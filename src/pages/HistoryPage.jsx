import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const MEDIUM_CATEGORIES = {
  '식료품': ['과일', '채소', '고기', '어류/해산물', '유제품', '음료', '간식', '양념/조미료', '냉동식품', '가공식품', '쌀/잡곡', '빵/베이커리', '면/국수', '밀키트', '주류', '두부/달걀', '견과류', '해조류', '김치/절임', '기타'],
  '생활용품': ['세제/청소', '위생용품', '생리용품', '주방용품', '기타'],
  '기타': ['기타'],
}

export default function HistoryPage() {
  const [receipts, setReceipts] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [items, setItems] = useState({})
  const [editingItemId, setEditingItemId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    loadReceipts()
  }, [month])

  const loadReceipts = async () => {
    setLoading(true)
    const startDate = `${month}-01`
    const endDate = getLastDayOfMonth(month)

    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .gte('purchased_at', startDate)
      .lte('purchased_at', endDate)
      .order('purchased_at', { ascending: false })

    if (!error) setReceipts(data || [])
    setLoading(false)
  }

  const toggleExpand = async (receiptId) => {
    if (expandedId === receiptId) {
      setExpandedId(null)
      setEditingItemId(null)
      return
    }

    setExpandedId(receiptId)
    setEditingItemId(null)

    if (!items[receiptId]) {
      await loadItems(receiptId)
    }
  }

  const loadItems = async (receiptId) => {
    const { data } = await supabase
      .from('items')
      .select(`
        *,
        categories_large(id, name),
        categories_medium(id, name)
      `)
      .eq('receipt_id', receiptId)
      .order('created_at')

    setItems((prev) => ({ ...prev, [receiptId]: data || [] }))
  }

  // 수정 시작
  const startEdit = (item) => {
    setEditingItemId(item.id)
    setEditForm({
      name: item.name,
      raw_name: item.raw_name,
      price: item.price,
      quantity: item.quantity || 1,
      unit_amount: item.unit_amount || '',
      unit_type: item.unit_type || '',
      category_large: item.categories_large?.name || '식료품',
      category_medium: item.categories_medium?.name || '',
    })
  }

  // 수정 저장
  const saveEdit = async (item) => {
    setSaving(true)

    const { data: largeCats } = await supabase.from('categories_large').select('*')
    const { data: mediumCats } = await supabase.from('categories_medium').select('*')

    const largeCat = largeCats?.find((c) => c.name === editForm.category_large)
    const mediumCat = mediumCats?.find((c) => c.name === editForm.category_medium)

    const price = Number(editForm.price) || 0
    const unitAmount = editForm.unit_amount ? Number(editForm.unit_amount) : null
    const unitType = editForm.unit_type || null

    let pricePer100 = null
    if (unitAmount && unitType) {
      const base = convertToBaseUnit(unitAmount, unitType)
      if (base) pricePer100 = Math.round((price / base) * 100)
    }

    const { error } = await supabase
      .from('items')
      .update({
        name: editForm.name,
        raw_name: editForm.raw_name,
        price: price,
        quantity: Number(editForm.quantity) || 1,
        unit_amount: unitAmount,
        unit_type: unitType,
        price_per_100: pricePer100,
        category_large_id: largeCat?.id || null,
        category_medium_id: mediumCat?.id || null,
      })
      .eq('id', item.id)

    if (!error) {
      setEditingItemId(null)
      await loadItems(item.receipt_id)
      // 총액 재계산
      await recalcReceiptTotal(item.receipt_id)
    }

    setSaving(false)
  }

  // 품목 삭제
  const deleteItem = async (item) => {
    if (!confirm('이 품목을 삭제하시겠습니까?')) return

    await supabase.from('items').delete().eq('id', item.id)
    await loadItems(item.receipt_id)
    await recalcReceiptTotal(item.receipt_id)
  }

  // 영수증 삭제
  const deleteReceipt = async (receiptId) => {
    if (!confirm('이 영수증 전체를 삭제하시겠습니까?')) return

    await supabase.from('receipts').delete().eq('id', receiptId)
    setReceipts(receipts.filter((r) => r.id !== receiptId))
    setExpandedId(null)
  }

  // 영수증 총액 재계산
  const recalcReceiptTotal = async (receiptId) => {
    const { data: receiptItems } = await supabase
      .from('items')
      .select('price, quantity')
      .eq('receipt_id', receiptId)

    const total = receiptItems?.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0) || 0

    await supabase.from('receipts').update({ total_amount: total }).eq('id', receiptId)
    setReceipts(receipts.map((r) => r.id === receiptId ? { ...r, total_amount: total } : r))
  }

  const changeMonth = (direction) => {
    const [y, m] = month.split('-').map(Number)
    const date = new Date(y, m - 1 + direction)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  const totalSpent = receipts.reduce((sum, r) => sum + (r.total_amount || 0), 0)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">지출 내역</h1>

      <div className="flex items-center justify-between mb-4">
        <button onClick={() => changeMonth(-1)} className="p-2 text-gray-600 hover:text-black">◀</button>
        <span className="font-medium text-lg">{month.replace('-', '년 ')}월</span>
        <button onClick={() => changeMonth(1)} className="p-2 text-gray-600 hover:text-black">▶</button>
      </div>

      <div className="bg-blue-50 rounded-lg p-4 mb-4 text-center">
        <p className="text-sm text-gray-600">총 지출</p>
        <p className="text-2xl font-bold text-blue-700">{totalSpent.toLocaleString()}원</p>
        <p className="text-sm text-gray-500">{receipts.length}건</p>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-8">불러오는 중...</p>
      ) : receipts.length === 0 ? (
        <p className="text-center text-gray-400 py-8">이 달의 내역이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {receipts.map((receipt) => (
            <div key={receipt.id} className="bg-white border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleExpand(receipt.id)}
                className="w-full px-4 py-3 flex justify-between items-center text-left hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium">{receipt.store_name || '매장 미확인'}</p>
                  <p className="text-sm text-gray-500">{receipt.purchased_at}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{receipt.total_amount?.toLocaleString()}원</p>
                  <span className="text-xs text-gray-400">
                    {expandedId === receipt.id ? '접기 ▲' : '펼치기 ▼'}
                  </span>
                </div>
              </button>

              {expandedId === receipt.id && items[receipt.id] && (
                <div className="border-t bg-gray-50">
                  {items[receipt.id].map((item) => (
                    <div key={item.id} className="px-4 py-3 border-b border-gray-100 last:border-0">
                      {editingItemId === item.id ? (
                        /* 수정 모드 */
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-xs text-gray-500">품목명</label>
                              <input
                                type="text"
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                className="w-full px-2 py-1 border rounded text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">원본명</label>
                            <input
                              type="text"
                              value={editForm.raw_name}
                              onChange={(e) => setEditForm({ ...editForm, raw_name: e.target.value })}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-xs text-gray-500">가격</label>
                              <input
                                type="number"
                                value={editForm.price}
                                onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                                className="w-full px-2 py-1 border rounded text-sm"
                              />
                            </div>
                            <div className="w-16">
                              <label className="text-xs text-gray-500">수량</label>
                              <input
                                type="number"
                                value={editForm.quantity}
                                onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                                className="w-full px-2 py-1 border rounded text-sm"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-xs text-gray-500">용량</label>
                              <input
                                type="number"
                                value={editForm.unit_amount}
                                onChange={(e) => setEditForm({ ...editForm, unit_amount: e.target.value })}
                                placeholder="예: 300"
                                className="w-full px-2 py-1 border rounded text-sm"
                              />
                            </div>
                            <div className="w-24">
                              <label className="text-xs text-gray-500">단위</label>
                              <select
                                value={editForm.unit_type}
                                onChange={(e) => setEditForm({ ...editForm, unit_type: e.target.value })}
                                className="w-full px-2 py-1 border rounded text-sm"
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
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-xs text-gray-500">대분류</label>
                              <select
                                value={editForm.category_large}
                                onChange={(e) => setEditForm({ ...editForm, category_large: e.target.value, category_medium: '' })}
                                className="w-full px-2 py-1 border rounded text-sm"
                              >
                                <option value="식료품">식료품</option>
                                <option value="생활용품">생활용품</option>
                                <option value="기타">기타</option>
                              </select>
                            </div>
                            <div className="flex-1">
                              <label className="text-xs text-gray-500">중분류</label>
                              <select
                                value={editForm.category_medium}
                                onChange={(e) => setEditForm({ ...editForm, category_medium: e.target.value })}
                                className="w-full px-2 py-1 border rounded text-sm"
                              >
                                <option value="">선택</option>
                                {(MEDIUM_CATEGORIES[editForm.category_large] || []).map((cat) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => setEditingItemId(null)}
                              className="flex-1 py-1.5 border rounded text-sm text-gray-600"
                            >
                              취소
                            </button>
                            <button
                              onClick={() => saveEdit(item)}
                              disabled={saving}
                              className="flex-1 py-1.5 bg-blue-600 text-white rounded text-sm disabled:bg-gray-400"
                            >
                              {saving ? '저장 중...' : '저장'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* 보기 모드 */
                        <div className="flex justify-between">
                          <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-gray-400">{item.raw_name}</p>
                            <p className="text-xs text-blue-500">
                              {item.categories_large?.name} &gt; {item.categories_medium?.name}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">{item.price?.toLocaleString()}원</p>
                            {item.price_per_100 && (
                              <p className="text-xs text-green-600">
                                100{item.unit_type === 'ml' || item.unit_type === 'L' ? 'ml' : 'g'}당 {Math.round(Number(item.price_per_100)).toLocaleString()}원
                              </p>
                            )}
                            <div className="flex gap-2 justify-end mt-1">
                              <button
                                onClick={() => startEdit(item)}
                                className="text-xs text-blue-500 hover:text-blue-700"
                              >
                                수정
                              </button>
                              <button
                                onClick={() => deleteItem(item)}
                                className="text-xs text-red-400 hover:text-red-600"
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* 영수증 삭제 */}
                  <div className="px-4 py-3 text-center">
                    <button
                      onClick={() => deleteReceipt(receipt.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      이 영수증 전체 삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function getLastDayOfMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return `${yearMonth}-${String(lastDay).padStart(2, '0')}`
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
