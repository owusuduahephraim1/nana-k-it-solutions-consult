import { createAuthClient } from 'https://esm.sh/@neondatabase/auth?bundle';

const cfg = window.NANAK_CONFIG || {};
export const authClient = createAuthClient(cfg.neonAuthUrl);

export async function getSession() {
  const result = await authClient.getSession();
  return result?.data || null;
}
export async function getBearerToken() {
  const result = await authClient.token();
  const token = result?.data?.token;
  if (!token) throw new Error(result?.error?.message || 'Could not create an authenticated session token.');
  return token;
}
export async function api(path, options={}) {
  const token = await getBearerToken();
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type','application/json');
  }
  const response = await fetch(`${String(cfg.apiBaseUrl || '').replace(/\/$/,'')}${path}`, {
    ...options,
    headers
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}
export function escapeHtml(value='') {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}
export function slugify(value='') {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
}
