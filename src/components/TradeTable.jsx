export default function TradeTable({ items }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
      <div className="overflow-x-auto">
        <table className="min-w-[850px] w-full text-left text-sm">
          <thead className="bg-navy-900 text-white"><tr>{['Product','Category','Specifications','Volume','Status'].map((item)=><th key={item} className="px-5 py-4 font-semibold">{item}</th>)}</tr></thead>
          <tbody>{items.map((item)=><tr key={`${item[0]}-${item[3]}`} className="border-t border-slate-100">{item.map((cell,index)=><td key={index} className={`px-5 py-4 ${index===0?'font-bold text-ink':'text-slate-600'}`}>{index===4?<span className={`rounded-full px-3 py-1 text-xs font-bold ${cell==='Active'?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{cell}</span>:cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}
