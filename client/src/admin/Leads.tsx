import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, UserCheck } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cap, date, dateTime } from '@/lib/format';
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader, Pager, Select, Table, Tabs, Textarea, statusTone, useLoad, useToast } from '@/components/ui';

const STATUSES = ['new', 'contacted', 'trial', 'converted', 'lost'];

/** Website enquiries and "Join now" requests land here. Converting one creates the member. */
export default function Leads() {
  const { can } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [status, setStatus] = useState('new');
  const [page, setPage] = useState(1);
  const list = useLoad((s) => api.get(`/admin/leads${qs({ status, page, limit: 25 })}`, s), [status, page], `leads:${status}:${page}`);
  const [edit, setEdit] = useState<any | null>(null);
  const [err, setErr] = useState<unknown>(null);

  const convertLead = async (id: string) => {
    const r = await api.post(`/admin/leads/${id}/convert`, {});
    toast('Member created - now sell them a membership');
    nav(`/admin/members/${r.data._id}`);
  };

  const save = async () => {
    setErr(null);
    // Choosing "Converted" means: create the member. Save the other edits first, then convert.
    const wantsConvert = edit.status === 'converted' && !edit.convertedMember;
    if (wantsConvert && !can('members.write')) {
      setErr(new Error('Your role cannot create members. Ask a manager or the front desk to convert this lead.'));
      return;
    }
    try {
      const status = wantsConvert ? (edit._original && edit._original !== 'converted' ? edit._original : 'contacted') : edit.status;
      const body = { name: edit.name, phone: edit.phone, email: edit.email, message: edit.message, status, notes: edit.notes, source: edit.source, followUpAt: edit.followUpAt || undefined };
      let id = edit._id;
      if (id) await api.put(`/admin/leads/${id}`, body);
      else id = (await api.post('/admin/leads', body)).data._id;
      if (wantsConvert) return await convertLead(id);
      toast('Lead saved'); setEdit(null); list.reload();
    } catch (e) { setErr(e); }
  };
  const convert = async () => {
    try { await convertLead(edit._id); } catch (e) { setErr(e); }
  };

  return (
    <>
      <PageHeader title="Leads" subtitle="Website forms never create paying members - they arrive here for follow-up." actions={can('leads.manage') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ name: '', phone: '', email: '', message: '', status: 'new', notes: '', source: 'walk-in' })}>Add lead</Button>} />
      <div className="mb-4"><Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={[...STATUSES.map((s) => ({ value: s, label: cap(s) })), { value: 'all', label: 'All' }]} /></div>
      <Card padded={false}>
        <ErrorNote error={list.error} />
        <Table
          loading={list.loading}
          rows={list.data?.data ?? []}
          onRowClick={(l: any) => { setErr(null); setEdit({ ...l, _original: l.status, followUpAt: l.followUpAt ? String(l.followUpAt).slice(0, 10) : '' }); }}
          empty="No leads here."
          columns={[
            { key: 'n', header: 'Name', render: (l: any) => <div className="font-semibold">{l.name}</div> },
            { key: 'c', header: 'Contact', render: (l: any) => <div className="text-xs"><div>{l.phone || '—'}</div><div className="text-muted">{l.email}</div></div> },
            { key: 'i', header: 'Interest', render: (l: any) => <div className="text-xs">{l.planInterest?.name ?? '—'}{l.category && ` · ${cap(l.category)}`}</div> },
            { key: 'src', header: 'Source', render: (l: any) => <Badge>{l.source}</Badge> },
            { key: 'd', header: 'Received', render: (l: any) => <span className="text-xs">{dateTime(l.createdAt)}</span> },
            { key: 'f', header: 'Follow up', render: (l: any) => (l.followUpAt ? date(l.followUpAt) : '—') },
            { key: 's', header: 'Status', render: (l: any) => <Badge tone={statusTone(l.status)}>{l.status}</Badge> },
          ]}
        />
        {list.data && <Pager page={page} pages={list.data.pagination.pages} total={list.data.pagination.total} onPage={setPage} />}
      </Card>

      <Modal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title={edit?._id ? edit.name : 'New lead'}
        footer={
          <>
            {edit?.convertedMember && <Button variant="outline" onClick={() => nav(`/admin/members/${edit.convertedMember}`)}>View member</Button>}
            {edit?._id && edit.status !== 'converted' && can('members.write') && <Button variant="outline" icon={<UserCheck className="h-4 w-4" />} onClick={convert}>Convert to member</Button>}
            {can('leads.manage') && <Button onClick={save}>{edit?.status === 'converted' && !edit?.convertedMember ? 'Save & create member' : 'Save'}</Button>}
          </>
        }
      >
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Phone"><Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="Email"><Input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Status" hint={edit.status === 'converted' && !edit.convertedMember ? 'Saving will create a member from this lead.' : undefined}>
              <Select value={edit.status} disabled={Boolean(edit.convertedMember)} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}</Select>
            </Field>
            <Field label="Follow-up date"><Input type="date" value={edit.followUpAt ?? ''} onChange={(e) => setEdit({ ...edit, followUpAt: e.target.value })} /></Field>
            {edit.message && <div className="sm:col-span-2 rounded-brand bg-surface2 p-3 text-sm whitespace-pre-line">{edit.message}</div>}
            <Field label="Notes" className="sm:col-span-2"><Textarea rows={3} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            <div className="sm:col-span-2"><ErrorNote error={err} /></div>
          </div>
        )}
      </Modal>
    </>
  );
}
