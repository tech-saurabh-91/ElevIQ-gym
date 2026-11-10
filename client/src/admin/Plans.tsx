import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cap, money } from '@/lib/format';
import { useSite } from '@/lib/site';
import { useAuth } from '@/lib/auth';
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader, Table, Textarea, Toggle, useConfirm, useLoad, useToast } from '@/components/ui';

const blank = (cats: string[]) => ({
  name: '', description: '', features: [] as string[], durationDays: 30, billingLabel: 'month',
  prices: cats.map((c) => ({ category: c, amount: 0 })), joiningFee: 0, isPublic: true, active: true, highlight: false, sortOrder: 0,
});

export const PLAN_TEMPLATES = [
  { name: 'Monthly', durationDays: 30, billingLabel: 'month', features: ['Full gym access', 'Locker room & showers'] },
  { name: 'Quarterly', durationDays: 90, billingLabel: '3 months', features: ['Full gym access', 'Group classes', '1 PT session'], highlight: true },
  { name: 'Annual', durationDays: 365, billingLabel: 'year', features: ['Full gym access', 'Group classes', 'Guest passes', 'Membership freeze'] },
];

/** Plans & category pricing: the exact records the website shows and billing charges. */
export default function Plans() {
  const toast = useToast();
  const { can } = useAuth();
  const { site, reload: reloadSite } = useSite();
  const { confirm, dialog } = useConfirm();
  const cats = site?.settings.categories ?? ['standard'];
  const list = useLoad((s) => api.get('/admin/plans?limit=200', s).then((r) => r.data as any[]), []);
  const [edit, setEdit] = useState<any | null>(null);
  const [feature, setFeature] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const writable = can('plans.manage');

  const open = (p?: any) => {
    setErr(null);
    if (!p) return setEdit(blank(cats));
    const prices = cats.map((c) => ({ category: c, amount: p.prices.find((x: any) => x.category === c)?.amount ?? 0, enabled: p.prices.some((x: any) => x.category === c) }));
    setEdit({ ...p, prices });
  };
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const prices = edit.prices.filter((p: any) => p.enabled !== false && (p.amount > 0 || p.category === 'standard')).map((p: any) => ({ category: p.category, amount: Number(p.amount) }));
      const body = {
        name: edit.name, description: edit.description, features: edit.features, durationDays: Number(edit.durationDays), billingLabel: edit.billingLabel,
        prices, joiningFee: Number(edit.joiningFee), isPublic: edit.isPublic, active: edit.active, highlight: edit.highlight, sortOrder: Number(edit.sortOrder),
      };
      if (edit._id) await api.put(`/admin/plans/${edit._id}`, body); else await api.post('/admin/plans', body);
      toast('Plan saved - the website is updated');
      setEdit(null); list.reload(); void reloadSite();
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const remove = async (p: any) => {
    if (!(await confirm(`Delete plan "${p.name}"? Existing memberships keep working. Consider turning it off instead.`))) return;
    await api.del(`/admin/plans/${p._id}`); list.reload(); void reloadSite();
  };

  return (
    <>
      {dialog}
      <PageHeader title="Plans & pricing" subtitle="Prices per category (standard, student, couple, senior…). The website and billing both read from here." actions={writable && <Button icon={<Plus className="h-4 w-4" />} onClick={() => open()}>New plan</Button>} />
      <ErrorNote error={list.error} />
      <Card padded={false}>
        <Table
          loading={list.loading}
          rows={list.data ?? []}
          onRowClick={writable ? open : undefined}
          empty="No plans yet."
          columns={[
            { key: 'n', header: 'Plan', render: (p: any) => <div className="font-semibold">{p.name} {p.highlight && <Badge tone="primary">Featured</Badge>}</div> },
            { key: 'd', header: 'Duration', render: (p: any) => `${p.durationDays} days` },
            ...cats.map((c) => ({ key: c, header: cap(c), render: (p: any) => { const x = p.prices.find((y: any) => y.category === c); return x ? money(x.amount) : <span className="text-muted">—</span>; } })),
            { key: 's', header: 'Status', render: (p: any) => <div className="flex gap-1"><Badge tone={p.active ? 'green' : 'gray'}>{p.active ? 'Active' : 'Off'}</Badge>{!p.isPublic && <Badge>Hidden</Badge>}</div> },
            ...(writable ? [{ key: 'x', header: '', className: 'text-right', render: (p: any) => <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); void remove(p); }}>Delete</Button> }] : []),
          ]}
        />
      </Card>

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? 'Edit plan' : 'New plan'} wide footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save plan</Button></>}>
        {edit && (
          <div className="grid gap-4 md:grid-cols-2">
            {!edit._id && (
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <span className="text-xs text-muted">Start from:</span>
                {PLAN_TEMPLATES.map((t) => <button key={t.name} type="button" onClick={() => setEdit({ ...edit, ...t })} className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:border-primary">{t.name}</button>)}
              </div>
            )}
            <Field label="Name" required><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Length (days)"><Input type="number" min={1} value={edit.durationDays} onChange={(e) => setEdit({ ...edit, durationDays: e.target.value })} /></Field>
              <Field label='Shown as "per …"'><Input value={edit.billingLabel} onChange={(e) => setEdit({ ...edit, billingLabel: e.target.value })} /></Field>
            </div>
            <Field label="Description" className="md:col-span-2"><Textarea rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <div className="md:col-span-2">
              <p className="mb-2 text-xs font-semibold">Price by category <span className="font-normal text-muted">(before {site?.settings.tax.label ?? 'tax'})</span></p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {edit.prices.map((p: any, i: number) => (
                  <Field key={p.category} label={<span className="flex items-center justify-between">{cap(p.category)}{p.category !== 'standard' && <Toggle checked={p.enabled !== false} onChange={(v) => setEdit({ ...edit, prices: edit.prices.map((x: any, k: number) => (k === i ? { ...x, enabled: v } : x)) })} />}</span>}>
                    <Input type="number" min={0} disabled={p.enabled === false} value={p.amount} onChange={(e) => setEdit({ ...edit, prices: edit.prices.map((x: any, k: number) => (k === i ? { ...x, amount: e.target.value } : x)) })} />
                  </Field>
                ))}
              </div>
            </div>
            <Field label="One-time joining fee" hint="Charged on a member's first membership"><Input type="number" min={0} value={edit.joiningFee} onChange={(e) => setEdit({ ...edit, joiningFee: e.target.value })} /></Field>
            <Field label="Display order"><Input type="number" value={edit.sortOrder} onChange={(e) => setEdit({ ...edit, sortOrder: e.target.value })} /></Field>
            <div className="md:col-span-2">
              <p className="mb-2 text-xs font-semibold">Features</p>
              <ul className="space-y-1.5">{edit.features.map((f: string, i: number) => <li key={i} className="flex items-center justify-between rounded-brand bg-surface2 px-3 py-1.5 text-sm">{f}<button aria-label="Remove" onClick={() => setEdit({ ...edit, features: edit.features.filter((_: string, k: number) => k !== i) })}><Trash2 className="h-3.5 w-3.5 text-muted" /></button></li>)}</ul>
              <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (feature.trim()) { setEdit({ ...edit, features: [...edit.features, feature.trim()] }); setFeature(''); } }}>
                <Input placeholder="Add a feature and press Enter" value={feature} onChange={(e) => setFeature(e.target.value)} />
                <Button type="submit" variant="secondary">Add</Button>
              </form>
            </div>
            <div className="flex flex-wrap gap-5 md:col-span-2">
              <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Active (can be sold)" />
              <Toggle checked={edit.isPublic} onChange={(v) => setEdit({ ...edit, isPublic: v })} label="Show on website" />
              <Toggle checked={edit.highlight} onChange={(v) => setEdit({ ...edit, highlight: v })} label="Feature as most popular" />
            </div>
            <div className="md:col-span-2"><ErrorNote error={err} /></div>
          </div>
        )}
      </Modal>
    </>
  );
}
