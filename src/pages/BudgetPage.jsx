import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function BudgetPage() {
  const [budgets, setBudgets] = useState([])
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [spent, setSpent] = useState(0)

  useEffect(() => {
    loadData()
  }, [month])

  const loadData = async () => {
    setLoading(true)

    // 예산 조회
    const { data: budgetData } = await supabase
      .from('budgets')
      .select('*')
      .eq('year_month', month)
      .single()

    if (budgetData) {
      setAmount(String(budgetData.amount))
    } else {
      setAmount('')
    }

    // 해당 월 지출 조회
    const startDate = `${month}-01`
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`

    const { data: receipts } = await supabase
      .from('receipts')
      .select('total_amount')
      .gte('purchased_at', startDate)
      .lte('purchased_at', endDate)

    setSpent(receipts?.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0)
    setLoading(false)
  }

  const handleSave = async () => {
    const numAmount = parseInt(amount)
    if (!numAmount || numAmount <= 0) return

    const { data: existing } = await supabase
      .from('budgets')
      .select('id')
      .eq('year_month', month)
      .single()

    if (existing) {
      await supabase
        .from('budgets')
        .update({ amount: numAmount })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('budgets')
        .insert({ year_month: month, amount: numAmount })
    }

    alert('예산이 저장되었습니다.')
  }

  const changeMonth = (direction) => {
    const [y, m] = month.split('-').map(Number)
    const date = new Date(y, m - 1 + direction)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  const numAmount = parseInt(amount) || 0
  const remaining = numAmount - spent
  const percent = numAmount > 0 ? Math.round((spent / numAmount) * 100) : 0

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">예산 관리</h1>

      {/* 월 선택 */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => changeMonth(-1)} className="p-2 text-gray-600 hover:text-black">
          ◀
        </button>
        <span className="font-medium text-lg">{month.replace('-', '년 ')}월</span>
        <button onClick={() => changeMonth(1)} className="p-2 text-gray-600 hover:text-black">
          ▶
        </button>
      </div>

      {/* 예산 입력 */}
      <div className="bg-white border rounded-lg p-4 mb-4">
        <label className="block text-sm text-gray-600 mb-2">월 예산 설정</label>
        <div className="flex gap-3">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="예: 500000"
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            저장
          </button>
        </div>
      </div>

      {/* 예산 현황 */}
      {numAmount > 0 && (
        <div className="bg-white border rounded-lg p-5 text-center">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500">예산</p>
              <p className="text-lg font-bold">{numAmount.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">지출</p>
              <p className="text-lg font-bold text-blue-700">{spent.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">잔여</p>
              <p className={`text-lg font-bold ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {remaining.toLocaleString()}원
              </p>
            </div>
          </div>

          {/* 진행률 바 */}
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all ${
                percent > 100 ? 'bg-red-500' : percent > 80 ? 'bg-yellow-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">{percent}% 사용</p>
        </div>
      )}
    </div>
  )
}
