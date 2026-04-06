import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function HomePage() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [categoryBreakdown, setCategoryBreakdown] = useState([])
  const [budget, setBudget] = useState(null)
  const [loading, setLoading] = useState(true)

  const currentMonth = (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const startDate = `${currentMonth}-01`
    const [y, m] = currentMonth.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    const endDate = `${currentMonth}-${String(lastDay).padStart(2, '0')}`

    // 영수증 합계
    const { data: receipts } = await supabase
      .from('receipts')
      .select('total_amount')
      .gte('purchased_at', startDate)
      .lte('purchased_at', endDate)

    const totalSpent = receipts?.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0
    const receiptCount = receipts?.length || 0
    setSummary({ totalSpent, receiptCount })

    // 카테고리별 지출
    const { data: catData } = await supabase
      .from('monthly_category_summary')
      .select('*')
      .eq('year_month', currentMonth)

    setCategoryBreakdown(catData || [])

    // 예산
    const { data: budgetData } = await supabase
      .from('budgets')
      .select('*')
      .eq('year_month', currentMonth)
      .single()

    setBudget(budgetData)
    setLoading(false)
  }

  if (loading) {
    return <p className="text-center text-gray-400 py-12">불러오는 중...</p>
  }

  const budgetPercent = budget ? Math.round((summary.totalSpent / budget.amount) * 100) : null

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">우리집 가계부</h1>
      <p className="text-gray-500 mb-6">{currentMonth.replace('-', '년 ')}월</p>

      {/* 이번 달 총 지출 */}
      <div className="bg-white border rounded-lg p-5 mb-4 text-center">
        <p className="text-sm text-gray-500 mb-1">이번 달 총 지출</p>
        <p className="text-3xl font-bold text-blue-700">
          {summary.totalSpent.toLocaleString()}원
        </p>
        <p className="text-sm text-gray-400 mt-1">{summary.receiptCount}건의 영수증</p>

        {/* 예산 진행률 */}
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
      {categoryBreakdown.length > 0 && (
        <div className="bg-white border rounded-lg p-4 mb-4">
          <h2 className="font-bold mb-3">카테고리별 지출</h2>
          <div className="space-y-2">
            {categoryBreakdown.map((cat, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    {cat.category_large}
                  </span>
                  <span className="text-sm">{cat.category_medium}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold">{Number(cat.total_spent).toLocaleString()}원</span>
                  <span className="text-xs text-gray-400 ml-1">({cat.item_count}건)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 빠른 액션 */}
      <button
        onClick={() => navigate('/upload')}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
      >
        📷 영수증 등록하기
      </button>
    </div>
  )
}
