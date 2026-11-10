import { useState, type FormEvent } from 'react';
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { api } from '@/lib/api';
import { useSite } from '@/lib/site';
import { Button, ErrorNote, Field, Input, Textarea } from '@/components/ui';
import { OpenNow, Social } from './SiteLayout';

export default function Contact() {
  const { site } = useSite();
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState('');
  if (!site) return null;
  const c = site.site.contact;
  const wa = c.whatsapp.replace(/[^\d]/g, '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.post('/public/leads', { ...form, source: 'enquiry' });
      setDone(r.message);
      setForm({ name: '', phone: '', email: '', message: '', website: '' });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-link">Contact</p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Get in touch</h1>
      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <div className="space-y-4">
          <OpenNow />
          {c.address && <p className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-link" />{c.address}</p>}
          {c.phone && <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="flex gap-3 hover:text-link"><Phone className="mt-0.5 h-5 w-5 shrink-0 text-link" />{c.phone}</a>}
          {c.email && <a href={`mailto:${c.email}`} className="flex gap-3 hover:text-link"><Mail className="mt-0.5 h-5 w-5 shrink-0 text-link" />{c.email}</a>}
          {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="flex gap-3 hover:text-link"><MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-link" />Chat on WhatsApp</a>}
          <Social />
          {c.mapQuery && (
            <iframe title="Map" loading="lazy" className="mt-4 h-72 w-full rounded-brand border border-line" src={`https://www.google.com/maps?q=${encodeURIComponent(c.mapQuery)}&output=embed`} />
          )}
        </div>
        <form onSubmit={submit} className="grid gap-4 self-start rounded-brand border border-line bg-surface p-6 shadow-soft sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2"><Input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Phone"><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Message" required className="sm:col-span-2"><Textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
          <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          <div className="sm:col-span-2"><ErrorNote error={error} />{done && <p className="rounded-brand bg-primary/10 px-3 py-2 text-sm text-link">{done}</p>}</div>
          <div className="sm:col-span-2"><Button type="submit" loading={busy} disabled={!form.phone && !form.email}>Send message</Button></div>
        </form>
      </div>
    </div>
  );
}
