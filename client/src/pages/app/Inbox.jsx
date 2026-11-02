import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Field, Input, Loading, Modal, Select, Tabs, Textarea, useToast } from '../../components/ui';
import { useLocale } from '../../lib/i18n';
import api from '../../lib/api';

const CONTACT_TONE = { new: 'warn', 'in-progress': 'info', replied: 'success', closed: 'default' };
const CAMPAIGN_TONE = { draft: 'default', scheduled: 'info', sending: 'warn', sent: 'success', paused: 'warn' };

export default function Inbox() {
  const { money, date } = useLocale();
  const { push } = useToast();
  const [tab, setTab] = useState('messages');
  const [messages, setMessages] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [reply, setReply] = useState('');
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [announceForm, setAnnounceForm] = useState({ title: '', body: '', audience: 'all', priority: 'normal' });
  const [campaignForm, setCampaignForm] = useState({ name: '', channel: 'email', subject: '', audience: 'all', budget: 500 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, a, c] = await Promise.all([
        api.get(api.qs('/contacts', { limit: 50 })),
        api.get(api.qs('/announcements/all', { limit: 30 })),
        api.get(api.qs('/campaigns', { limit: 30 })),
      ]);
      setMessages(m.data);
      setAnnouncements(a.data);
      setCampaigns(c.data);
    } catch (e) {
      push(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (id, status, text = reply) => {
    try {
      await api.put(`/contacts/${id}`, { status, reply: text, repliedAt: new Date() });
      push('Conversation updated.', 'info');
      setActive(null);
      setReply('');
      load();
    } catch (e) {
      push(e.message, 'error');
    }
  };

  const createAnnouncement = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/announcements', announceForm);
      push('Announcement published.');
      setAnnounceOpen(false);
      setAnnounceForm({ title: '', body: '', audience: 'all', priority: 'normal' });
      load();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const createCampaign = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/campaigns', { ...campaignForm, budget: Number(campaignForm.budget) });
      push('Campaign created as draft.');
      setCampaignOpen(false);
      load();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (kind, id) => {
    try {
      await api.del(`/${kind}/${id}`);
      push('Deleted.', 'info');
      load();
    } catch (e) {
      push(e.message, 'error');
    }
  };

  if (loading && !messages.length) return <Loading label="Loading inbox…" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-black tracking-tight">Communication & marketing</h2>
          <p className="mt-1 text-sm text-muted">
            {messages.filter((m) => m.status === 'new').length} unanswered · {announcements.length} announcements · {campaigns.length} campaigns
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setAnnounceOpen(true)}>+ Announcement</Button>
          <Button onClick={() => setCampaignOpen(true)}>+ Campaign</Button>
        </div>
      </div>

      <Tabs
        tabs={[
          { value: 'messages', label: 'Contact inbox' },
          { value: 'announcements', label: 'Announcements' },
          { value: 'campaigns', label: 'Campaigns' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'messages' && (
        <div className="space-y-3">
          {messages.length === 0 && <div className="rounded-2xl border border-white/10 bg-surface/60 p-10 text-center text-sm text-muted">Inbox is clear.</div>}
          {messages.map((m) => (
            <div key={m._id} className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/10 bg-surface/60 p-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display font-semibold">{m.name}</p>
                  <Badge tone={CONTACT_TONE[m.status]}>{m.status}</Badge>
                  <Badge tone="violet">{m.topic}</Badge>
                  <span className="text-[11px] text-muted">{new Date(m.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{m.email} {m.phone ? `· ${m.phone}` : ''}</p>
                <p className="mt-2 text-sm text-bone/85">{m.subject}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{m.message}</p>
                {m.reply && (
                  <div className="mt-3 rounded-xl border border-mint/25 bg-mint/[0.06] p-3">
                    <p className="text-[10px] uppercase tracking-widest text-mint">Your reply</p>
                    <p className="mt-1 text-xs text-bone/85">{m.reply}</p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" className="!py-2 !text-xs" onClick={() => setActive(m)}>Open</Button>
                {m.status !== 'closed' && (
                  <Button variant="ghost" className="!py-2 !text-xs" onClick={() => updateStatus(m._id, 'closed')}>Close</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'announcements' && (
        <div className="grid gap-4 md:grid-cols-2">
          {announcements.map((a) => (
            <div key={a._id} className={`rounded-3xl border p-5 ${a.pinned ? 'border-mint/40 bg-mint/[0.06]' : 'border-white/10 bg-surface/60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={a.priority === 'high' ? 'danger' : 'default'}>{a.priority}</Badge>
                    <Badge tone="info">{a.audience}</Badge>
                    {a.pinned && <Badge tone="success">pinned</Badge>}
                  </div>
                  <h3 className="mt-3 font-display font-bold">{a.title}</h3>
                </div>
                <button onClick={() => remove('announcements', a._id)} className="text-muted transition hover:text-coral" aria-label="delete">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                  </svg>
                </button>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{a.body}</p>
              <p className="mt-3 font-mono text-[11px] text-muted">{date(a.publishedAt)}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'campaigns' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => (
            <div key={c._id} className="rounded-3xl border border-white/10 bg-surface/60 p-5">
              <div className="flex items-start justify-between gap-2">
                <Badge tone={CAMPAIGN_TONE[c.status]}>{c.status}</Badge>
                <Badge tone="violet">{c.channel}</Badge>
              </div>
              <h3 className="mt-3 font-display font-bold">{c.name}</h3>
              <p className="mt-1 text-xs text-muted">{c.subject || c.body}</p>

              <div className="mt-4 grid grid-cols-4 gap-1.5 text-center">
                {[
                  { k: 'Sent', v: c.stats?.sent || 0 },
                  { k: 'Opened', v: c.stats?.opened || 0 },
                  { k: 'Clicked', v: c.stats?.clicked || 0 },
                  { k: 'Won', v: c.stats?.converted || 0 },
                ].map((s) => (
                  <div key={s.k} className="rounded-lg border border-white/8 bg-white/[0.03] p-2">
                    <p className="text-xs font-bold">{s.v}</p>
                    <p className="text-[9px] uppercase tracking-widest text-muted">{s.k}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                <span className="text-muted">Spend {money(c.spend || 0)} / {money(c.budget || 0)}</span>
                <button onClick={() => remove('campaigns', c._id)} className="text-muted hover:text-coral">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply modal */}
      <Modal open={Boolean(active)} onClose={() => setActive(null)} title={active ? `Reply to ${active.name}` : ''}>
        {active && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-muted">{active.email}</p>
              <p className="mt-2 text-sm font-semibold">{active.subject}</p>
              <p className="mt-1 text-sm text-bone/85">{active.message}</p>
            </div>
            <Field label="Your reply">
              <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Thanks for reaching out — here is what I can do…" />
            </Field>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={() => updateStatus(active._id, 'in-progress')}>Mark in progress</Button>
              <Button onClick={() => updateStatus(active._id, 'replied')} disabled={reply.trim().length < 3}>Send reply</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Announcement */}
      <Modal open={announceOpen} onClose={() => setAnnounceOpen(false)} title="Publish an announcement">
        <form onSubmit={createAnnouncement} className="grid gap-4">
          <Field label="Title"><Input value={announceForm.title} onChange={(e) => setAnnounceForm((f) => ({ ...f, title: e.target.value }))} required /></Field>
          <Field label="Message"><Textarea value={announceForm.body} onChange={(e) => setAnnounceForm((f) => ({ ...f, body: e.target.value }))} required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Audience">
              <Select value={announceForm.audience} onChange={(e) => setAnnounceForm((f) => ({ ...f, audience: e.target.value }))}>
                {['all', 'members', 'staff', 'admins'].map((a) => <option key={a}>{a}</option>)}
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={announceForm.priority} onChange={(e) => setAnnounceForm((f) => ({ ...f, priority: e.target.value }))}>
                {['low', 'normal', 'high'].map((a) => <option key={a}>{a}</option>)}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setAnnounceOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Publish</Button>
          </div>
        </form>
      </Modal>

      {/* Campaign */}
      <Modal open={campaignOpen} onClose={() => setCampaignOpen(false)} title="New campaign">
        <form onSubmit={createCampaign} className="grid gap-4">
          <Field label="Campaign name"><Input value={campaignForm.name} onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))} required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Channel">
              <Select value={campaignForm.channel} onChange={(e) => setCampaignForm((f) => ({ ...f, channel: e.target.value }))}>
                {['email', 'sms', 'push', 'social'].map((a) => <option key={a}>{a}</option>)}
              </Select>
            </Field>
            <Field label="Audience">
              <Select value={campaignForm.audience} onChange={(e) => setCampaignForm((f) => ({ ...f, audience: e.target.value }))}>
                {['all', 'lapsed', 'new', 'vip', 'prospects'].map((a) => <option key={a}>{a}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Subject / preview"><Input value={campaignForm.subject} onChange={(e) => setCampaignForm((f) => ({ ...f, subject: e.target.value }))} /></Field>
          <Field label="Budget (USD)"><Input type="number" value={campaignForm.budget} onChange={(e) => setCampaignForm((f) => ({ ...f, budget: e.target.value }))} /></Field>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setCampaignOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create draft</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
