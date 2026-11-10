/**
 * Role-based access control. The server is the source of truth: every protected
 * route declares the permission it needs, and the client only uses this list
 * to decide which menus to draw.
 */
export const PERMISSIONS = [
  'dashboard.view',
  'website.manage', // branding, banners, content, publish/rollback
  'media.upload',
  'offers.manage',
  'plans.read',
  'plans.manage',
  'members.read',
  'members.write',
  'members.delete',
  'leads.read',
  'leads.manage',
  'billing.read', // invoices, payments, collections (read)
  'payments.record', // sell memberships / record payments
  'billing.manage', // void invoices, refunds
  'expenses.manage',
  'reports.read',
  'settings.manage', // business settings: currency, tax, hours
  'staff.manage', // staff accounts and roles
  'audit.read',
  'classes.read',
  'classes.manage',
  'equipment.manage',
  'checkins.manage',
  'retail.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const STAFF_ROLES = ['owner', 'manager', 'frontdesk', 'accountant', 'editor', 'trainer'] as const;
export const ROLES = [...STAFF_ROLES, 'member'] as const;
export type Role = (typeof ROLES)[number];

const ALL = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: ALL,
  manager: [
    'dashboard.view', 'members.read', 'members.write', 'leads.read', 'leads.manage', 'plans.read',
    'billing.read', 'payments.record', 'billing.manage', 'reports.read', 'offers.manage',
    'classes.read', 'classes.manage', 'checkins.manage', 'equipment.manage', 'retail.manage', 'expenses.manage',
  ],
  frontdesk: ['dashboard.view', 'members.read', 'members.write', 'plans.read', 'payments.record', 'leads.read', 'checkins.manage'],
  accountant: ['dashboard.view', 'billing.read', 'reports.read', 'plans.read'],
  editor: ['website.manage', 'media.upload', 'offers.manage', 'plans.read'],
  trainer: ['dashboard.view', 'classes.read', 'classes.manage', 'members.read', 'checkins.manage'],
  member: [],
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner / Admin',
  manager: 'Manager',
  frontdesk: 'Front desk',
  accountant: 'Accountant',
  editor: 'Content editor',
  trainer: 'Trainer',
  member: 'Member',
};

export const permissionsFor = (role: Role): Permission[] => [...(ROLE_PERMISSIONS[role] ?? [])];
export const can = (role: Role, p: Permission) => (ROLE_PERMISSIONS[role] ?? []).includes(p);
