import type { Locale } from "@/lib/content";
import { faq } from "@/lib/faq";
export default function Faq({ locale }: { locale: Locale }) {
  const t = faq[locale];
  return <section className="section wrap faq-section" id="faq" aria-labelledby="faq-heading">
    <div><p className="eyebrow">{t.label}</p><h2 id="faq-heading">{t.title}</h2></div>
    <div className="faq-list">{t.items.map(([question, answer], index) => <details key={question}><summary><span className="faq-number">{String(index + 1).padStart(2, "0")}</span><span>{question}</span><span className="faq-icon" aria-hidden="true" /></summary><p>{answer}</p></details>)}</div>
  </section>;
}
