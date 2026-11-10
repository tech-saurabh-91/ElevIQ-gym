export type ThemeTokens = {
  bg: string; surface: string; surface2: string; border: string; text: string; muted: string;
  primary: string; onPrimary: string; secondary: string; onSecondary: string; accent: string; onAccent: string; link: string;
};
export type Theme = { seed: { primary: string; secondary: string; accent: string }; light: ThemeTokens; dark: ThemeTokens; checks: { name: string; ratio: number; pass: boolean }[] };

export type Banner = { id: string; title: string; subtitle: string; imageUrl: string; ctaLabel: string; ctaHref: string; active: boolean };
export type SiteContent = {
  brand: { name: string; tagline: string; logoUrl: string; logoDarkUrl: string; faviconUrl: string; seed: { primary: string; secondary?: string; accent?: string }; mode: 'light' | 'dark' | 'auto'; font: 'modern' | 'classic' | 'bold' | 'rounded' };
  banners: Banner[];
  about: { title: string; body: string; imageUrl: string; highlights: { id: string; label: string; value: string }[] };
  testimonials: { id: string; name: string; role: string; quote: string; rating: number; photoUrl: string }[];
  faq: { id: string; q: string; a: string }[];
  gallery: { id: string; url: string; caption: string; category: string }[];
  contact: { phone: string; whatsapp: string; email: string; address: string; mapQuery: string };
  social: { instagram: string; facebook: string; youtube: string; x: string; tiktok: string; linkedin: string };
  sections: Record<'offers' | 'plans' | 'about' | 'gallery' | 'testimonials' | 'faq' | 'hours' | 'contact', boolean>;
  seo: { title: string; description: string };
};

export type Hours = { day: number; open: string; close: string; closed: boolean };
export type Quote = {
  planId: string; planName: string; category: string; currency: string; base: number; joiningFee: number; subtotal: number; discount: number;
  offer: { id: string; title: string; code: string; badgeText: string } | null; codeRejected: boolean;
  taxLabel: string; taxRate: number; taxInclusive: boolean; tax: number; total: number; startsAt?: string; endsAt?: string;
};
export type PublicPlan = { _id: string; name: string; description: string; features: string[]; durationDays: number; billingLabel: string; joiningFee: number; highlight: boolean; quotes: Record<string, Quote> };
export type PublicOffer = {
  _id: string; title: string; description: string; discountType: 'percent' | 'flat'; value: number; code: string; autoApply: boolean; endsAt: string;
  display: { bar: boolean; popup: boolean; banner: boolean; badge: boolean }; badgeText: string; imageUrl: string; planIds: string[]; categories: string[];
};
export type PublicSite = {
  tenant: { name: string; slug: string; setupCompleted: boolean; status: string };
  settings: { currency: string; locale: string; timezone: string; hours: Hours[]; categories: string[]; tax: { label: string; rate: number; inclusive: boolean } };
  site: SiteContent & { theme: Theme };
  plans: PublicPlan[];
  offers: PublicOffer[];
  published: boolean;
  preview?: boolean;
};

export type Role = 'owner' | 'manager' | 'frontdesk' | 'accountant' | 'editor' | 'trainer' | 'member';
export type Permission =
  | 'dashboard.view' | 'website.manage' | 'media.upload' | 'offers.manage' | 'plans.read' | 'plans.manage'
  | 'members.read' | 'members.write' | 'members.delete' | 'leads.read' | 'leads.manage' | 'billing.read'
  | 'payments.record' | 'billing.manage' | 'expenses.manage' | 'reports.read' | 'settings.manage' | 'staff.manage'
  | 'audit.read' | 'classes.read' | 'classes.manage' | 'equipment.manage' | 'checkins.manage' | 'retail.manage';

export type SessionUser = { _id: string; name: string; email: string; role: Role; roleLabel: string; member?: string; phone?: string };

export type Paged<T> = { data: T[]; pagination: { page: number; limit: number; total: number; pages: number } };
