(() => {
  const cfg = window.NANAK_CONFIG || {};
  const sitekey = String(cfg.turnstileSiteKey || '').trim();
  if (!sitekey) return;

  const protectedForms = [...document.querySelectorAll('form[data-api-path]')];
  if (!protectedForms.length) return;

  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.defer = true;

  script.onload = () => {
    protectedForms.forEach(form => {
      if (form.dataset.turnstileReady === 'true') return;
      form.dataset.turnstileReady = 'true';

      let tokenInput = form.querySelector('input[name="cf-turnstile-response"]');
      if (!tokenInput) {
        tokenInput = document.createElement('input');
        tokenInput.type = 'hidden';
        tokenInput.name = 'cf-turnstile-response';
        form.appendChild(tokenInput);
      }

      const mount = document.createElement('div');
      mount.className = 'turnstile-mount';
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.before(mount); else form.appendChild(mount);

      try {
        const widgetId = window.turnstile.render(mount, {
          sitekey,
          appearance: 'interaction-only',
          theme: 'auto',
          callback(token) { tokenInput.value = token || ''; },
          'expired-callback'() { tokenInput.value = ''; },
          'error-callback'() { tokenInput.value = ''; }
        });
        form.dataset.turnstileWidgetId = String(widgetId);

        form.addEventListener('reset', () => {
          tokenInput.value = '';
          setTimeout(() => {
            try { window.turnstile.reset(widgetId); } catch (_) {}
          }, 0);
        });
      } catch (error) {
        console.error('Turnstile could not be initialized.', error);
      }
    });
  };

  script.onerror = () => console.error('Turnstile script failed to load.');
  document.head.appendChild(script);
})();
