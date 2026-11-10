import crypto from 'node:crypto';
import { env } from '../config/env.js';

/** Cloudinary signed direct upload: the browser uploads straight to Cloudinary (no Vercel body limit). */
export function cloudinarySignature(tenantId: string, kind: string) {
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = env();
  if (!cloud || !key || !secret) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `gyms/${tenantId}/${kind}`;
  const params: Record<string, string | number> = { folder, timestamp, colors: 'true' };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const signature = crypto.createHash('sha1').update(toSign + secret).digest('hex');
  return { cloudName: cloud, apiKey: key, timestamp, folder, signature, colors: 'true', uploadUrl: `https://api.cloudinary.com/v1_1/${cloud}/image/upload` };
}

/** Optionally attach a gym's custom domain to the client Vercel project. Best effort. */
export async function attachVercelDomain(domain: string): Promise<{ ok: boolean; message: string; verification?: unknown }> {
  const { VERCEL_TOKEN: token, VERCEL_PROJECT_ID: project, VERCEL_TEAM_ID: team } = env();
  if (!token || !project) return { ok: false, message: 'Vercel automation not configured; add the domain in Vercel manually.' };
  const qs = team ? `?teamId=${encodeURIComponent(team)}` : '';
  try {
    const res = await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(project)}/domains${qs}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: domain }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok && body?.error?.code !== 'domain_already_in_use') return { ok: false, message: body?.error?.message || `Vercel returned ${res.status}` };
    return { ok: true, message: body?.verified === false ? 'Added - DNS verification pending' : 'Domain attached', verification: body?.verification };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
