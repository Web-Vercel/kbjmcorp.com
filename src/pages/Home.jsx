import { ArrowRight, Globe2, Handshake, Ship, ShieldCheck } from 'lucide-react'
import { createElement } from 'react'
import { Link } from 'react-router-dom'
import { sectors } from '../data/siteContent'
import { useLanguage } from '../components/LanguageContext'

export default function Home() {
  const { language, text } = useLanguage()
  return (
    <>
      <section className="relative isolate min-h-[720px] overflow-hidden bg-navy-950">
        <img src="/images/vancouver-office.jpg" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950 via-navy-900/95 to-navy-900/55" />
        <div className="mx-auto flex min-h-[720px] max-w-7xl items-center px-5 py-20 sm:px-8">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[.2em] text-white/75">{text.heroBadge}</span>
            <h1 className="mt-8 font-display text-5xl font-bold leading-[1.05] text-white sm:text-6xl lg:text-7xl">{text.hero1}<br /><span className="text-gold-400">{text.hero2}</span></h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/65 sm:text-xl">{text.heroText}</p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row"><Link to="/trade" className="inline-flex items-center justify-center gap-2 rounded-md bg-gold-500 px-7 py-4 font-bold uppercase tracking-wide text-white hover:bg-gold-600">{text.explore}<ArrowRight className="h-5 w-5" /></Link><Link to="/about" className="inline-flex items-center justify-center rounded-md border border-white/20 bg-white/5 px-7 py-4 font-bold uppercase tracking-wide text-white hover:bg-white/10">{text.learn}</Link></div>
          </div>
        </div>
      </section>
      <section className="py-20 sm:py-28"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.25em] text-gold-600">Our sectors</p><h2 className="mt-4 font-display text-4xl font-bold text-ink sm:text-5xl">{text.sectors}</h2><p className="mt-5 text-lg leading-8 text-slate-600">{text.sectorsText}</p></div><div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">{sectors.map((sector)=><article key={sector.key} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft"><img src={sector.image} alt="" className="h-52 w-full object-cover transition duration-500 group-hover:scale-105" /><div className="p-6"><h3 className="font-display text-xl font-bold text-ink">{language==='zh'?sector.titleZh:sector.title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{language==='zh'?sector.descriptionZh:sector.description}</p></div></article>)}</div></div></section>
      <section className="bg-mist py-20"><div className="mx-auto grid max-w-7xl gap-6 px-5 sm:px-8 md:grid-cols-2 lg:grid-cols-4">{[[Globe2,'Cross-Pacific Reach'],[Ship,'Supply Coordination'],[ShieldCheck,'Risk-Aware Execution'],[Handshake,'Long-Term Partnerships']].map(([icon,title])=><article key={title} className="rounded-2xl bg-white p-6">{createElement(icon,{className:'h-7 w-7 text-gold-500','aria-hidden':true})}<h3 className="mt-4 font-bold text-ink">{title}</h3></article>)}</div></section>
      <section className="bg-navy-900 py-20 text-center text-white"><div className="mx-auto max-w-3xl px-5"><h2 className="font-display text-4xl font-bold">{text.contact}</h2><p className="mt-5 text-lg leading-8 text-white/60">{text.contactText}</p><Link to="/contact" className="mt-8 inline-flex items-center gap-2 rounded-md bg-gold-500 px-7 py-4 font-bold uppercase tracking-wide hover:bg-gold-600">{text.contact}<ArrowRight className="h-5 w-5" /></Link></div></section>
    </>
  )
}
