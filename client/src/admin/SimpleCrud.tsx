import { useState, type ReactNode } from 'react';
import { Plus, Search } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { cap } from '@/lib/format';
import { Button, Card, ErrorNote, Field, Input, Modal, PageHeader, Pager, Select, Table, Textarea, type Column, useConfirm, useLoad, useToast } from '@/components/ui';

export type FieldDef = { key: string; label: string; type?: 'text' | 'number' | 'date' | 'select' | 'textarea'; options?: string[]; required?: boolean; span?: boolean; default?: unknown };

/** Small generic list + form page for simple resources (equipment, expenses, products). */
export default function SimpleCrud({ title, subtitle, endpoint, fields, columns, searchable = true, extraActions }: { title: string; subtitle?: string; endpoint: string; fields: FieldDef[]; columns: Column<any>[]; searchable?: boolean; extraActions?: ReactNode }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = useLoad((s) => api.get(`${endpoint}${qs({ q, page, limit: 25 })}`, s), [q, page, endpoint]);
  const [edit, setEdit] = useState<any | null>(null);
  const [err, setErr] = useState<unknown>(null);

  const blank = () => Object.fromEntries(fields.map((f) => [f.key, f.default ?? (f.type === 'number' ? 0 : f.type === 'select' ? f.options?.[0] : '')]));
  const save = async () => {
    setErr(null);
    try {
      const body: Record<string, unknown> = {};
      for (const f of fields) {
        const v = edit[f.key];
        if (f.type === 'number') body[f.key] = Number(v ?? 0);
        else if (f.type === 'date') { if (v) body[f.key] = new Date(v).toISOString(); }
        else body[f.key] = v ?? '';
      }
      if (edit._id) await api.put(`${endpoint}/${edit._id}`, body); else await api.post(endpoint, body);
      toast('Saved'); setEdit(null); list.reload();
    } catch (e) { setErr(e); }
  };
  const remove = async () => {
    if (!(await confirm('Delete this item?'))) return;
    try { await api.del(`${endpoint}/${edit._id}`); setEdit(null); list.reload(); } catch (e) { setErr(e); }
  };

  return (
    <>
      {dialog}
      <PageHeader title={title} subtitle={subtitle} actions={<>{extraActions}<Button icon={<Plus className="h-4 w-4" />} onClick={() => { setErr(null); setEdit(blank()); }}>Add</Button></>} />
      <Card padded={false}>
        {searchable && (
          <div className="border-b border-line p-4">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input className="pl-9" placeholder="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
          </div>
        )}
        <ErrorNote error={list.error} />
        <Table loading={list.loading} rows={list.data?.data ?? []} columns={columns} onRowClick={(r) => { setErr(null); setEdit({ ...r, ...Object.fromEntries(fields.filter((f) => f.type === 'date').map((f) => [f.key, r[f.key] ? String(r[f.key]).slice(0, 10) : ''])) }); }} />
        {list.data && <Pager page={page} pages={list.data.pagination.pages} total={list.data.pagination.total} onPage={setPage} />}
      </Card>
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? 'Edit' : 'Add'} footer={<>{edit?._id && <Button variant="ghost" onClick={remove}>Delete</Button>}<Button onClick={save}>Save</Button></>}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <Field key={f.key} label={f.label} required={f.required} className={f.span || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                {f.type === 'select' ? (
                  <Select value={edit[f.key]} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })}>{f.options!.map((o) => <option key={o} value={o}>{cap(o.replace(/-/g, ' '))}</option>)}</Select>
                ) : f.type === 'textarea' ? (
                  <Textarea rows={3} value={edit[f.key] ?? ''} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} />
                ) : (
                  <Input type={f.type ?? 'text'} value={edit[f.key] ?? ''} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} />
                )}
              </Field>
            ))}
            <div className="sm:col-span-2"><ErrorNote error={err} /></div>
          </div>
        )}
      </Modal>
    </>
  );
}
