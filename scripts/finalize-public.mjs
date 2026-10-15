import fs from 'node:fs';
import path from 'node:path';

const siteDir = path.resolve('site');
const read = p => fs.readFileSync(p,'utf8');
const write = (p,s) => fs.writeFileSync(p,s,'utf8');

for (const name of fs.readdirSync(siteDir).filter(n=>n.endsWith('.html'))) {
  const file=path.join(siteDir,name);
  let html=read(file);

  // Remove unfinished/sample navigation from all public chrome.
  html=html.replace(/<a href="case-studies\.html"(?: aria-current="page")?>Case Studies<\/a>/g,'');
  html=html.replace(/<li><a href="case-studies\.html">Case Studies<\/a><\/li>/g,'');
  html=html.replace(/<li><a href="testimonials\.html">Testimonials<\/a><\/li>/g,'');

  // Avoid public-facing placeholder wording where illustrative imagery is intentional.
  html=html.replace(/placeholder image/gi,'illustrative image');

  if(name==='index.html'){
    // Remove the sample-testimonial launch block completely.
    html=html.replace(
      /<section class="section"><div class="container"><div class="section-head"><span class="eyebrow">Client feedback<\/span><h2>Sample testimonials<\/h2><p class="muted">Replace these sample statements with verified client feedback before launch\.<\/p><\/div><div class="grid grid-3" data-testimonials-grid><\/div><div style="margin-top:1\.2rem"><a class="btn btn-secondary" href="testimonials\.html">View all testimonials<\/a><\/div><\/div><\/section>/g,
      ''
    );
  }

  // Privacy/terms should be reachable from every standard footer.
  if(html.includes('class="footer-bottom"') && !html.includes('href="privacy.html"')){
    html=html.replace(
      /(<div class="footer-bottom">[\s\S]*?)(<\/div>\s*<\/div>\s*<\/footer>)/,
      `$1<span><a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a></span>$2`
    );
  }
  write(file,html);
}

// Production frontend should never fall back to sample content if the API is unavailable.
const mainPath=path.join(siteDir,'assets/js/main.js');
let main=read(mainPath);
main=main.replaceAll("fetchApi('/api/projects', samples.projects)","fetchApi('/api/projects', [])");
main=main.replaceAll("fetchApi('/api/testimonials', samples.testimonials)","fetchApi('/api/testimonials', [])");
main=main.replaceAll("fetchApi('/api/blog', samples.blog)","fetchApi('/api/blog', [])");
main=main.replace(/Placeholder image for/g,'Illustrative image for');

const oldRemote=`  document.querySelectorAll('[data-remote-support]').forEach(el => {
    const url = String(cfg.remoteSupportFileUrl || '').trim();
    if (!url) { el.hidden = true; return; }
    el.href = url;
  });`;
const newRemote=`  async function initRemoteSupportLinks() {
    let url = String(cfg.remoteSupportFileUrl || '').trim();
    let name = '';
    try {
      const res = await fetch(apiUrl('/api/settings/public'), { headers:{'Accept':'application/json'}, cache:'no-store' });
      if (res.ok) {
        const payload = await res.json();
        url = String(payload?.data?.remote_support_file_url || url).trim();
        name = String(payload?.data?.remote_support_file_name || '').trim();
      }
    } catch (_) {}
    document.querySelectorAll('[data-remote-support]').forEach(el => {
      if (!url) { el.hidden = true; return; }
      el.hidden = false;
      el.href = url;
      if (name) el.setAttribute('download', name);
    });
    document.querySelectorAll('[data-remote-status]').forEach(el => {
      if (url) {
        el.textContent = name ? \`Approved download ready: \${name}\` : 'Approved remote-support download is ready.';
        el.className = 'form-status show success';
      } else {
        el.textContent = 'No remote-support installer is currently published. Please open a support ticket first.';
        el.className = 'form-status show error';
      }
    });
  }
  initRemoteSupportLinks();`;
if(main.includes(oldRemote)) main=main.replace(oldRemote,newRemote);

const oldTestimonials=`  async function initTestimonials() {
    const grid = document.querySelector('[data-testimonials-grid]');
    if (!grid) return;
    const data = await fetchApi('/api/testimonials', []);
    grid.innerHTML = data.map(testimonialCard).join('');
  }`;
const newTestimonials=`  async function initTestimonials() {
    const grid = document.querySelector('[data-testimonials-grid]');
    if (!grid) return;
    const data = await fetchApi('/api/testimonials', []);
    if (!data.length) {
      grid.innerHTML = '<div class="empty-state">No client-approved testimonials are published yet.</div>';
      return;
    }
    grid.innerHTML = data.map(testimonialCard).join('');
  }`;
if(main.includes(oldTestimonials)) main=main.replace(oldTestimonials,newTestimonials);
write(mainPath,main);

// Public sitemap: indexable, production-ready pages only.
const base='https://owusuduahephraim1.github.io/nana-k-it-solutions-consult';
const pages=[
  ['/', 'weekly'],['/about.html','monthly'],['/services.html','monthly'],['/portfolio.html','monthly'],
  ['/blog.html','weekly'],['/faq.html','monthly'],['/contact.html','monthly'],['/quote.html','monthly'],
  ['/support.html','monthly'],['/remote-support.html','monthly'],['/knowledge-base.html','monthly'],
  ['/privacy.html','yearly'],['/terms.html','yearly']
];
const sitemap=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(([p,f])=>`  <url><loc>${base}${p}</loc><changefreq>${f}</changefreq></url>`).join('\n')}\n</urlset>\n`;
write(path.join(siteDir,'sitemap.xml'),sitemap);

console.log('Public readiness cleanup complete.');
