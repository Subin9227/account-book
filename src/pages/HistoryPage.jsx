import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function HistoryPage() {
  const [receipts, setReceipts] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [items, setItems] = useState({})
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // 영수증 목록 조회
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

  // 영수증 클릭 → 품목 펼치기
  const toggleExpand = async (receiptId) => {
    if (expandedId === receiptId) {
      setExpandedId(null)
      return
    }

    setExpandedId(receiptId)

    if (!items[receiptId]) {
      const { data } = await supabase
        .from('items')
        .select(`
          *,
          categories_large(name),
          categories_medium(name)
        `)
        .eq('receipt_id', receiptId)
        .order('created_at')

      setItems((prev) => ({ ...prev, [receiptId]: data || [] }))
    }
  }

  // 월 변경
  const changeMonth = (direction) => {
    const [y, m] = month.split('-').map(Number)
    const date = new Date(y, m - 1 + direction)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  const totalSpent = receipts.reduce((sum, r) => sum + (r.total_amount || 0), 0)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">지출 내역</h1>

      {/* 월 선택 */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => changeMonth(-1)} className="p-2 text-gray-600 hover:text-black">
          ◀
        </button>
        <span className="font-medium text-lg">{month.replace('-', '년 ')}월</span>
        <button onClick={() => changeMonth(1)} className="p-2 text-gray-600 hover:text-black">
          ▶
        </button>
      </div>

      {/* 월 합계 */}
      <div className="bg-blue-50 rounded-lg p-4 mb-4 text-center">
        <p className="text-sm text-gray-600">이번 달 총 지출</p>
        <p className="text-2xl font-bold text-blue-700">{totalSpent.toLocaleString()}원</p>
        <p className="text-sm text-gray-500">{receipts.length}건</p>
      </div>

      {/* 영수증 리스트 */}
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

              {/* 품목 상세 */}
              {expandedId === receipt.id && items[receipt.id] && (
                <div className="border-t px-4 py-2 bg-gray-50">
                  {items[receipt.id].map((item) => (
                    <div key={item.id} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
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
                            100{item.unit_type === 'ml' || item.unit_type === 'L' ? 'ml' : 'g'}당 {Math.round(item.price_per_100).toLocaleString()}원
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
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
