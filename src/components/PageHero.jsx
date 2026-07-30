export default function PageHero({ eyebrow, title, description }) {
  return <section className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 text-white"><div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28"><p className="text-xs font-bold uppercase tracking-[.28em] text-gold-400">{eyebrow}</p><h1 className="mt-5 max-w-4xl font-display text-4xl font-bold leading-tight sm:text-6xl">{title}</h1>{description && <p className="mt-6 max-w-2xl text-lg leading-8 text-white/65">{description}</p>}</div></section>
}
