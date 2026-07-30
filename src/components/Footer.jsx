import { Link } from 'react-router-dom'
import { business } from '../data/siteContent'
import { useLanguage } from './LanguageContext'
import Logo from './Logo'

export default function Footer() {
  const { text } = useLanguage()
  return (
    <footer className="bg-navy-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-3">
        <div><Logo light /><p className="mt-5 max-w-sm text-sm leading-6 text-white/55">{text.tagline}</p></div>
        <div><h2 className="font-bold">Navigation</h2><div className="mt-4 grid grid-cols-2 gap-2 text-sm text-white/55">{[['About','/about'],['Trade','/trade'],['Team','/team'],['News','/news'],['Contact','/contact']].map(([label,path])=><Link key={path} to={path} className="hover:text-gold-400">{label}</Link>)}</div></div>
        <div><h2 className="font-bold">Contact</h2><div className="mt-4 grid gap-2 text-sm text-white/55"><a href={business.emailHref}>{business.email}</a><a href={business.canadaPhoneHref}>{business.canadaPhone}</a><a href={business.chinaPhoneHref}>{business.chinaPhone}</a></div></div>
      </div>
      <div className="border-t border-white/10 px-5 py-6 text-center text-xs text-white/35">© 2026 KBJM International Trading. All rights reserved.</div>
    </footer>
  )
}
