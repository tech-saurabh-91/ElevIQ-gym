import { useEffect, useState, type FormEvent } from 'react';
import { Building2, ExternalLink, Globe, LifeBuoy, LogOut, Plus, Search, Trash2 } from 'lucide-react';
import { api, tokens } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, Table, statusTone, useLoad, useToast } from '@/components/ui';
import { ADMIN_THEME, applyTheme } from '@/lib/theme';
import { CURRENCIES, LOCALES } from '@/admin/Settings';

// The vendor console uses the same standard admin scheme - it is not any gym's brand.

function PlatformLogin({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { const r = await api.platform.post('/login', { email, password }); tokens.setPlatform(r.token); onDone(); } catch (e2) { setErr(e2); } finally { setBusy(false); }
  };
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2"><Building2 className="h-6 w-6" /><h1 className="text-lg font-bold">Platform console</h1></div>
        <form onSubmit={submit} className="grid gap-3">
          <Field label="Email"><Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password"><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <ErrorNote error={err} />
          <Button type="submit" loading={busy}>Sign in</Button>
        </form>
      </Card>
    </div>
  );
}

function TenantDetail({ id, root, onClose, onChanged }: { id: string; root: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const d = useLoad(() => api.platform.get(`/tenants/${id}`).then((r) => r.data), [id]);
  const [domain, setDomain] = useState('');
  const [dns, setDns] = useState<any>(null);
  if (!d.data) return <Modal open onClose={onClose} title="Gym"><Spinner /></Modal>;
  const t = d.data.tenant;
  const update = async (body: any) => { try { await api.platform.put(`/tenants/${id}`, body); d.reload(); onChanged(); toast('Updated'); } catch (e) { toast((e as Error).message, 'err'); } };
  const addDomain = async () => {
    try { const r = await api.platform.post(`/tenants/${id}/domains`, { domain }); setDns({ ...r.dns, vercel: r.vercel }); setDomain(''); d.reload(); onChanged(); } catch (e) { toast((e as Error).message, 'err'); }
  };
  const removeDomain = async (x: string) => { await api.platform.del(`/tenants/${id}/domains/${encodeURIComponent(x)}`); d.reload(); onChanged(); };
  const support = async () => {
    try {
      const r = await api.platform.post(`/tenants/${id}/impersonate`);
      const host = t.domains[0] ? `https://${t.domains[0]}` : r.data.url;
      window.open(`${host}/admin#support=${r.data.token}`, '_blank', 'noopener');
    } catch (e) { toast((e as Error).message, 'err'); }
  };
  return (
    <Modal open onClose={onClose} title={t.name} wide>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3 text-sm">
          <p><span className="text-muted">Address:</span> <a className="text-link" href={`https://${t.slug}.${root}`} target="_blank" rel="noopener noreferrer">{t.slug}.{root}</a></p>
          <p><span className="text-muted">Members:</span> {d.data.activeMembers} active / {d.data.members} total</p>
          <p><span className="text-muted">Setup:</span> {t.setupCompleted ? 'Complete' : 'Not finished'}</p>
          <p><span className="text-muted">Owners:</span> {d.data.owners.map((o: any) => o.email).join(', ')}</p>
          <Field label="Status"><Select value={t.status} onChange={(e) => update({ status: e.target.value })}><option value="trial">Trial</option><option value="active">Active</option><option value="suspended">Suspended</option></Select></Field>
          <Button variant="outline" icon={<LifeBuoy className="h-4 w-4" />} onClick={support}>Open admin as owner (1h, logged)</Button>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold">Custom domains</p>
          <ul className="space-y-1">{t.domains.map((x: string) => <li key={x} className="flex items-center justify-between rounded-brand bg-surface2 px-3 py-1.5 text-sm">{x}<button aria-label="Remove" onClick={() => removeDomain(x)}><Trash2 className="h-3.5 w-3.5" /></button></li>)}</ul>
          <div className="mt-2 flex gap-2"><Input placeholder="www.mygym.com" value={domain} onChange={(e) => setDomain(e.target.value)} /><Button variant="secondary" onClick={addDomain}>Add</Button></div>
          {dns && (
            <div className="mt-3 rounded-brand border border-line p-3 text-xs">
              <p className="font-semibold">Ask the gym to add this DNS record:</p>
              <p className="mt-1 font-mono">{dns.type} {dns.name} → {dns.value}</p>
              <p className="mt-1 text-muted">Vercel: {dns.vercel?.message}</p>
            </div>
          )}
        </div>
      </div>
      <Card title="Recent activity" className="mt-6" padded={false}>
        <Table rows={d.data.recentAudit} empty="No activity" columns={[
          { key: 'w', header: 'When', render: (a: any) => dateTime(a.createdAt) },
          { key: 'u', header: 'Who', render: (a: any) => a.actorName },
          { key: 'a', header: 'Action', render: (a: any) => a.action },
        ]} />
      </Card>
    </Modal>
  );
}

export default function Platform() {
  const toast = useToast();
  const [authed, setAuthed] = useState(Boolean(tokens.platform()));
  const [root, setRoot] = useState('');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState<any>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  useEffect(() => { applyTheme(ADMIN_THEME, 'light'); document.title = 'Platform console'; }, []);
  useEffect(() => {
    const off = () => setAuthed(false);
    window.addEventListener('platform:unauthorized', off);
    return () => window.removeEventListener('platform:unauthorized', off);
  }, []);
  useEffect(() => { if (authed) api.platform.get('/me').then((r) => setRoot(r.rootDomain)).catch(() => {}); }, [authed]);
  const list = useLoad(() => (authed ? api.platform.get(`/tenants${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((r) => r.data as any[]) : Promise.resolve([])), [authed, q]);

  if (!authed) return <PlatformLogin onDone={() => setAuthed(true)} />;

  const create = async () => {
    setErr(null);
    try {
      const r = await api.platform.post('/tenants', creating);
      toast(`Created ${r.data.tenant.name}. Send the owner their sign-in details.`);
      setCreating(null); list.reload(); setOpen(r.data.tenant._id);
    } catch (e) { setErr(e); }
  };

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <span className="flex items-center gap-2 font-bold"><Building2 className="h-5 w-5" /> Platform console</span>
          <Button size="sm" variant="ghost" icon={<LogOut className="h-4 w-4" />} onClick={() => { tokens.setPlatform(null); setAuthed(false); }}>Sign out</Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <PageHeader title="Gyms" subtitle="Create gyms, assign domains, and support owners." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => { setErr(null); setCreating({ name: '', slug: '', ownerName: '', ownerEmail: '', ownerPassword: '', currency: 'INR', locale: 'en-IN', timezone: 'Asia/Kolkata' }); }}>New gym</Button>} />
        <Card padded={false}>
          <div className="border-b border-line p-4">
            <div className="relative max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><Input className="pl-9" placeholder="Search name, slug or domain" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          </div>
          <ErrorNote error={list.error} />
          <Table loading={list.loading} rows={list.data ?? []} onRowClick={(t: any) => setOpen(t._id)} empty="No gyms yet." columns={[
            { key: 'n', header: 'Gym', render: (t: any) => <div><div className="font-semibold">{t.name}</div><div className="text-xs text-muted">{t.slug}.{root}</div></div> },
            { key: 'd', header: 'Domains', render: (t: any) => t.domains.length ? <span className="flex items-center gap-1 text-xs"><Globe className="h-3.5 w-3.5" />{t.domains.join(', ')}</span> : '—' },
            { key: 'm', header: 'Active members', render: (t: any) => t.activeMembers },
            { key: 'u', header: 'Setup', render: (t: any) => (t.setupCompleted ? <Badge tone="green">Live</Badge> : <Badge tone="amber">In setup</Badge>) },
            { key: 's', header: 'Status', render: (t: any) => <Badge tone={statusTone(t.status === 'trial' ? 'trial' : t.status)}>{t.status}</Badge> },
            { key: 'x', header: '', className: 'text-right', render: (t: any) => <a onClick={(e) => e.stopPropagation()} href={`https://${t.domains[0] ?? `${t.slug}.${root}`}`} target="_blank" rel="noopener noreferrer" className="inline-flex text-muted hover:text-ink" aria-label="Open site"><ExternalLink className="h-4 w-4" /></a> },
          ]} />
        </Card>
      </main>

      <Modal open={Boolean(creating)} onClose={() => setCreating(null)} title="New gym" footer={<Button onClick={create}>Create gym</Button>}>
        {creating && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Gym name" className="sm:col-span-2"><Input value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value, slug: creating.slugTouched ? creating.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) })} /></Field>
            <Field label="Address" hint={`${creating.slug || 'slug'}.${root}`} className="sm:col-span-2"><Input value={creating.slug} onChange={(e) => setCreating({ ...creating, slug: e.target.value.toLowerCase(), slugTouched: true })} /></Field>
            <Field label="Owner name"><Input value={creating.ownerName} onChange={(e) => setCreating({ ...creating, ownerName: e.target.value })} /></Field>
            <Field label="Owner email"><Input type="email" value={creating.ownerEmail} onChange={(e) => setCreating({ ...creating, ownerEmail: e.target.value })} /></Field>
            <Field label="Temporary password" hint="Owner should change it after first sign-in" className="sm:col-span-2"><Input type="text" value={creating.ownerPassword} onChange={(e) => setCreating({ ...creating, ownerPassword: e.target.value })} /></Field>
            <Field label="Currency"><Select value={creating.currency} onChange={(e) => setCreating({ ...creating, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Format"><Select value={creating.locale} onChange={(e) => setCreating({ ...creating, locale: e.target.value })}>{LOCALES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Time zone" className="sm:col-span-2"><Input value={creating.timezone} onChange={(e) => setCreating({ ...creating, timezone: e.target.value })} /></Field>
            <div className="sm:col-span-2"><ErrorNote error={err} /></div>
          </div>
        )}
      </Modal>
      {open && <TenantDetail id={open} root={root} onClose={() => setOpen(null)} onChanged={list.reload} />}
    </div>
  );
}
