import { useState } from 'react'

const PASSWORD = '우리집9227'

export default function LockScreen({ onUnlock }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input === PASSWORD) {
      sessionStorage.setItem('unlocked', 'true')
      onUnlock()
    } else {
      setError(true)
      setInput('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8 w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold mb-2">우리집 가계부</h1>
        <p className="text-gray-500 text-sm mb-6">비밀번호를 입력하세요</p>

        <input
          type="password"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false) }}
          placeholder="비밀번호"
          className="w-full px-4 py-3 border rounded-lg text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          autoFocus
        />

        {error && (
          <p className="text-red-500 text-sm mb-3">비밀번호가 틀렸습니다.</p>
        )}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
        >
          입장하기
        </button>
      </form>
    </div>
  )
}
