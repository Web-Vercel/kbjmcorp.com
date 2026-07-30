import { useState } from 'react'
import { Globe2, Menu, X } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useLanguage } from './LanguageContext'
import Logo from './Logo'

export default function Header() {
  const [open, setOpen] = useState(false)
  const { language, setLanguage, text } = useLanguage()
  const items = [
    ['home', '/'], ['about', '/about'], ['trade', '/trade'],
    ['team', '/team'], ['news', '/news'], ['contact', '/contact']
  ]
  const navClass = ({ isActive }) => `rounded-md px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-navy-50 text-navy-900' : 'text-slate-600 hover:text-navy-900'}`
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" aria-label="KBJM home"><Logo /></Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {items.map(([key, path]) => <NavLink key={key} to={path} className={navClass}>{text.nav[key]}</NavLink>)}
          <button type="button" onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')} className="ml-3 inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-navy-900"><Globe2 className="h-4 w-4" />{language === 'en' ? '中文' : 'EN'}</button>
        </nav>
        <button type="button" className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'}>{open ? <X /> : <Menu />}</button>
      </div>
      {open && <nav id="mobile-nav" className="border-t border-slate-200 bg-white px-5 py-5 lg:hidden" aria-label="Mobile navigation"><div className="mx-auto grid max-w-7xl gap-2">{items.map(([key, path]) => <NavLink key={key} to={path} className={navClass} onClick={() => setOpen(false)}>{text.nav[key]}</NavLink>)}<button type="button" onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')} className="mt-2 inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-4 py-3 font-bold"><Globe2 className="h-4 w-4" />{language === 'en' ? '中文' : 'English'}</button></div></nav>}
    </header>
  )
}
