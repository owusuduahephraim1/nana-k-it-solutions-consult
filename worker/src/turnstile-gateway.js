import api from './index.js';

const PROTECTED_FORM_PATHS = new Set([
  '/api/contact',
  '/api/quote',
  '/api/ticket',
  '/api/newsletter'
]);

function getAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || 'https://owusuduahephraim1.github.io,https://nanakitsolutions.com,https://www.nanakitsolutions.com')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
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

function json(data, status, request, env, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(request, env),
      ...extraHeaders
    }
  });
}

async function readProtectedBody(request) {
  try {
    return await request.clone().json();
  } catch (_) {
    return null;
  }
}

async function verifyTurnstile(request, env, body) {
  if (!env.TURNSTILE_SECRET_KEY) {
    return { ok: false, status: 503, error: 'Security verification is temporarily unavailable.' };
  }

  if (!body) {
    return { ok: false, status: 400, error: 'Invalid form submission.' };
  }

  const token = String(body?.['cf-turnstile-response'] || '').trim();
  if (!token) {
    return { ok: false, status: 400, error: 'Please complete the security verification.' };
  }

  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET_KEY);
  form.append('response', token);

  const remoteIp = request.headers.get('CF-Connecting-IP');
  if (remoteIp) form.append('remoteip', remoteIp);

  let verification;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form
    });
    if (!response.ok) {
      return { ok: false, status: 502, error: 'Security verification could not be completed.' };
    }
    verification = await response.json();
  } catch (error) {
    console.error('Turnstile verification request failed', error);
    return { ok: false, status: 502, error: 'Security verification could not be completed.' };
  }

  if (!verification?.success) {
    console.warn('Turnstile rejected form submission', verification?.['error-codes'] || []);
    return { ok: false, status: 400, error: 'Security verification failed. Please refresh the page and try again.' };
  }

  const origin = request.headers.get('Origin');
  if (origin && verification.hostname) {
    try {
      const originHostname = new URL(origin).hostname;
      if (originHostname !== verification.hostname) {
        console.warn('Turnstile hostname mismatch', { originHostname, verifiedHostname: verification.hostname });
        return { ok: false, status: 400, error: 'Security verification failed. Please refresh the page and try again.' };
      }
    } catch (_) {
      return { ok: false, status: 400, error: 'Invalid request origin.' };
    }
  }

  return { ok: true };
}

async function applyFormRateLimits(pathname, body, env) {
  const email = String(body?.email || '').trim().toLowerCase();
  const actorKey = `${pathname}:${email || 'anonymous'}`;

  if (env.FORM_RATE_LIMITER) {
    const actorResult = await env.FORM_RATE_LIMITER.limit({ key: actorKey });
    if (!actorResult.success) return false;
  }

  if (env.FORM_GLOBAL_RATE_LIMITER) {
    const globalResult = await env.FORM_GLOBAL_RATE_LIMITER.limit({ key: pathname });
    if (!globalResult.success) return false;
  }

  return true;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'POST' && PROTECTED_FORM_PATHS.has(url.pathname)) {
      const body = await readProtectedBody(request);
      const turnstileResult = await verifyTurnstile(request, env, body);
      if (!turnstileResult.ok) {
        return json({ error: turnstileResult.error }, turnstileResult.status, request, env);
      }

      try {
        const allowed = await applyFormRateLimits(url.pathname, body, env);
        if (!allowed) {
          return json(
            { error: 'Too many submissions. Please wait a minute and try again.' },
            429,
            request,
            env,
            { 'Retry-After': '60' }
          );
        }
      } catch (error) {
        console.error('Rate limiter failed', error);
        return json({ error: 'Request protection is temporarily unavailable.' }, 503, request, env);
      }
    }

    return api.fetch(request, env, ctx);
  }
};
