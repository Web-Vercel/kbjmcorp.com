import PageHero from '../components/PageHero'
import { team } from '../data/siteContent'

export default function Team() {
  return (
    <>
      <PageHero eyebrow="Our people" title="Leadership team" description="The team information below is carried over from the reference project and should be confirmed by the owner before the production launch." />
      <main className="py-20"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{team.map(([name,role,location])=><article key={name} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-soft"><div className="grid h-16 w-16 place-items-center rounded-full bg-gold-500/10 font-display text-xl font-bold text-gold-600">{name.split(' ').map((part)=>part[0]).join('')}</div><h2 className="mt-5 font-display text-2xl font-bold text-ink">{name}</h2><p className="mt-2 font-semibold text-gold-600">{role}</p><p className="mt-2 text-sm text-slate-500">{location}</p></article>)}</div><section className="mt-16 rounded-3xl bg-navy-900 p-8 text-white sm:p-12"><h2 className="font-display text-3xl font-bold">Join our team</h2><p className="mt-4 max-w-2xl leading-7 text-white/60">Professionals with experience in commodity trading, logistics, finance, and operations may contact KBJM to discuss potential opportunities.</p><a href="mailto:info@kbjmcorp.com?subject=Career%20inquiry" className="mt-7 inline-flex rounded-md bg-gold-500 px-6 py-3 font-bold uppercase tracking-wide">Contact KBJM</a></section></div></main>
    </>
  )
}
