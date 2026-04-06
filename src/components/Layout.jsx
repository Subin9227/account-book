import { Outlet, NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: '홈', icon: '🏠' },
  { to: '/upload', label: '영수증', icon: '📷' },
  { to: '/history', label: '내역', icon: '📋' },
  { to: '/price', label: '가격', icon: '📊' },
  { to: '/budget', label: '예산', icon: '💰' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <main className="max-w-lg mx-auto px-4 pt-6">
        <Outlet />
      </main>

      {/* 하단 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-lg mx-auto flex justify-around">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 px-3 text-xs ${
                  isActive ? 'text-blue-600 font-bold' : 'text-gray-500'
                }`
              }
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
