(() => {
  const cfg = window.NANAK_CONFIG || {};
  const baseText = String(cfg.siteUrl || '').replace(/\/$/, '');
  if (!baseText) return;

  let base;
  try { base = new URL(baseText); } catch (_) { return; }

  const basePath = base.pathname.replace(/\/$/, '');
  let path = location.pathname || '/';
  if (basePath && path.startsWith(basePath)) {
    path = path.slice(basePath.length) || '/';
  }
  if (path === '/index.html') path = '/';

  const isDynamic = /\/(project|blog-post)\.html$/.test(path);
  const suffix = isDynamic ? location.search : '';
  const canonicalUrl = `${baseText}${path === '/' ? '/' : path}${suffix}`;

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = canonicalUrl;

  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.content = canonicalUrl;

  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) ogImage.content = `${baseText}/assets/images/logo.png`;

  document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    try {
      const data = JSON.parse(script.textContent || '{}');
      if (data && typeof data === 'object') {
        if (data.url) data.url = baseText;
        if (data.logo) data.logo = `${baseText}/assets/images/logo.png`;
        if (data.email && cfg.email) data.email = cfg.email;
        if (Array.isArray(data.sameAs)) {
          data.sameAs = Object.values(cfg.social || {}).filter(Boolean);
        }
        script.textContent = JSON.stringify(data);
      }
    } catch (_) {}
  });
})();
