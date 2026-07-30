import { useState } from 'react'
import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import PageHero from '../components/PageHero'
import { business } from '../data/siteContent'
import { submitContact } from '../services/contactService'

const emptyForm = { name: '', email: '', company: '', subject: '', message: '', website: '' }

export default function Contact() {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const update = (event) => setForm((current)=>({...current,[event.target.name]:event.target.value}))
  const handleSubmit = async (event) => {
    event.preventDefault()
    const next = {}
    if (!form.name.trim()) next.name = 'Please enter your name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Please enter a valid email.'
    if (!form.subject.trim()) next.subject = 'Please enter a subject.'
    if (!form.message.trim()) next.message = 'Please enter your message.'
    if (Object.keys(next).length) { setErrors(next); setStatus({ok:false,message:'Please correct the highlighted fields.'}); return }
    setErrors({}); setSubmitting(true)
    try { const result = await submitContact(form); setStatus(result); if(result.ok)setForm(emptyForm) }
    catch(error){ setStatus({ok:false,message:error.message}) }
    finally { setSubmitting(false) }
  }
  const fieldClass = 'mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-400/15'
  return (
    <>
      <PageHero eyebrow="Contact KBJM" title="Discuss your trade requirements" description="Contact our Vancouver or Hainan team about sourcing, supply, logistics, or potential partnerships." />
      <main>
        <section className="py-20"><div className="mx-auto grid max-w-7xl gap-7 px-5 sm:px-8 lg:grid-cols-2">{business.offices.map((office)=><article key={office.city} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft"><img src={office.image} alt="" className="h-56 w-full object-cover" /><div className="p-7"><h2 className="font-display text-3xl font-bold">{office.city}</h2><p className="mt-2 font-semibold text-gold-600">{office.label}</p><div className="mt-6 grid gap-4 text-sm text-slate-600"><p className="flex gap-3 whitespace-pre-line"><MapPin className="h-5 w-5 shrink-0 text-gold-500" />{office.address}</p><a href={office.phoneHref} className="flex gap-3"><Phone className="h-5 w-5 text-gold-500" />{office.phone}</a><p className="flex gap-3"><Clock className="h-5 w-5 text-gold-500" />{office.hours}</p><a href={business.emailHref} className="flex gap-3"><Mail className="h-5 w-5 text-gold-500" />{business.email}</a></div></div></article>)}</div></section>
        <section className="bg-mist py-20"><div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[.7fr_1.3fr]"><div><p className="text-xs font-bold uppercase tracking-[.25em] text-gold-600">Send a message</p><h2 className="mt-4 font-display text-4xl font-bold">How can we help?</h2><p className="mt-5 leading-7 text-slate-600">The form is prepared for a future independent server endpoint. Until it is connected, use the published phone number or email address.</p></div><form onSubmit={handleSubmit} noValidate className="relative rounded-2xl bg-white p-7 shadow-soft sm:p-9"><label className="absolute -left-[10000px]" aria-hidden="true">Website<input name="website" value={form.website} onChange={update} tabIndex="-1" /></label><div className="grid gap-5 sm:grid-cols-2"><Field label="Full name" name="name" value={form.name} onChange={update} error={errors.name} className={fieldClass} /><Field label="Email" name="email" type="email" value={form.email} onChange={update} error={errors.email} className={fieldClass} /><Field label="Company" name="company" value={form.company} onChange={update} className={fieldClass} /><Field label="Subject" name="subject" value={form.subject} onChange={update} error={errors.subject} className={fieldClass} /><label className="sm:col-span-2"><span className="font-semibold">Message *</span><textarea name="message" value={form.message} onChange={update} rows="6" className={fieldClass} aria-invalid={Boolean(errors.message)} />{errors.message&&<span className="mt-1 block text-sm text-red-700">{errors.message}</span>}</label></div><button disabled={submitting} className="mt-7 w-full rounded-lg bg-gold-500 px-6 py-4 font-bold uppercase tracking-wide text-white hover:bg-gold-600 disabled:opacity-60">{submitting?'Sending…':'Send message'}</button>{status&&<div role="status" className={`mt-5 rounded-lg border p-4 text-sm ${status.ok?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-amber-200 bg-amber-50 text-amber-900'}`}><p className="font-bold">{status.message}</p>{!status.ok&&<p className="mt-2">Email <a href={business.emailHref} className="font-bold underline">{business.email}</a>.</p>}</div>}</form></div></section>
      </main>
    </>
  )
}

function Field({ label, error, ...props }) {
  return <label><span className="font-semibold">{label}{['name','email','subject'].includes(props.name)?' *':''}</span><input {...props} aria-invalid={Boolean(error)} />{error&&<span className="mt-1 block text-sm text-red-700">{error}</span>}</label>
}
