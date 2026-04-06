import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function HomePage() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [categoryBreakdown, setCategoryBreakdown] = useState([])
  const [budget, setBudget] = useState(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    loadData()
  }, [month])

  const loadData = async () => {
    setLoading(true)
    const startDate = `${month}-01`
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`

    // 영수증 합계
    const { data: receipts } = await supabase
      .from('receipts')
      .select('total_amount')
      .gte('purchased_at', startDate)
      .lte('purchased_at', endDate)

    const totalSpent = receipts?.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0
    const receiptCount = receipts?.length || 0
    setSummary({ totalSpent, receiptCount })

    // 카테고리별 지출 — 뷰 대신 직접 조회
    const { data: items } = await supabase
      .from('items')
      .select(`
        price, quantity,
        categories_large(name),
        categories_medium(name),
        receipts!inner(purchased_at)
      `)
      .gte('receipts.purchased_at', startDate)
      .lte('receipts.purchased_at', endDate)

    // 카테고리별 집계
    const catMap = {}
    items?.forEach((item) => {
      const large = item.categories_large?.name || '기타'
      const medium = item.categories_medium?.name || '기타'
      const key = `${large}|${medium}`
      if (!catMap[key]) {
        catMap[key] = { category_large: large, category_medium: medium, total_spent: 0, item_count: 0 }
      }
      catMap[key].total_spent += item.price * (item.quantity || 1)
      catMap[key].item_count += 1
    })
    const catList = Object.values(catMap).sort((a, b) => b.total_spent - a.total_spent)
    setCategoryBreakdown(catList)

    // 예산
    const { data: budgetData } = await supabase
      .from('budgets')
      .select('*')
      .eq('year_month', month)
      .maybeSingle()

    setBudget(budgetData)
    setLoading(false)
  }

  const changeMonth = (direction) => {
    const [y, m] = month.split('-').map(Number)
    const date = new Date(y, m - 1 + direction)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  const budgetPercent = budget && summary ? Math.round((summary.totalSpent / budget.amount) * 100) : null

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">우리집 가계부</h1>

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

      {loading ? (
        <p className="text-center text-gray-400 py-12">불러오는 중...</p>
      ) : (
        <>
          {/* 총 지출 */}
          <div className="bg-white border rounded-lg p-5 mb-4 text-center">
            <p className="text-sm text-gray-500 mb-1">총 지출</p>
            <p className="text-3xl font-bold text-blue-700">
              {summary.totalSpent.toLocaleString()}원
            </p>
            <p className="text-sm text-gray-400 mt-1">{summary.receiptCount}건의 영수증</p>

            {budget && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>예산 {budget.amount.toLocaleString()}원</span>
                  <span>{budgetPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      budgetPercent > 100 ? 'bg-red-500' : budgetPercent > 80 ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(budgetPercent, 100)}%` }}
                  />
                </div>
                {budgetPercent > 100 && (
                  <p className="text-xs text-red-500 mt-1">
                    예산 초과 {(summary.totalSpent - budget.amount).toLocaleString()}원
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 카테고리별 지출 */}
          <div className="bg-white border rounded-lg p-4 mb-4">
            <h2 className="font-bold mb-3">카테고리별 지출</h2>
            {categoryBreakdown.length > 0 ? (
              <div className="space-y-2">
                {categoryBreakdown.map((cat, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${getCategoryColor(cat.category_large)}`}>
                        {cat.category_large}
                      </span>
                      <span className="text-sm">{cat.category_medium}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold">{cat.total_spent.toLocaleString()}원</span>
                      <span className="text-xs text-gray-400 ml-1">({cat.item_count}건)</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">이 달의 지출 내역이 없습니다.</p>
            )}
          </div>

          {/* 빠른 액션 */}

          <button
            onClick={() => navigate('/upload')}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            📷 영수증 등록하기
          </button>
        </>
      )}
    </div>
  )
}

function getCategoryColor(large) {
  switch (large) {
    case '식료품': return 'bg-blue-100 text-blue-700'
    case '생활용품': return 'bg-red-100 text-red-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}
