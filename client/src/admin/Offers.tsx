import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { cap, date, money } from '@/lib/format';
import { useSite } from '@/lib/site';
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader, Select, Table, Textarea, Toggle, useConfirm, useLoad, useToast } from '@/components/ui';
import { ImageInput } from '@/components/ImageInput';

const toLocal = (d: string | Date) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
const blank = () => ({
  title: '', description: '', discountType: 'percent', value: 10, planIds: [] as string[], categories: [] as string[], code: '', autoApply: true,
  startsAt: toLocal(new Date()), endsAt: toLocal(new Date(Date.now() + 14 * 864e5)), display: { bar: false, popup: false, banner: false, badge: true },
  badgeText: '', imageUrl: '', active: true, priority: 0, maxRedemptions: 0,
});

const state = (o: any) => {
  const now = Date.now();
  if (!o.active) return ['Paused', 'gray'];
  if (new Date(o.startsAt).getTime() > now) return ['Scheduled', 'blue'];
  if (new Date(o.endsAt).getTime() < now) return ['Ended', 'red'];
  return ['Live', 'green'];
};

/** Offers: scheduled, shown as bar/popup/banner/badge on the site, and applied automatically at billing. */
export default function Offers() {
  const toast = useToast();
  const { site, reload: reloadSite } = useSite();
  const { confirm, dialog } = useConfirm();
  const list = useLoad((s) => api.get('/admin/offers?limit=200', s).then((r) => r.data as any[]), []);
  const plans = useLoad((s) => api.get('/admin/plans?limit=200', s).then((r) => r.data as any[]), []);
  const [edit, setEdit] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const categories = site?.settings.categories ?? ['standard'];

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const body = { ...edit, value: Number(edit.value), priority: Number(edit.priority), maxRedemptions: Number(edit.maxRedemptions), startsAt: new Date(edit.startsAt).toISOString(), endsAt: new Date(edit.endsAt).toISOString() };
      const { _id, tenantId: _a, createdAt: _b, updatedAt: _c, __v: _d, redemptions: _e, ...clean } = body;
      void _a; void _b; void _c; void _d; void _e;
      if (_id) await api.put(`/admin/offers/${_id}`, clean); else await api.post('/admin/offers', clean);
      toast('Offer saved');
      setEdit(null); list.reload(); void reloadSite();
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const remove = async (o: any) => {
    if (!(await confirm(`Delete "${o.title}"? Invoices that used it keep their discount.`))) return;
    await api.del(`/admin/offers/${o._id}`); toast('Offer deleted'); list.reload(); void reloadSite();
  };
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <>
      {dialog}
      <PageHeader title="Offers" subtitle="Live offers appear on the website and are applied automatically when the front desk bills a membership." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => { setErr(null); setEdit(blank()); }}>New offer</Button>} />
      <ErrorNote error={list.error} />
      <Card padded={false}>
        <Table
          loading={list.loading}
          rows={list.data ?? []}
          onRowClick={(o) => { setErr(null); setEdit({ ...o, startsAt: toLocal(o.startsAt), endsAt: toLocal(o.endsAt), planIds: o.planIds.map(String) }); }}
          empty="No offers yet. Create one to show a bar, popup or badge on your site."
          columns={[
            { key: 't', header: 'Offer', render: (o: any) => <div><div className="font-semibold">{o.title}</div>{o.code && <div className="font-mono text-xs text-muted">{o.code}</div>}</div> },
            { key: 'v', header: 'Discount', render: (o: any) => (o.discountType === 'percent' ? `${o.value}%` : money(o.value)) },
            { key: 'w', header: 'Runs', render: (o: any) => `${date(o.startsAt)} → ${date(o.endsAt)}` },
            { key: 'd', header: 'Shown as', render: (o: any) => <div className="flex flex-wrap gap-1">{Object.entries(o.display).filter(([, v]) => v).map(([k]) => <Badge key={k}>{k}</Badge>)}</div> },
            { key: 'r', header: 'Used', render: (o: any) => `${o.redemptions}${o.maxRedemptions ? ` / ${o.maxRedemptions}` : ''}` },
            { key: 's', header: 'Status', render: (o: any) => { const [l, t] = state(o); return <Badge tone={t}>{l}</Badge>; } },
            { key: 'x', header: '', className: 'text-right', render: (o: any) => <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); void remove(o); }}>Delete</Button> },
          ]}
        />
      </Card>

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? 'Edit offer' : 'New offer'} wide footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save offer</Button></>}>
        {edit && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title" required className="md:col-span-2"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label="Description" className="md:col-span-2"><Textarea rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label="Discount type"><Select value={edit.discountType} onChange={(e) => setEdit({ ...edit, discountType: e.target.value })}><option value="percent">Percentage</option><option value="flat">Fixed amount</option></Select></Field>
            <Field label={edit.discountType === 'percent' ? 'Percent off' : 'Amount off'}><Input type="number" min={0} value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} /></Field>
            <Field label="Starts"><Input type="datetime-local" value={edit.startsAt} onChange={(e) => setEdit({ ...edit, startsAt: e.target.value })} /></Field>
            <Field label="Ends"><Input type="datetime-local" value={edit.endsAt} onChange={(e) => setEdit({ ...edit, endsAt: e.target.value })} /></Field>
            <Field label="Applies to plans" hint="None selected = all plans" className="md:col-span-2">
              <div className="flex flex-wrap gap-2">{(plans.data ?? []).map((p) => <button type="button" key={p._id} onClick={() => setEdit({ ...edit, planIds: toggle(edit.planIds, p._id) })} className={`rounded-full border px-3 py-1 text-xs font-semibold ${edit.planIds.includes(p._id) ? 'border-primary bg-primary text-on-primary' : 'border-line'}`}>{p.name}</button>)}</div>
            </Field>
            <Field label="Applies to categories" hint="None selected = everyone" className="md:col-span-2">
              <div className="flex flex-wrap gap-2">{categories.map((c) => <button type="button" key={c} onClick={() => setEdit({ ...edit, categories: toggle(edit.categories, c) })} className={`rounded-full border px-3 py-1 text-xs font-semibold ${edit.categories.includes(c) ? 'border-primary bg-primary text-on-primary' : 'border-line'}`}>{cap(c)}</button>)}</div>
            </Field>
            <Field label="Promo code" hint="Leave empty to apply automatically"><Input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase(), autoApply: !e.target.value })} /></Field>
            <Field label="Max uses" hint="0 = unlimited"><Input type="number" min={0} value={edit.maxRedemptions} onChange={(e) => setEdit({ ...edit, maxRedemptions: e.target.value })} /></Field>
            <div className="md:col-span-2">
              <p className="mb-2 text-xs font-semibold">Show on website as</p>
              <div className="flex flex-wrap gap-5">
                {(['bar', 'popup', 'banner', 'badge'] as const).map((k) => <Toggle key={k} checked={edit.display[k]} onChange={(v) => setEdit({ ...edit, display: { ...edit.display, [k]: v } })} label={k === 'bar' ? 'Top bar' : k === 'badge' ? 'Plan badge' : cap(k)} />)}
              </div>
            </div>
            <Field label="Badge text" hint='e.g. "20% OFF"'><Input maxLength={30} value={edit.badgeText} onChange={(e) => setEdit({ ...edit, badgeText: e.target.value })} /></Field>
            <Field label="Priority" hint="Higher wins when discounts tie"><Input type="number" min={0} max={100} value={edit.priority} onChange={(e) => setEdit({ ...edit, priority: e.target.value })} /></Field>
            {(edit.display.popup || edit.display.banner) && <div className="md:col-span-2"><ImageInput kind="offer" value={edit.imageUrl} onChange={(v) => setEdit({ ...edit, imageUrl: v })} label="Popup / banner image" /></div>}
            <div className="md:col-span-2"><Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Active" /></div>
            <div className="md:col-span-2"><ErrorNote error={err} /></div>
          </div>
        )}
      </Modal>
    </>
  );
}
