export const ADMIN_EMAILS = new Set([
  'info@fulluproar.com',
  'shawnoah.pollock@gmail.com',
]);

export function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase());
}
