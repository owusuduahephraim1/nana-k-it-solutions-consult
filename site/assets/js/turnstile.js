(() => {
  const cfg = window.NANAK_CONFIG || {};
  const sitekey = String(cfg.turnstileSiteKey || '').trim();
  if (!sitekey) return;

  const protectedForms = [...document.querySelectorAll('form[data-api-path]')];
  if (!protectedForms.length) return;

  const ensureTokenInput = (form) => {
    let input = form.querySelector('input[name="cf-turnstile-response"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'cf-turnstile-response';
      form.appendChild(input);
    }
    return input;
  };

  const ensureMount = (form) => {
    let mount = form.querySelector('.turnstile-mount');
    if (!mount) {
      mount = document.createElement('div');
      mount.className = 'turnstile-mount';
      mount.style.marginTop = '1rem';
      mount.style.minHeight = '65px';
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.before(mount); else form.appendChild(mount);
    }
    return mount;
  };

  const setReady = (form, ready) => {
    form.dataset.turnstileReady = ready ? 'true' : 'false';
  };

  protectedForms.forEach(form => {
    setReady(form, false);
    ensureTokenInput(form);
    ensureMount(form);
  });

  const renderWidgets = () => {
    if (!window.turnstile || typeof window.turnstile.render !== 'function') return false;

    protectedForms.forEach(form => {
      if (form.dataset.turnstileRendered === 'true') return;

      const tokenInput = ensureTokenInput(form);
      const mount = ensureMount(form);

      try {
        const widgetId = window.turnstile.render(mount, {
          sitekey,
          appearance: 'always',
          execution: 'render',
          theme: 'auto',
          retry: 'auto',
          'retry-interval': 5000,
          'refresh-expired': 'auto',
          callback(token) {
            tokenInput.value = token || '';
            setReady(form, true);
          },
          'expired-callback'() {
            tokenInput.value = '';
            setReady(form, true);
          },
          'timeout-callback'() {
            tokenInput.value = '';
            setReady(form, true);
          },
          'error-callback'(code) {
            tokenInput.value = '';
            setReady(form, false);
            const errorCode = String(code || 'unknown');
            form.dataset.turnstileError = errorCode;
            const status = form.querySelector('.form-status');
            if (status) {
              status.textContent = `Security verification connection failed (Cloudflare code ${errorCode}). Please refresh the page. If it continues, try an Incognito window with browser extensions disabled.`;
              status.className = 'form-status show error';
              status.setAttribute('role', 'status');
            }
            console.error('Turnstile widget error.', errorCode);
            return true;
          }
        });

        form.dataset.turnstileWidgetId = String(widgetId);
        form.dataset.turnstileRendered = 'true';
        setReady(form, true);

        form.addEventListener('reset', () => {
          tokenInput.value = '';
          setTimeout(() => {
            try { window.turnstile.reset(widgetId); } catch (_) {}
          }, 0);
        });
      } catch (error) {
        setReady(form, false);
        console.error('Turnstile could not be initialized.', error);
      }
    });

    return true;
  };

  if (renderWidgets()) return;

  const existing = document.querySelector('script[data-nanak-turnstile-api]');
  if (existing) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (renderWidgets() || attempts >= 40) clearInterval(timer);
    }, 250);
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.defer = true;
  script.dataset.nanakTurnstileApi = 'true';

  script.onload = () => {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (renderWidgets() || attempts >= 40) clearInterval(timer);
    }, 100);
  };

  script.onerror = () => {
    protectedForms.forEach(form => setReady(form, false));
    console.error('Turnstile script failed to load.');
  };

  document.head.appendChild(script);
})();
