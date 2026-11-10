import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Check, Eye, Plus, Rocket, Save, Trash2, Wand2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { extractPalette, applyTheme } from '@/lib/theme';
import { uid } from '@/lib/format';
import { useSite } from '@/lib/site';
import { Badge, Button, Card, ErrorNote, Field, Input, PageHeader, Select, Spinner, Tabs, Textarea, Toggle, cx, useToast } from '@/components/ui';
import { ImageInput, type Uploaded } from '@/components/ImageInput';
import type { SiteContent, Theme } from '@/lib/types';

type Draft = SiteContent & { theme: Theme };
type TabKey = 'brand' | 'banners' | 'about' | 'testimonials' | 'faq' | 'gallery' | 'contact' | 'sections';

/** Repeatable-list editor used for banners, testimonials, FAQ, gallery, highlights. */
function ListEditor<T extends { id: string }>({ items, onChange, make, render, addLabel, max = 50 }: { items: T[]; onChange: (v: T[]) => void; make: () => T; render: (item: T, set: (patch: Partial<T>) => void) => ReactNode; addLabel: string; max?: number }) {
  const move = (i: number, d: number) => { const x = [...items]; const [it] = x.splice(i, 1); x.splice(i + d, 0, it); onChange(x); };
  return (
    <div className="space-y-4">
      {items.map((it, i) => (
        <div key={it.id} className="rounded-brand border border-line bg-surface2/50 p-4">
          <div className="mb-3 flex justify-end gap-1">
            <Button size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" aria-label="Remove" onClick={() => onChange(items.filter((_, k) => k !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
          {render(it, (patch) => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x))))}
        </div>
      ))}
      {items.length < max && <Button variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => onChange([...items, make()])}>{addLabel}</Button>}
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={label} value={value || '#000000'} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-brand border border-line bg-surface p-1" />
        <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="auto" className="font-mono" />
      </div>
    </Field>
  );
}

function ThemePreview({ theme }: { theme: Theme }) {
  const ref = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<'light' | 'dark'>('light');
  useEffect(() => { if (ref.current) applyTheme(theme, m, undefined, ref.current); }, [theme, m]);
  const failed = theme.checks.filter((c) => !c.pass);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold">Live preview</span>
        <Tabs value={m} onChange={setM} items={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      </div>
      <div ref={ref} className="rounded-brand border border-line bg-bg p-5 text-ink">
        <div className="rounded-brand border border-line bg-surface p-4">
          <p className="font-display text-lg font-bold">Your gym, your colours</p>
          <p className="mt-1 text-sm text-muted">Body text and muted text on cards.</p>
          <p className="mt-1 text-sm"><span className="text-link underline">A text link</span></p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-brand bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary">Primary</span>
            <span className="rounded-brand bg-secondary px-3 py-1.5 text-sm font-semibold text-on-secondary">Secondary</span>
            <span className="rounded-brand bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent">Accent</span>
          </div>
        </div>
      </div>
      <p className={cx('mt-3 flex items-center gap-1.5 text-xs font-semibold', failed.length ? 'text-red-600' : 'text-emerald-600')}>
        {failed.length ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
        {failed.length ? `${failed.length} contrast checks below WCAG AA` : `All ${theme.checks.length} contrast checks pass WCAG AA (4.5:1)`}
      </p>
    </div>
  );
}

export default function WebsiteEditor() {
  const toast = useToast();
  const { reload: reloadSite } = useSite();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [meta, setMeta] = useState<{ published: { version: number } | null; hasUnpublishedChanges: boolean } | null>(null);
  const [tab, setTab] = useState<TabKey>('brand');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [extracting, setExtracting] = useState(false);
  const [swatches, setSwatches] = useState<string[]>([]);

  const load = useCallback(async () => {
    const r = await api.get('/admin/website/draft');
    setDraft(r.data.content);
    setMeta(r.data);
    setDirty(false);
  }, []);
  useEffect(() => { load().catch(setError); }, [load]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const set = <K extends keyof SiteContent>(k: K, v: SiteContent[K]) => { setDraft((d) => (d ? { ...d, [k]: v } : d)); setDirty(true); };

  // Recompute the AA-checked theme on the server whenever the seed colours change.
  const seedKey = draft ? JSON.stringify(draft.brand.seed) : '';
  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => {
      api.post('/admin/website/theme', Object.fromEntries(Object.entries(draft.brand.seed).filter(([, v]) => v)))
        .then((r) => setDraft((d) => (d ? { ...d, theme: r.data } : d)))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  const save = async () => {
    if (!draft) return false;
    setSaving(true);
    setError(null);
    try {
      const { theme: _t, ...content } = draft;
      void _t;
      const r = await api.put('/admin/website/draft', { content });
      setDraft(r.data.content);
      setDirty(false);
      setMeta((m) => (m ? { ...m, hasUnpublishedChanges: true } : m));
      toast('Draft saved');
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const preview = async () => {
    if (dirty && !(await save())) return;
    window.open('/?preview=draft', '_blank', 'noopener');
  };

  const publish = async () => {
    if (dirty && !(await save())) return;
    setPublishing(true);
    try {
      const r = await api.post('/admin/website/publish', { note: '' });
      toast(`Published version ${r.data.version}`);
      await load();
      await reloadSite();
    } catch (e) {
      setError(e);
    } finally {
      setPublishing(false);
    }
  };

  const fromLogo = async (u: Uploaded) => {
    setExtracting(true);
    try {
      let p: { primary: string; secondary?: string; accent?: string; swatches: string[] };
      try {
        p = await extractPalette(u.url);
      } catch (e) {
        if (!u.colors?.length) throw e;
        p = { primary: u.colors[0], secondary: u.colors[1], accent: u.colors[2], swatches: u.colors.slice(0, 6) };
      }
      setSwatches(p.swatches);
      set('brand', { ...draft!.brand, logoUrl: u.url, seed: { primary: p.primary, secondary: p.secondary, accent: p.accent } });
      toast('Colours extracted from your logo');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setExtracting(false);
    }
  };

  if (!draft) return error ? <ErrorNote error={error} /> : <Spinner />;
  const b = draft.brand;

  return (
    <>
      <PageHeader
        title="Website"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {meta?.published ? <Badge tone="green">Live: version {meta.published.version}</Badge> : <Badge tone="amber">Not published yet</Badge>}
            {(dirty || meta?.hasUnpublishedChanges) && <Badge tone="amber">{dirty ? 'Unsaved edits' : 'Draft has unpublished changes'}</Badge>}
          </span>
        }
        actions={
          <>
            <Button variant="outline" icon={<Save className="h-4 w-4" />} loading={saving} disabled={!dirty} onClick={save}>Save draft</Button>
            <Button variant="outline" icon={<Eye className="h-4 w-4" />} onClick={preview}>Preview</Button>
            <Button icon={<Rocket className="h-4 w-4" />} loading={publishing} onClick={publish}>Publish</Button>
          </>
        }
      />
      <ErrorNote error={error} />
      <div className="mb-5 mt-2 overflow-x-auto">
        <Tabs<TabKey>
          value={tab}
          onChange={setTab}
          items={[
            { value: 'brand', label: 'Branding' }, { value: 'banners', label: 'Banners' }, { value: 'about', label: 'About' },
            { value: 'testimonials', label: 'Testimonials' }, { value: 'faq', label: 'FAQ' }, { value: 'gallery', label: 'Gallery' },
            { value: 'contact', label: 'Contact & social' }, { value: 'sections', label: 'Sections & SEO' },
          ]}
        />
      </div>

      {tab === 'brand' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Identity">
            <div className="grid gap-4">
              <Field label="Gym name" required><Input value={b.name} onChange={(e) => set('brand', { ...b, name: e.target.value })} /></Field>
              <Field label="Tagline"><Input value={b.tagline} onChange={(e) => set('brand', { ...b, tagline: e.target.value })} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <ImageInput kind="logo" label="Logo (colours are taken from it)" aspect="aspect-[3/2]" value={b.logoUrl} onChange={(v) => set('brand', { ...b, logoUrl: v })} onUploaded={fromLogo} />
                <ImageInput kind="logo" label="Logo for dark mode (optional)" aspect="aspect-[3/2]" value={b.logoDarkUrl} onChange={(v) => set('brand', { ...b, logoDarkUrl: v })} />
              </div>
              <ImageInput kind="logo" label="Favicon (square)" aspect="aspect-square w-24" value={b.faviconUrl} onChange={(v) => set('brand', { ...b, faviconUrl: v })} />
            </div>
          </Card>
          <Card title="Colours & style" actions={b.logoUrl && <Button size="sm" variant="ghost" loading={extracting} icon={<Wand2 className="h-3.5 w-3.5" />} onClick={() => fromLogo({ url: b.logoUrl })}>Re-extract from logo</Button>}>
            {swatches.length > 0 && (
              <div className="mb-4">
                <p className="mb-1.5 text-xs font-semibold">Found in your logo - click to use as primary</p>
                <div className="flex gap-2">{swatches.map((s) => <button key={s} title={s} onClick={() => set('brand', { ...b, seed: { ...b.seed, primary: s } })} className="h-8 w-8 rounded-full border border-line" style={{ background: s }} />)}</div>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <ColorInput label="Primary" value={b.seed.primary} onChange={(v) => set('brand', { ...b, seed: { ...b.seed, primary: v } })} />
              <ColorInput label="Secondary" value={b.seed.secondary} onChange={(v) => set('brand', { ...b, seed: { ...b.seed, secondary: v || undefined } })} />
              <ColorInput label="Accent" value={b.seed.accent} onChange={(v) => set('brand', { ...b, seed: { ...b.seed, accent: v || undefined } })} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Default appearance">
                <Select value={b.mode} onChange={(e) => set('brand', { ...b, mode: e.target.value as any })}>
                  <option value="auto">Follow visitor's device</option><option value="light">Light</option><option value="dark">Dark</option>
                </Select>
              </Field>
              <Field label="Typography">
                <Select value={b.font} onChange={(e) => set('brand', { ...b, font: e.target.value as any })}>
                  <option value="modern">Modern (Inter)</option><option value="bold">Bold athletic (Oswald)</option><option value="classic">Classic (Playfair)</option><option value="rounded">Friendly (Nunito)</option>
                </Select>
              </Field>
            </div>
            <div className="mt-5"><ThemePreview theme={draft.theme} /></div>
          </Card>
        </div>
      )}

      {tab === 'banners' && (
        <Card title="Hero banners" actions={<span className="text-xs text-muted">Rotates automatically when there is more than one</span>}>
          <ListEditor
            items={draft.banners}
            onChange={(v) => set('banners', v)}
            max={10}
            addLabel="Add banner"
            make={() => ({ id: uid(), title: '', subtitle: '', imageUrl: '', ctaLabel: 'Join now', ctaHref: '/join', active: true })}
            render={(it, upd) => (
              <div className="grid gap-4 md:grid-cols-2">
                <ImageInput kind="banner" value={it.imageUrl} onChange={(v) => upd({ imageUrl: v })} label="Background image" />
                <div className="grid content-start gap-3">
                  <Field label="Headline"><Input value={it.title} onChange={(e) => upd({ title: e.target.value })} /></Field>
                  <Field label="Sub-text"><Textarea rows={2} value={it.subtitle} onChange={(e) => upd({ subtitle: e.target.value })} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Button text"><Input value={it.ctaLabel} onChange={(e) => upd({ ctaLabel: e.target.value })} /></Field>
                    <Field label="Button link" hint="/join, /#plans, https://…"><Input value={it.ctaHref} onChange={(e) => upd({ ctaHref: e.target.value })} /></Field>
                  </div>
                  <Toggle checked={it.active} onChange={(v) => upd({ active: v })} label="Show on site" />
                </div>
              </div>
            )}
          />
        </Card>
      )}

      {tab === 'about' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="About section">
            <div className="grid gap-4">
              <Field label="Heading"><Input value={draft.about.title} onChange={(e) => set('about', { ...draft.about, title: e.target.value })} /></Field>
              <Field label="Story" hint="Line breaks are kept"><Textarea rows={8} value={draft.about.body} onChange={(e) => set('about', { ...draft.about, body: e.target.value })} /></Field>
              <ImageInput kind="about" value={draft.about.imageUrl} onChange={(v) => set('about', { ...draft.about, imageUrl: v })} />
            </div>
          </Card>
          <Card title="Highlight numbers">
            <ListEditor
              items={draft.about.highlights}
              onChange={(v) => set('about', { ...draft.about, highlights: v })}
              max={8}
              addLabel="Add highlight"
              make={() => ({ id: uid(), label: '', value: '' })}
              render={(it, upd) => (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Value"><Input value={it.value} placeholder="1,200+" onChange={(e) => upd({ value: e.target.value })} /></Field>
                  <Field label="Label"><Input value={it.label} placeholder="Members" onChange={(e) => upd({ label: e.target.value })} /></Field>
                </div>
              )}
            />
          </Card>
        </div>
      )}

      {tab === 'testimonials' && (
        <Card title="Testimonials">
          <ListEditor
            items={draft.testimonials}
            onChange={(v) => set('testimonials', v)}
            addLabel="Add testimonial"
            make={() => ({ id: uid(), name: '', role: '', quote: '', rating: 5, photoUrl: '' })}
            render={(it, upd) => (
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Name"><Input value={it.name} onChange={(e) => upd({ name: e.target.value })} /></Field>
                <Field label="Role / since"><Input value={it.role} onChange={(e) => upd({ role: e.target.value })} /></Field>
                <Field label="Rating"><Select value={it.rating} onChange={(e) => upd({ rating: Number(e.target.value) })}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}</Select></Field>
                <Field label="Quote" className="md:col-span-3"><Textarea rows={3} value={it.quote} onChange={(e) => upd({ quote: e.target.value })} /></Field>
              </div>
            )}
          />
        </Card>
      )}

      {tab === 'faq' && (
        <Card title="Frequently asked questions">
          <ListEditor
            items={draft.faq}
            onChange={(v) => set('faq', v)}
            addLabel="Add question"
            make={() => ({ id: uid(), q: '', a: '' })}
            render={(it, upd) => (
              <div className="grid gap-3">
                <Field label="Question"><Input value={it.q} onChange={(e) => upd({ q: e.target.value })} /></Field>
                <Field label="Answer"><Textarea rows={3} value={it.a} onChange={(e) => upd({ a: e.target.value })} /></Field>
              </div>
            )}
          />
        </Card>
      )}

      {tab === 'gallery' && (
        <Card title="Gallery">
          <ListEditor
            items={draft.gallery}
            onChange={(v) => set('gallery', v)}
            max={80}
            addLabel="Add photo"
            make={() => ({ id: uid(), url: '', caption: '', category: '' })}
            render={(it, upd) => (
              <div className="grid gap-4 md:grid-cols-2">
                <ImageInput kind="gallery" value={it.url} onChange={(v) => upd({ url: v })} label="Photo" aspect="aspect-[4/3]" />
                <div className="grid content-start gap-3">
                  <Field label="Caption"><Input value={it.caption} onChange={(e) => upd({ caption: e.target.value })} /></Field>
                  <Field label="Category"><Input value={it.category} placeholder="floor, classes…" onChange={(e) => upd({ category: e.target.value })} /></Field>
                </div>
              </div>
            )}
          />
        </Card>
      )}

      {tab === 'contact' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Contact details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone"><Input value={draft.contact.phone} onChange={(e) => set('contact', { ...draft.contact, phone: e.target.value })} /></Field>
              <Field label="WhatsApp"><Input value={draft.contact.whatsapp} onChange={(e) => set('contact', { ...draft.contact, whatsapp: e.target.value })} /></Field>
              <Field label="Email" className="sm:col-span-2"><Input type="email" value={draft.contact.email} onChange={(e) => set('contact', { ...draft.contact, email: e.target.value })} /></Field>
              <Field label="Address" className="sm:col-span-2"><Textarea rows={2} value={draft.contact.address} onChange={(e) => set('contact', { ...draft.contact, address: e.target.value })} /></Field>
              <Field label="Map location" hint="Business name and address, as you'd search it on Google Maps" className="sm:col-span-2"><Input value={draft.contact.mapQuery} onChange={(e) => set('contact', { ...draft.contact, mapQuery: e.target.value })} /></Field>
            </div>
            <p className="mt-4 text-xs text-muted">Opening hours, currency and tax are in <Link to="/admin/settings" className="text-link underline">Business settings</Link> - the website and billing share them.</p>
          </Card>
          <Card title="Social links">
            <div className="grid gap-4">
              {(['instagram', 'facebook', 'youtube', 'x', 'tiktok', 'linkedin'] as const).map((k) => (
                <Field key={k} label={k === 'x' ? 'X (Twitter)' : k[0].toUpperCase() + k.slice(1)}>
                  <Input placeholder="https://…" value={draft.social[k]} onChange={(e) => set('social', { ...draft.social, [k]: e.target.value })} />
                </Field>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'sections' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Show on homepage">
            <div className="grid gap-3">
              {(Object.keys(draft.sections) as (keyof SiteContent['sections'])[]).map((k) => (
                <Toggle key={k} checked={draft.sections[k]} onChange={(v) => set('sections', { ...draft.sections, [k]: v })} label={k[0].toUpperCase() + k.slice(1)} />
              ))}
            </div>
          </Card>
          <Card title="Search engines">
            <div className="grid gap-4">
              <Field label="Page title" hint={`${draft.seo.title.length}/70`}><Input maxLength={70} value={draft.seo.title} onChange={(e) => set('seo', { ...draft.seo, title: e.target.value })} /></Field>
              <Field label="Description" hint={`${draft.seo.description.length}/170`}><Textarea maxLength={170} rows={3} value={draft.seo.description} onChange={(e) => set('seo', { ...draft.seo, description: e.target.value })} /></Field>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
