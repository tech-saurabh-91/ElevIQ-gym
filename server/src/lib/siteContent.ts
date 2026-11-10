import { z } from 'zod';
import { buildTheme, HEX_RX } from './theme.js';

const url = z.string().trim().max(2000).refine((v) => v === '' || /^https:\/\//i.test(v) || v.startsWith('/'), 'Must be an https:// URL');
const text = (max = 200) => z.string().trim().max(max).default('');
const id = z.string().min(1).max(40);
const hex = z.string().regex(HEX_RX, 'Invalid colour');

/** Everything the public website renders. Nothing gym-specific lives in code. */
export const siteContentSchema = z.object({
  brand: z.object({
    name: z.string().trim().min(1).max(80),
    tagline: text(160),
    logoUrl: url.default(''),
    logoDarkUrl: url.default(''),
    faviconUrl: url.default(''),
    seed: z.object({ primary: hex, secondary: hex.optional(), accent: hex.optional() }),
    mode: z.enum(['light', 'dark', 'auto']).default('auto'),
    font: z.enum(['modern', 'classic', 'bold', 'rounded']).default('modern'),
  }),
  banners: z
    .array(
      z.object({
        id, title: text(120), subtitle: text(300), imageUrl: url.default(''),
        ctaLabel: text(40),
        ctaHref: z
          .string()
          .trim()
          .max(300)
          .refine((v) => v === '' || /^(\/(?!\/)|#|https:\/\/|tel:|mailto:)/i.test(v), 'Link must start with /, #, https://, tel: or mailto:')
          .default(''),
        active: z.boolean().default(true),
      })
    )
    .max(10)
    .default([]),
  about: z.object({
    title: text(120),
    body: text(5000),
    imageUrl: url.default(''),
    highlights: z.array(z.object({ id, label: text(60), value: text(30) })).max(8).default([]),
  }),
  testimonials: z
    .array(z.object({ id, name: text(80), role: text(80), quote: text(800), rating: z.number().int().min(1).max(5).default(5), photoUrl: url.default('') }))
    .max(30)
    .default([]),
  faq: z.array(z.object({ id, q: text(300), a: text(2000) })).max(40).default([]),
  gallery: z.array(z.object({ id, url, caption: text(160), category: text(40) })).max(80).default([]),
  contact: z.object({
    phone: text(40), whatsapp: text(40), email: text(120), address: text(400),
    mapQuery: text(300), // e.g. "Gym name, street, city" — rendered as an embedded map
  }),
  social: z.object({
    instagram: url.default(''), facebook: url.default(''), youtube: url.default(''),
    x: url.default(''), tiktok: url.default(''), linkedin: url.default(''),
  }),
  sections: z
    .object({
      offers: z.boolean().default(true), plans: z.boolean().default(true), about: z.boolean().default(true),
      gallery: z.boolean().default(true), testimonials: z.boolean().default(true), faq: z.boolean().default(true),
      hours: z.boolean().default(true), contact: z.boolean().default(true),
    })
    .default({}),
  seo: z.object({ title: text(70), description: text(170) }).default({ title: '', description: '' }),
});

export type SiteContent = z.infer<typeof siteContentSchema>;

export function defaultSiteContent(name: string): SiteContent {
  return siteContentSchema.parse({
    brand: { name, tagline: 'Stronger every day', seed: { primary: '#2563eb' } },
    banners: [
      {
        id: 'b1',
        title: `Welcome to ${name}`,
        subtitle: 'Modern equipment, expert coaches and a community that keeps you going.',
        imageUrl: '',
        ctaLabel: 'Join now',
        ctaHref: '/join',
      },
    ],
    about: { title: `About ${name}`, body: 'Tell visitors your story here.', highlights: [] },
    testimonials: [],
    faq: [],
    gallery: [],
    contact: { phone: '', whatsapp: '', email: '', address: '', mapQuery: '' },
    social: {},
  });
}

/** Content + derived theme, ready for the client. */
export const withTheme = (content: SiteContent) => ({ ...content, theme: buildTheme(content.brand.seed) });
