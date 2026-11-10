import { Eye, RotateCcw, Rocket, Undo2 } from 'lucide-react';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useSite } from '@/lib/site';
import { Badge, Button, Card, ErrorNote, PageHeader, Table, useConfirm, useLoad, useToast } from '@/components/ui';

export default function PublishHistory() {
  const toast = useToast();
  const { reload: reloadSite } = useSite();
  const { confirm, dialog } = useConfirm();
  const draft = useLoad((s) => api.get('/admin/website/draft', s).then((r) => r.data), []);
  const revs = useLoad((s) => api.get('/admin/website/revisions', s).then((r) => r.data as any[]), []);

  const publish = async () => {
    try {
      const r = await api.post('/admin/website/publish', {});
      toast(`Published version ${r.data.version}`);
      revs.reload(); draft.reload(); void reloadSite();
    } catch (e) { toast((e as Error).message, 'err'); }
  };
  const rollback = async (rev: any) => {
    if (!(await confirm(`Make version ${rev.version} live again? Your current draft will be replaced with it.`))) return;
    try {
      const r = await api.post(`/admin/website/revisions/${rev._id}/rollback`);
      toast(`Rolled back - now live as version ${r.data.version}`);
      revs.reload(); draft.reload(); void reloadSite();
    } catch (e) { toast((e as Error).message, 'err'); }
  };
  const discard = async () => {
    if (!(await confirm('Discard all unpublished draft changes and go back to the live version?'))) return;
    try { await api.post('/admin/website/draft/reset'); toast('Draft reset to the live version'); draft.reload(); } catch (e) { toast((e as Error).message, 'err'); }
  };

  return (
    <>
      {dialog}
      <PageHeader title="Publish & history" subtitle="Edits are saved as a draft. Visitors see a version only after you publish it." />
      <ErrorNote error={draft.error || revs.error} />
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Draft</p>
            <p className="text-xs text-muted">{draft.data?.hasUnpublishedChanges ? 'Has changes that are not live yet.' : 'Same as the live site.'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<Eye className="h-4 w-4" />} onClick={() => window.open('/?preview=draft', '_blank', 'noopener')}>Preview draft</Button>
            <Button variant="outline" icon={<Undo2 className="h-4 w-4" />} disabled={!draft.data?.published} onClick={discard}>Discard draft</Button>
            <Button icon={<Rocket className="h-4 w-4" />} onClick={publish}>Publish draft</Button>
          </div>
        </div>
      </Card>
      <Card title="Published versions" padded={false}>
        <Table
          loading={revs.loading}
          rows={revs.data ?? []}
          empty="Nothing published yet."
          columns={[
            { key: 'v', header: 'Version', render: (r: any) => <span className="font-semibold">v{r.version}</span> },
            { key: 's', header: 'Status', render: (r: any) => <Badge tone={r.status === 'published' ? 'green' : 'gray'}>{r.status === 'published' ? 'Live' : 'Archived'}</Badge> },
            { key: 'n', header: 'Note', render: (r: any) => r.note || '—' },
            { key: 'b', header: 'By', render: (r: any) => r.publishedBy?.name ?? '—' },
            { key: 'd', header: 'Published', render: (r: any) => dateTime(r.publishedAt) },
            { key: 'a', header: '', className: 'text-right', render: (r: any) => r.status !== 'published' && <Button size="sm" variant="outline" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => rollback(r)}>Roll back</Button> },
          ]}
        />
      </Card>
    </>
  );
}
