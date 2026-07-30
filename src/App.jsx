import { Navigate, Route, Routes } from 'react-router-dom'
import Footer from './components/Footer'
import Header from './components/Header'
import About from './pages/About'
import Contact from './pages/Contact'
import Home from './pages/Home'
import News from './pages/News'
import Team from './pages/Team'
import Trade from './pages/Trade'

export default function App() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <a href="#main-content" className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-md bg-white px-4 py-3 font-bold shadow-lg focus:translate-y-0">Skip to content</a>
      <Header />
      <div id="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/trade" element={<Trade />} />
          <Route path="/team" element={<Team />} />
          <Route path="/news" element={<News />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/admin/news" element={<Navigate to="/news" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Footer />
    </div>
  )
}
