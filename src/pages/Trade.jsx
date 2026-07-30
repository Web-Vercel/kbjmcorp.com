import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import TradeTable from '../components/TradeTable'
import { trade } from '../data/siteContent'

export default function Trade() {
  return (
    <>
      <PageHero eyebrow="Trade desk" title="Current commodity interests" description="Indicative buy and sell positions from the reference website. Contact KBJM to confirm current availability, specifications, origin, pricing, and terms." />
      <main>
        <section className="py-20"><div className="mx-auto max-w-7xl px-5 sm:px-8"><h2 className="font-display text-4xl font-bold text-ink">Products we’re sourcing</h2><p className="mb-8 mt-4 text-slate-600">Indicative requirements for KBJM’s buyer network.</p><TradeTable items={trade.buy} /></div></section>
        <section className="bg-mist py-20"><div className="mx-auto max-w-7xl px-5 sm:px-8"><h2 className="font-display text-4xl font-bold text-ink">Products listed as available</h2><p className="mb-8 mt-4 text-slate-600">Volumes and specifications require direct confirmation.</p><TradeTable items={trade.sell} /></div></section>
        <section className="py-14"><div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-2xl border border-slate-200 px-6 py-8 sm:px-8 md:flex-row md:items-center md:justify-between"><p className="max-w-3xl text-sm leading-6 text-slate-600"><strong className="text-ink">Trade notice:</strong> Listings are indicative and subject to availability, final specifications, due diligence, and contractual agreement. Prices are negotiated case by case.</p><Link to="/contact" className="shrink-0 rounded-md bg-gold-500 px-6 py-3 font-bold uppercase tracking-wide text-white hover:bg-gold-600">Contact trade desk</Link></div></section>
      </main>
    </>
  )
}
