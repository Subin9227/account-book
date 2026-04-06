import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import LockScreen from './components/LockScreen'
import HomePage from './pages/HomePage'
import UploadPage from './pages/UploadPage'
import HistoryPage from './pages/HistoryPage'
import PricePage from './pages/PricePage'
import BudgetPage from './pages/BudgetPage'

function App() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('unlocked') === 'true')

  if (!unlocked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="price" element={<PricePage />} />
          <Route path="budget" element={<BudgetPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
