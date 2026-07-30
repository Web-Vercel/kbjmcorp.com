import { Banknote, Handshake, Lightbulb, ShieldCheck } from 'lucide-react'
import { createElement } from 'react'
import PageHero from '../components/PageHero'

const values = [[ShieldCheck,'Integrity','Transparent, ethical dealings in every transaction.'],[Handshake,'Reliability','Dependable coordination across complex supply chains.'],[Lightbulb,'Innovation','Modern trade tools and thoughtful transaction structures.'],[Banknote,'Partnership','Long-term relationships with buyers, suppliers, and institutions.']]
const finance = ['Commodity futures','FX forwards','Currency options','Interest-rate swaps','Letters of credit','Trade credit insurance']

export default function About() {
  return (
    <>
      <PageHero eyebrow="About KBJM" title="Powering global trade with precision" description="KBJM coordinates commodity sourcing, brokerage, cross-border transactions, and supply-chain execution between North America and Asia-Pacific." />
      <main>
        <section className="py-20"><div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:items-center"><div><p className="text-xs font-bold uppercase tracking-[.25em] text-gold-600">Our story</p><h2 className="mt-4 font-display text-4xl font-bold text-ink">A strategic presence in two dynamic markets</h2><p className="mt-6 leading-8 text-slate-600">KBJM’s Vancouver operations provide access to North American mining, energy, agriculture, and forestry networks, while its Hainan operations support relationships across China and the wider Asia-Pacific market.</p><p className="mt-4 leading-8 text-slate-600">The company coordinates the physical movement and commercial settlement of tangible goods, helping connect suppliers, buyers, logistics providers, and financial counterparties.</p></div><div className="grid gap-5 sm:grid-cols-2"><figure className="overflow-hidden rounded-2xl border border-slate-200"><img src="/images/vancouver-office.jpg" alt="Vancouver city buildings" className="h-64 w-full object-cover" /><figcaption className="p-4 font-bold">Vancouver, Canada</figcaption></figure><figure className="overflow-hidden rounded-2xl border border-slate-200"><img src="/images/hainan-office.jpg" alt="Modern buildings in Hainan" className="h-64 w-full object-cover" /><figcaption className="p-4 font-bold">Hainan, China</figcaption></figure></div></div></section>
        <section className="bg-mist py-20"><div className="mx-auto max-w-7xl px-5 sm:px-8"><h2 className="font-display text-4xl font-bold text-ink">Principles that guide us</h2><div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{values.map(([icon,title,desc])=><article key={title} className="rounded-2xl bg-white p-6 shadow-sm">{createElement(icon,{className:'h-7 w-7 text-gold-500','aria-hidden':true})}<h3 className="mt-4 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{desc}</p></article>)}</div></div></section>
        <section className="py-20"><div className="mx-auto max-w-7xl px-5 sm:px-8"><h2 className="font-display text-4xl font-bold text-ink">Trade finance and risk-management tools</h2><p className="mt-5 max-w-3xl leading-8 text-slate-600">Transaction structures may use established instruments to manage pricing, payment, currency, and counterparty risks, subject to appropriate professional review and contractual terms.</p><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{finance.map((item)=><div key={item} className="rounded-xl border border-slate-200 p-5 font-bold text-navy-900">{item}</div>)}</div></div></section>
      </main>
    </>
  )
}
