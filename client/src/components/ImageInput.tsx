import { useRef, useState } from 'react';
import { ImagePlus, Link2, Trash2, Upload } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button, Input, cx, useToast } from './ui';

export type Uploaded = { url: string; colors?: string[] };
type Kind = 'logo' | 'banner' | 'gallery' | 'about' | 'testimonial' | 'offer' | 'member';

/** Upload straight to Cloudinary with a server-signed request, or paste an https URL. */
export async function uploadImage(file: File, kind: Kind): Promise<Uploaded> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file');
  if (file.size > 8 * 1024 * 1024) throw new Error('Image must be under 8 MB');
  const { data: sig } = await api.post('/admin/website/uploads/sign', { kind });
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);
  form.append('colors', sig.colors);
  const res = await fetch(sig.uploadUrl, { method: 'POST', body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || 'Upload failed');
  return { url: body.secure_url, colors: (body.colors ?? []).map((c: [string, number]) => c[0]) };
}

export function ImageInput({ value, onChange, kind, label = 'Image', aspect = 'aspect-video', onUploaded }: { value: string; onChange: (url: string) => void; kind: Kind; label?: string; aspect?: string; onUploaded?: (u: Uploaded) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState(false);
  const [draft, setDraft] = useState('');
  const toast = useToast();

  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const u = await uploadImage(f, kind);
      onChange(u.url);
      onUploaded?.(u);
    } catch (e) {
      if (e instanceof ApiError && e.status === 501) { setPaste(true); toast('Uploads are not set up yet - paste an image link instead.', 'err'); }
      else toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
      if (file.current) file.current.value = '';
    }
  };

  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-ink">{label}</span>
      <div className={cx('group relative overflow-hidden rounded-brand border border-dashed border-line bg-surface2', aspect)}>
        {value ? (
          <img src={value} alt="" className="h-full w-full object-contain" />
        ) : (
          <button type="button" onClick={() => file.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-2 text-xs text-muted hover:text-ink">
            <ImagePlus className="h-6 w-6" /> {busy ? 'Uploading…' : 'Click to upload'}
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" loading={busy} icon={<Upload className="h-3.5 w-3.5" />} onClick={() => file.current?.click()}>Upload</Button>
        <Button type="button" size="sm" variant="ghost" icon={<Link2 className="h-3.5 w-3.5" />} onClick={() => setPaste((p) => !p)}>Paste link</Button>
        {value && <Button type="button" size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => onChange('')}>Remove</Button>}
      </div>
      {paste && (
        <div className="mt-2 flex gap-2">
          <Input placeholder="https://…" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <Button
            type="button"
            size="md"
            variant="secondary"
            onClick={() => {
              if (!/^https:\/\//i.test(draft.trim())) return toast('Link must start with https://', 'err');
              onChange(draft.trim());
              onUploaded?.({ url: draft.trim() });
              setDraft('');
              setPaste(false);
            }}
          >
            Use
          </Button>
        </div>
      )}
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
