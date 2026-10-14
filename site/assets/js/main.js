(() => {
  const cfg = window.NANAK_CONFIG || {};
  const samples = window.NANAK_SAMPLE_DATA || { projects: [], testimonials: [], blog: [] };

  const apiUrl = (path) => `${(cfg.apiBaseUrl || '').replace(/\/$/, '')}${path}`;
  const escapeHtml = (value='') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const safeImage = (value) => value || 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80';
  const slugify = (v='') => String(v).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  const stars = (rating=5) => '<span aria-label="' + rating + ' out of 5 stars">' + '★'.repeat(Math.max(0, Math.min(5, Number(rating)||0))) + '☆'.repeat(5-Math.max(0, Math.min(5, Number(rating)||0))) + '</span>';

  // Mobile navigation
  const navToggle = document.querySelector('[data-nav-toggle]');
  const navLinks = document.querySelector('[data-nav-links]');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }));
  }

  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

  const social = cfg.social || {};
  document.querySelectorAll('.socials').forEach(group => {
    group.querySelectorAll('a').forEach(el => {
      const label = String(el.getAttribute('aria-label') || '').toLowerCase();
      const key = label === 'x' ? 'twitter' : label;
      const url = String(social[key] || '').trim();
      if (!url) {
        el.hidden = true;
      } else {
        el.href = url;
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
      }
    });
  });

  document.querySelectorAll('[data-whatsapp]').forEach(el => {
    const num = String(cfg.whatsappNumber || '').replace(/\D/g, '');
    if (!num) { el.hidden = true; return; }
    el.href = `https://wa.me/${num}?text=${encodeURIComponent('Hello Nana K IT Solutions Consult, I would like to make an enquiry.')}`;
  });
  document.querySelectorAll('[data-remote-support]').forEach(el => {
    const url = String(cfg.remoteSupportFileUrl || '').trim();
    if (!url) { el.hidden = true; return; }
    el.href = url;
  });

  // Analytics placeholder. It activates only after replacing G-XXXXXXXXXX.
  if (cfg.googleAnalyticsId && cfg.googleAnalyticsId !== 'G-XXXXXXXXXX') {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.googleAnalyticsId)}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', cfg.googleAnalyticsId);
  }

  // FAQ accordion
  document.querySelectorAll('.faq-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const open = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  // Forms
  function showStatus(form, message, type='success') {
    const box = form.querySelector('.form-status');
    if (!box) return;

    clearTimeout(box._hideTimer);
    clearTimeout(box._cleanupTimer);

    box.textContent = message;
    box.className = `form-status show ${type}`;
    box.setAttribute('role', 'status');

    if (type === 'success') {
      box._hideTimer = setTimeout(() => {
        box.classList.add('hide-motion');
        box._cleanupTimer = setTimeout(() => {
          box.className = 'form-status';
          box.textContent = '';
        }, 350);
      }, 2000);
    }
  }

  async function submitJsonForm(form) {
    const path = form.dataset.apiPath;
    if (!path) return;
    const button = form.querySelector('button[type="submit"]');
    const original = button ? button.innerHTML : '';
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.website) return; // honeypot: fail silently for bots
    delete data.website;
    try {
      if (button) { button.disabled = true; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...'; }
      const res = await fetch(apiUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Your request could not be submitted.');
      showStatus(form, payload.message || 'Thank you. Your request has been submitted.', 'success');
      form.reset();
    } catch (err) {
      showStatus(form, `${err.message} If this continues, email ${cfg.email || 'nduah385@gmail.com'}.`, 'error');
    } finally {
      if (button) { button.disabled = false; button.innerHTML = original; }
    }
  }
  document.querySelectorAll('form[data-api-path]').forEach(form => form.addEventListener('submit', e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (cfg.turnstileSiteKey) {
      const token = form.querySelector('[name="cf-turnstile-response"]')?.value?.trim();
      if (!token) {
        const ready = form.dataset.turnstileReady === 'true';
        showStatus(
          form,
          ready
            ? 'Please complete the security verification before submitting.'
            : 'Security verification could not finish loading. Refresh the page and try again.',
          'error'
        );
        return;
      }
    }
    submitJsonForm(form);
  }));

  async function fetchApi(path, fallback) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(apiUrl(path), { signal: controller.signal, headers: { 'Accept': 'application/json' }});
      clearTimeout(timer);
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      return Array.isArray(json) ? json : (json.data || fallback);
    } catch (_) { return fallback; }
  }

  function projectCard(p) {
    const slug = p.slug || slugify(p.title);
    return `<article class="media-card card-hover project-card" data-category="${escapeHtml(p.category)}">
      <img src="${escapeHtml(safeImage(p.image_url))}" alt="Placeholder image for ${escapeHtml(p.title)}" loading="lazy" referrerpolicy="no-referrer">
      <div class="body">
        <span class="badge">${escapeHtml(p.category)}</span>
        <h3 style="margin-top:.75rem">${escapeHtml(p.title)}</h3>
        <p class="muted">${escapeHtml(p.description)}</p>
        <a href="project.html?slug=${encodeURIComponent(slug)}" class="btn btn-secondary">View project <i class="fa-solid fa-arrow-right"></i></a>
      </div>
    </article>`;
  }

  async function initPortfolio() {
    const grid = document.querySelector('[data-project-grid]');
    if (!grid) return;
    const data = await fetchApi('/api/projects', samples.projects);
    grid.innerHTML = data.map(projectCard).join('');
    const buttons = document.querySelectorAll('[data-filter]');
    buttons.forEach(btn => btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.filter;
      grid.querySelectorAll('.project-card').forEach(card => {
        card.hidden = !(f === 'All' || card.dataset.category === f);
      });
    }));
  }

  async function initProjectDetail() {
    const root = document.querySelector('[data-project-detail]');
    if (!root) return;
    const slug = new URLSearchParams(location.search).get('slug');
    const data = await fetchApi('/api/projects', samples.projects);
    const p = data.find(x => (x.slug || slugify(x.title)) === slug) || data[0];
    if (!p) { root.innerHTML = '<div class="empty-state">Project not found.</div>'; return; }
    document.title = `${p.title} | Nana K IT Solutions Consult`;
    root.innerHTML = `<div class="split">
      <div><span class="badge">${escapeHtml(p.category)}</span><h1 style="font-size:clamp(2rem,4vw,3.5rem);margin-top:.8rem">${escapeHtml(p.title)}</h1><p class="lead">${escapeHtml(p.description)}</p></div>
      <img class="image-cover" style="min-height:340px" src="${escapeHtml(safeImage(p.image_url))}" alt="Placeholder image for ${escapeHtml(p.title)}" referrerpolicy="no-referrer">
    </div>
    <div class="grid grid-2" style="margin-top:2rem">
      <section class="card"><div class="icon-box"><i class="fa-solid fa-triangle-exclamation"></i></div><h2 style="font-size:1.4rem">Challenge</h2><p>${escapeHtml(p.challenge)}</p></section>
      <section class="card"><div class="icon-box"><i class="fa-solid fa-screwdriver-wrench"></i></div><h2 style="font-size:1.4rem">Solution provided</h2><p>${escapeHtml(p.solution)}</p></section>
      <section class="card"><div class="icon-box"><i class="fa-solid fa-microchip"></i></div><h2 style="font-size:1.4rem">Technologies used</h2><p>${escapeHtml(p.technologies)}</p></section>
      <section class="card"><div class="icon-box"><i class="fa-solid fa-chart-line"></i></div><h2 style="font-size:1.4rem">Result / impact</h2><p>${escapeHtml(p.result)}</p></section>
    </div>`;
  }

  function testimonialCard(t) {
    return `<article class="card"><div class="stars">${stars(t.rating)}</div><div class="quote-mark">“</div><p>${escapeHtml(t.quote)}</p><strong>${escapeHtml(t.client_name)}</strong><div class="muted">${escapeHtml(t.company || '')}</div></article>`;
  }
  async function initTestimonials() {
    const grid = document.querySelector('[data-testimonials-grid]');
    if (!grid) return;
    const data = await fetchApi('/api/testimonials', samples.testimonials);
    grid.innerHTML = data.map(testimonialCard).join('');
  }

  function blogCard(p) {
    return `<article class="media-card card-hover">
      <img src="${escapeHtml(safeImage(p.image_url))}" alt="Placeholder image for ${escapeHtml(p.title)}" loading="lazy" referrerpolicy="no-referrer">
      <div class="body"><span class="badge">${escapeHtml(p.category || 'Insights')}</span><h3 style="margin-top:.75rem">${escapeHtml(p.title)}</h3><p class="muted">${escapeHtml(p.excerpt || '')}</p><a class="btn btn-secondary" href="blog-post.html?slug=${encodeURIComponent(p.slug)}">Read article <i class="fa-solid fa-arrow-right"></i></a></div>
    </article>`;
  }
  async function initBlog() {
    const grid = document.querySelector('[data-blog-grid]');
    if (!grid) return;
    const data = await fetchApi('/api/blog', samples.blog);
    grid.innerHTML = data.map(blogCard).join('');
    const search = document.querySelector('[data-blog-search]');
    if (search) search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      grid.innerHTML = data.filter(p => `${p.title} ${p.category} ${p.excerpt}`.toLowerCase().includes(q)).map(blogCard).join('') || '<div class="empty-state">No articles match your search.</div>';
    });
  }

  async function initBlogPost() {
    const root = document.querySelector('[data-blog-post]');
    if (!root) return;
    const slug = new URLSearchParams(location.search).get('slug');
    const data = await fetchApi('/api/blog', samples.blog);
    const p = data.find(x => x.slug === slug) || data[0];
    if (!p) { root.innerHTML = '<div class="empty-state">Article not found.</div>'; return; }
    document.title = `${p.title} | Nana K IT Solutions Consult`;
    root.innerHTML = `<article class="article"><span class="badge">${escapeHtml(p.category || 'Insights')}</span><h1 style="font-size:clamp(2rem,5vw,3.6rem);margin-top:.8rem">${escapeHtml(p.title)}</h1><div class="meta"><span><i class="fa-regular fa-calendar"></i> ${escapeHtml(p.published_at ? new Date(p.published_at).toLocaleDateString() : 'Sample article')}</span><span><i class="fa-regular fa-clock"></i> 4 min read</span></div><img class="image-cover" style="max-height:430px" src="${escapeHtml(safeImage(p.image_url))}" alt="Placeholder image for ${escapeHtml(p.title)}" referrerpolicy="no-referrer"><div class="article-content">${p.content || '<p>Article content will be published soon.</p>'}</div></article>`;
  }

  initPortfolio();
  initProjectDetail();
  initTestimonials();
  initBlog();
  initBlogPost();
})();
