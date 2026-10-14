// Nana K IT Solutions Consult API
import { neon } from '@neondatabase/serverless';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || 'https://owusuduahephraim1.github.io,https://nanakitsolutions.com,https://www.nanakitsolutions.com')
    .split(',').map(x => x.trim()).filter(Boolean);
}
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = getAllowedOrigins(env);
  const selected = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': selected || 'https://owusuduahephraim1.github.io',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Upload-Key',
    'Vary': 'Origin'
  };
}
function originAllowed(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return getAllowedOrigins(env).includes(origin);
}
function json(data, status=200, request=null, env=null) {
  const headers = { ...JSON_HEADERS, ...(request && env ? corsHeaders(request, env) : {}) };
  return new Response(JSON.stringify(data), { status, headers });
}
function text(value, status=200, headers={}) { return new Response(value, { status, headers }); }
function required(value, name, max=5000) {
  const v = String(value ?? '').trim();
  if (!v) throw new Error(`${name} is required.`);
  if (v.length > max) throw new Error(`${name} is too long.`);
  return v;
}
function optional(value, max=5000) {
  const v = String(value ?? '').trim();
  if (v.length > max) throw new Error('One of the submitted fields is too long.');
  return v || null;
}
function email(value) {
  const v = required(value, 'Email', 180).toLowerCase();
  if (!EMAIL_RE.test(v)) throw new Error('Enter a valid email address.');
  return v;
}
function assertNoHoneypot(body) {
  if (String(body.website || '').trim()) throw new Error('Invalid form submission.');
}
async function readJson(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new Error('Content-Type must be application/json.');
  return request.json();
}
function db(env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  return neon(env.DATABASE_URL);
}
function errorResponse(err, request, env) {
  console.error(err);
  const known = /required|valid|too long|Invalid form/.test(err.message || '');
  return json({ error: known ? err.message : 'The server could not process the request.' }, known ? 400 : 500, request, env);
}

async function handleContact(request, env) {
  try {
    const body = await readJson(request); assertNoHoneypot(body);
    const sql = db(env);
    const row = await sql.query(`INSERT INTO contacts (name,email,phone,subject,message) VALUES ($1,$2,$3,$4,$5) RETURNING id,created_at`, [required(body.name,'Name',120),email(body.email),optional(body.phone,40),required(body.subject,'Subject',180),required(body.message,'Message',5000)]);
    return json({ message:'Thank you. Your message has been received.', id: row[0]?.id }, 201, request, env);
  } catch (e) { return errorResponse(e, request, env); }
}
async function handleQuote(request, env) {
  try {
    const body = await readJson(request); assertNoHoneypot(body);
    const sql = db(env);
    const preferred = required(body.preferred_date,'Preferred date',60);
    const row = await sql.query(`INSERT INTO quotes (name,email,phone,service_type,description,preferred_date) VALUES ($1,$2,$3,$4,$5,$6::timestamptz) RETURNING id,created_at`, [required(body.name,'Name',120),email(body.email),required(body.phone,'Phone',40),required(body.service_type,'Service type',120),required(body.description,'Description',5000),preferred]);
    return json({ message:'Your consultation request has been submitted.', id: row[0]?.id }, 201, request, env);
  } catch (e) { return errorResponse(e, request, env); }
}
async function handleTicket(request, env) {
  try {
    const body = await readJson(request); assertNoHoneypot(body);
    const priority = required(body.priority,'Priority',10).toLowerCase();
    if (!['low','medium','high'].includes(priority)) throw new Error('Priority must be low, medium, or high.');
    const sql = db(env);
    const row = await sql.query(`INSERT INTO tickets (name,email,issue_type,description,priority) VALUES ($1,$2,$3,$4,$5) RETURNING id,ticket_number,created_at`, [required(body.name,'Name',120),email(body.email),required(body.issue_type,'Issue type',120),required(body.description,'Description',5000),priority]);
    return json({ message:`Support ticket ${row[0]?.ticket_number || ''} has been submitted.`, id:row[0]?.id, ticket_number:row[0]?.ticket_number }, 201, request, env);
  } catch (e) { return errorResponse(e, request, env); }
}
async function handleNewsletter(request, env) {
  try {
    const body = await readJson(request); assertNoHoneypot(body);
    const sql = db(env);
    const addr = email(body.email);
    await sql.query(`INSERT INTO newsletter_subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, [addr]);
    return json({ message:'Subscription received. Thank you.' }, 201, request, env);
  } catch (e) { return errorResponse(e, request, env); }
}
async function listProjects(request, env) {
  try { const rows = await db(env).query(`SELECT id,title,slug,category,description,challenge,solution,technologies,result,image_url,created_at FROM projects ORDER BY created_at DESC`); return json({data:rows},200,request,env); } catch(e){ return errorResponse(e,request,env); }
}
async function listTestimonials(request, env) {
  try { const rows = await db(env).query(`SELECT id,client_name,company,quote,rating,created_at FROM testimonials ORDER BY created_at DESC`); return json({data:rows},200,request,env); } catch(e){ return errorResponse(e,request,env); }
}
async function listBlog(request, env) {
  try { const rows = await db(env).query(`SELECT id,title,slug,content,excerpt,category,image_url,published_at FROM blog_posts WHERE published_at IS NULL OR published_at <= now() ORDER BY published_at DESC NULLS LAST, id DESC`); return json({data:rows},200,request,env); } catch(e){ return errorResponse(e,request,env); }
}

function cleanKey(input) {
  const key = decodeURIComponent(input).replace(/^\/+/, '');
  if (!key || key.includes('..') || key.includes('\\')) throw new Error('Invalid file key.');
  return key;
}
async function uploadFile(request, env) {
  if (!env.R2_UPLOAD_SECRET) return json({error:'R2 upload is not configured.'},503,request,env);
  if (request.headers.get('X-Admin-Upload-Key') !== env.R2_UPLOAD_SECRET) return json({error:'Unauthorized.'},401,request,env);
  try {
    const form = await request.formData();
    const file = form.get('file');
    const folder = String(form.get('folder') || 'uploads').replace(/[^a-zA-Z0-9/_-]/g,'').replace(/^\/+|\/+$/g,'') || 'uploads';
    if (!(file instanceof File)) throw new Error('A file field is required.');
    const maxBytes = Number(env.MAX_UPLOAD_BYTES || 20 * 1024 * 1024);
    if (file.size > maxBytes) return json({error:`File exceeds the ${Math.round(maxBytes/1024/1024)} MB limit.`},413,request,env);
    const base = file.name.replace(/[^a-zA-Z0-9._-]/g,'-').replace(/-+/g,'-');
    const key = cleanKey(`${folder}/${Date.now()}-${crypto.randomUUID()}-${base}`);
    await env.STORAGE.put(key, file.stream(), { httpMetadata: { contentType: file.type || 'application/octet-stream', cacheControl: 'public, max-age=86400' }, customMetadata: { originalName: file.name } });
    const publicBase = String(env.R2_PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/$/,'');
    return json({message:'File uploaded.', key, url:`${publicBase}/files/${encodeURI(key)}`},201,request,env);
  } catch(e) { return errorResponse(e,request,env); }
}
async function serveFile(request, env, keyPart) {
  try {
    const key = cleanKey(keyPart);
    const object = await env.STORAGE.get(key);
    if (!object) return text('Not found',404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('ETag', object.httpEtag);
    headers.set('Cache-Control', headers.get('Cache-Control') || 'public, max-age=86400');
    headers.set('X-Content-Type-Options','nosniff');
    return new Response(object.body,{headers});
  } catch (_) { return text('Bad request',400); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      if (!originAllowed(request, env)) return new Response(null,{status:403});
      return new Response(null,{status:204,headers:corsHeaders(request,env)});
    }
    if (url.pathname.startsWith('/api/') && !originAllowed(request, env)) return json({error:'Origin not allowed.'},403,request,env);

    if (request.method === 'GET' && url.pathname === '/api/health') return json({ok:true,service:'nanak-it-api'},200,request,env);
    if (request.method === 'POST' && url.pathname === '/api/contact') return handleContact(request,env);
    if (request.method === 'POST' && url.pathname === '/api/quote') return handleQuote(request,env);
    if (request.method === 'POST' && url.pathname === '/api/ticket') return handleTicket(request,env);
    if (request.method === 'POST' && url.pathname === '/api/newsletter') return handleNewsletter(request,env);
    if (request.method === 'GET' && url.pathname === '/api/projects') return listProjects(request,env);
    if (request.method === 'GET' && url.pathname === '/api/testimonials') return listTestimonials(request,env);
    if (request.method === 'GET' && url.pathname === '/api/blog') return listBlog(request,env);
    if (request.method === 'POST' && url.pathname === '/api/files/upload') return uploadFile(request,env);
    if (request.method === 'GET' && url.pathname.startsWith('/files/')) return serveFile(request,env,url.pathname.slice('/files/'.length));
    return json({error:'Not found.'},404,request,env);
  }
};
