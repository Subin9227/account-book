import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

export default function PricePage() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selectedItem, setSelectedItem] = useState('')
  const [priceHistory, setPriceHistory] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)

  // 검색어 자동완성
  useEffect(() => {
    if (query.length < 1) {
      setSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('items')
        .select('name')
        .ilike('name', `%${query}%`)
        .limit(10)

      // 중복 제거
      const unique = [...new Set(data?.map((d) => d.name) || [])]
      setSuggestions(unique)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // 품목 선택 → 가격 이력 조회
  const selectItem = async (itemName) => {
    setSelectedItem(itemName)
    setQuery(itemName)
    setSuggestions([])
    setLoading(true)

    const { data } = await supabase
      .from('item_price_history')
      .select('*')
      .eq('item_name', itemName)
      .order('purchased_at', { ascending: true })

    if (data && data.length > 0) {
      setPriceHistory(data)

      // 통계 계산
      const prices = data.map((d) => d.price)
      const min = Math.min(...prices)
      const max = Math.max(...prices)
      const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
      const minItem = data.find((d) => d.price === min)
      const maxItem = data.find((d) => d.price === max)

      setStats({ min, max, avg, minItem, maxItem, count: data.length })
    } else {
      setPriceHistory([])
      setStats(null)
    }

    setLoading(false)
  }

  // 차트 데이터 준비
  const chartData = priceHistory.map((item) => ({
    date: item.purchased_at,
    price: item.price,
    store: item.store_name,
    pricePer100: item.price_per_100 ? Math.round(Number(item.price_per_100)) : null,
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">가격 비교</h1>

      {/* 검색 */}
      <div className="relative mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="품목명 검색 (예: 연어, 삼겹살)"
          className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border rounded-lg mt-1 shadow-lg z-10">
            {suggestions.map((name) => (
              <button
                key={name}
                onClick={() => selectItem(name)}
                className="w-full px-4 py-2 text-left hover:bg-blue-50 first:rounded-t-lg last:rounded-b-lg"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <p className="text-center text-gray-400 py-8">조회 중...</p>}

      {/* 통계 */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">최저가</p>
            <p className="text-lg font-bold text-green-700">{stats.min.toLocaleString()}원</p>
            <p className="text-xs text-gray-400">{stats.minItem.store_name}</p>
            <p className="text-xs text-gray-400">{stats.minItem.purchased_at}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">평균가</p>
            <p className="text-lg font-bold text-gray-700">{stats.avg.toLocaleString()}원</p>
            <p className="text-xs text-gray-400">{stats.count}회 구매</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">최고가</p>
            <p className="text-lg font-bold text-red-700">{stats.max.toLocaleString()}원</p>
            <p className="text-xs text-gray-400">{stats.maxItem.store_name}</p>
            <p className="text-xs text-gray-400">{stats.maxItem.purchased_at}</p>
          </div>
        </div>
      )}

      {/* 가격 추이 그래프 */}
      {chartData.length > 1 && (
        <div className="bg-white border rounded-lg p-4 mb-6">
          <h2 className="font-bold mb-3">가격 추이</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(d) => d.slice(5)} // MM-DD
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value) => [`${value.toLocaleString()}원`, '가격']}
                labelFormatter={(label) => label}
              />
              {stats && (
                <ReferenceLine y={stats.avg} stroke="#9ca3af" strokeDasharray="3 3" label="평균" />
              )}
              <Line
                type="monotone"
                dataKey="price"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 구매 이력 테이블 */}
      {priceHistory.length > 0 && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <h2 className="font-bold px-4 pt-3 pb-2">구매 이력</h2>
          {priceHistory.map((item, i) => (
            <div key={i} className="flex justify-between px-4 py-2 border-t">
              <div>
                <p className="text-sm">{item.store_name || '매장 미확인'}</p>
                <p className="text-xs text-gray-400">{item.purchased_at}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{item.price?.toLocaleString()}원</p>
                {item.price_per_100 && (
                  <p className="text-xs text-green-600">
                    100g당 {Math.round(Number(item.price_per_100)).toLocaleString()}원
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedItem && !loading && priceHistory.length === 0 && (
        <p className="text-center text-gray-400 py-8">"{selectedItem}"의 구매 내역이 없습니다.</p>
      )}
    </div>
  )
}
