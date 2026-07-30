export default function Logo({ light = false }) {
  return (
    <span className="flex items-center gap-3">
      <span className={`grid h-10 w-10 place-items-center rounded-lg border ${light ? 'border-white/20' : 'border-navy-900/15'}`}>
        <span className={`font-display text-xl font-bold ${light ? 'text-gold-400' : 'text-navy-900'}`}>K</span>
      </span>
      <span>
        <span className={`block font-display text-xl font-bold tracking-[.12em] ${light ? 'text-white' : 'text-navy-900'}`}>KBJM</span>
        <span className={`block text-[9px] font-bold uppercase tracking-[.18em] ${light ? 'text-white/50' : 'text-slate-500'}`}>International Trading</span>
      </span>
    </span>
  )
}
