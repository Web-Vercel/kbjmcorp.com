import PageHero from '../components/PageHero'

export default function News() {
  return (
    <>
      <PageHero eyebrow="News & insights" title="Market updates from KBJM" description="A clean, static news page ready for owner-approved company updates and market commentary." />
      <main className="py-20"><div className="mx-auto max-w-3xl px-5 text-center sm:px-8"><div className="rounded-3xl border border-dashed border-slate-300 bg-mist p-10"><h2 className="font-display text-3xl font-bold text-ink">No published articles yet</h2><p className="mt-4 leading-7 text-slate-600">Future articles can be added as local content files without a database or administrator login.</p></div></div></main>
    </>
  )
}
