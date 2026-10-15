import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('site');
const base='https://owusuduahephraim1.github.io/nana-k-it-solutions-consult';
const failures=[];
const warnings=[];

function fail(message){ failures.push(message); }
function warn(message){ warnings.push(message); }
function read(rel){ return fs.readFileSync(path.join(root,rel),'utf8'); }
function exists(rel){ return fs.existsSync(path.join(root,rel)); }

const htmlFiles=fs.readdirSync(root).filter(name=>name.endsWith('.html')).sort();
const required=['index.html','about.html','services.html','portfolio.html','blog.html','faq.html','contact.html','quote.html','support.html','remote-support.html','knowledge-base.html','privacy.html','terms.html','404.html','admin.html','client-portal.html'];
for(const rel of required) if(!exists(rel)) fail(`Missing required page: ${rel}`);

const privatePages=new Set(['admin.html','client-portal.html','case-studies.html','testimonials.html','404.html']);
const stalePhrases=[
  'Sample testimonials',
  'Replace these sample',
  'authentication is intentionally disabled',
  'secure portal placeholder',
  'starter build does not expose',
  'future secure authentication'
];

for(const rel of htmlFiles){
  const html=read(rel);

  // Check local href/src references.
  const refs=[...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)].map(m=>m[1]);
  for(const raw of refs){
    if(!raw || /^(?:https?:|mailto:|tel:|sms:|javascript:|data:|#)/i.test(raw)) continue;
    const clean=raw.split('#')[0].split('?')[0];
    if(!clean) continue;
    const target=clean.startsWith('/') ? clean.replace(/^\/+/, '') : path.posix.normalize(path.posix.join(path.posix.dirname(rel),clean));
    if(!exists(target)) fail(`${rel}: broken local reference -> ${raw}`);
  }

  if(privatePages.has(rel)){
    if(!/<meta\s+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html) &&
       !/<meta\s+content=["'][^"']*noindex[^"']*["'][^>]*name=["']robots["']/i.test(html)){
      fail(`${rel}: should be noindex`);
    }
  }

  if(!privatePages.has(rel)){
    for(const phrase of stalePhrases){
      if(html.toLowerCase().includes(phrase.toLowerCase())) fail(`${rel}: stale pre-launch wording: "${phrase}"`);
    }
  }

  if(html.includes('https://nanakitsolutions.com')) fail(`${rel}: stale unowned custom-domain URL remains`);
}

// Validate sitemap URLs and target files.
if(!exists('sitemap.xml')) fail('Missing sitemap.xml');
else{
  const sitemap=read('sitemap.xml');
  const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  for(const url of urls){
    if(!url.startsWith(base)) fail(`Sitemap URL outside production Pages base: ${url}`);
    const suffix=url.slice(base.length);
    const rel=suffix==='/'||suffix===''?'index.html':suffix.replace(/^\//,'');
    if(!exists(rel)) fail(`Sitemap target missing: ${url}`);
    if(privatePages.has(rel)) fail(`Private/noindex page must not be in sitemap: ${rel}`);
  }
}

// Verify static canonical URLs for sitemap-listed public HTML pages.
const sitemap=exists('sitemap.xml')?read('sitemap.xml'):'';
for(const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)){
  const url=match[1];
  const suffix=url.slice(base.length);
  const rel=suffix==='/'||suffix===''?'index.html':suffix.replace(/^\//,'');
  if(!rel.endsWith('.html')||!exists(rel)) continue;
  const html=read(rel);
  const canonical=(html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)||[])[1]
    || (html.match(/<link\s+href=["']([^"']+)["']\s+rel=["']canonical["']/i)||[])[1];
  if(canonical!==url) fail(`${rel}: canonical mismatch. Expected ${url}, got ${canonical||'missing'}`);
}

// Operational configuration sanity.
const config=read('assets/js/config.js');
if(!config.includes('nana-k-it-solutions-consult-api.edusentia-enterprise-neon.workers.dev')) fail('Frontend Worker URL is missing or incorrect.');
if(!config.includes('0x4AAAAAAFWx04AEskoZCBMj')) fail('Authorized Turnstile site key is missing.');
if(!config.includes('neonAuthUrl')) fail('Neon Auth URL is missing from frontend config.');

const robots=read('robots.txt');
if(!robots.includes(base+'/sitemap.xml')) fail('robots.txt does not reference the production sitemap.');

for(const w of warnings) console.warn('WARNING:',w);
if(failures.length){
  console.error('\nSite validation failed:');
  for(const f of failures) console.error(' -',f);
  process.exit(1);
}
console.log(`Site validation passed: ${htmlFiles.length} HTML files checked, sitemap verified, private pages protected from indexing.`);
