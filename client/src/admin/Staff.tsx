import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateTime } from '@/lib/format';
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader, Select, Table, statusTone, useConfirm, useLoad, useToast } from '@/components/ui';

export default function Staff() {
  const toast = useToast();
  const { session } = useAuth();
  const { confirm, dialog } = useConfirm();
  const users = useLoad((s) => api.get('/admin/staff', s).then((r) => r.data as any[]), []);
  const roles = useLoad((s) => api.get('/admin/staff/roles', s).then((r) => r.data as any[]), []);
  const [edit, setEdit] = useState<any | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const label = (r: string) => roles.data?.find((x) => x.role === r)?.label ?? r;

  const save = async () => {
    setErr(null);
    try {
      if (edit._id) {
        const body: any = { name: edit.name, phone: edit.phone, role: edit.role, status: edit.status };
        if (edit._id === session?.user._id) { delete body.role; delete body.status; }
        if (edit.password) body.password = edit.password;
        await api.put(`/admin/staff/${edit._id}`, body);
      } else {
        await api.post('/admin/staff', { name: edit.name, email: edit.email, phone: edit.phone, role: edit.role, password: edit.password });
      }
      toast('Saved'); setEdit(null); users.reload();
    } catch (e) { setErr(e); }
  };
  const remove = async (u: any) => {
    if (!(await confirm(`Remove ${u.name}'s access?`))) return;
    try { await api.del(`/admin/staff/${u._id}`); users.reload(); } catch (e) { toast((e as Error).message, 'err'); }
  };

  return (
    <>
      {dialog}
      <PageHeader title="Staff & roles" subtitle="Everyone signs in on the same page. Their role decides what they can see and do - enforced on the server." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => { setErr(null); setEdit({ name: '', email: '', phone: '', role: 'frontdesk', password: '' }); }}>Add staff</Button>} />
      <ErrorNote error={users.error} />
      <Card padded={false}>
        <Table
          loading={users.loading}
          rows={users.data ?? []}
          onRowClick={(u: any) => { setErr(null); setEdit({ ...u, password: '' }); }}
          columns={[
            { key: 'n', header: 'Name', render: (u: any) => <div><div className="font-semibold">{u.name}{u._id === session?.user._id && <span className="ml-1 text-xs text-muted">(you)</span>}</div><div className="text-xs text-muted">{u.email}</div></div> },
            { key: 'r', header: 'Role', render: (u: any) => <Badge tone="primary">{label(u.role)}</Badge> },
            { key: 'l', header: 'Last sign-in', render: (u: any) => (u.lastLoginAt ? dateTime(u.lastLoginAt) : 'Never') },
            { key: 's', header: 'Status', render: (u: any) => <Badge tone={statusTone(u.status)}>{u.status}</Badge> },
            { key: 'x', header: '', className: 'text-right', render: (u: any) => u._id !== session?.user._id && <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); void remove(u); }}>Remove</Button> },
          ]}
        />
      </Card>

      <Card title="What each role can do" className="mt-6" padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead><tr className="border-b border-line text-left text-muted"><th className="px-4 py-2">Permission</th>{roles.data?.map((r) => <th key={r.role} className="px-2 py-2 text-center">{r.label}</th>)}</tr></thead>
            <tbody>
              {[...new Set((roles.data ?? []).flatMap((r) => r.permissions as string[]))].sort().map((p) => (
                <tr key={p} className="border-b border-line/60">
                  <td className="px-4 py-1.5 font-mono">{p}</td>
                  {roles.data?.map((r) => <td key={r.role} className="text-center">{r.permissions.includes(p) && <Check className="mx-auto h-3.5 w-3.5 text-link" />}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? edit.name : 'Add staff member'} footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></>}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Email (sign-in)"><Input type="email" disabled={Boolean(edit._id)} value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={edit.phone ?? ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="Role">
              <Select value={edit.role} disabled={edit._id === session?.user._id} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>
                {roles.data?.filter((r) => r.role !== 'owner' || session?.user.role === 'owner').map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}
              </Select>
            </Field>
            {edit._id && (
              <Field label="Status"><Select value={edit.status} disabled={edit._id === session?.user._id} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option value="active">Active</option><option value="disabled">Disabled</option></Select></Field>
            )}
            <Field label={edit._id ? 'New password (optional)' : 'Password'} hint="At least 8 characters" className="sm:col-span-2"><Input type="text" autoComplete="new-password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></Field>
            <p className="text-xs text-muted sm:col-span-2">Changing role, status or password signs this person out everywhere.</p>
            <div className="sm:col-span-2"><ErrorNote error={err} /></div>
          </div>
        )}
      </Modal>
    </>
  );
}

export function Audit() {
  const d = useLoad((s) => api.get('/admin/audit?limit=100', s).then((r) => r.data as any[]), []);
  return (
    <>
      <PageHeader title="Activity log" subtitle="Sign-ins, publishes, payments, refunds, role changes and support access." />
      <Card padded={false}>
        <ErrorNote error={d.error} />
        <Table loading={d.loading} rows={d.data ?? []} columns={[
          { key: 'w', header: 'When', render: (a: any) => <span className="text-xs">{dateTime(a.createdAt)}</span> },
          { key: 'u', header: 'Who', render: (a: any) => <span>{a.actorName ?? '—'}{a.impersonatedBy && <Badge tone="amber" className="ml-1">support</Badge>}</span> },
          { key: 'a', header: 'Action', render: (a: any) => <span className="font-mono text-xs">{a.action}</span> },
          { key: 'e', header: 'Details', render: (a: any) => <span className="text-xs text-muted">{[a.entity, a.summary].filter(Boolean).join(' · ')}</span> },
        ]} />
      </Card>
    </>
  );
}
