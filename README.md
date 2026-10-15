# Nana K IT Solutions Consult — Neon Version

This repository is the **Neon version** of Nana K IT Solutions Consult, rebuilt from the supplied GitHub main-branch package and the supplied Neon backend/database snapshot.

## Production architecture

- **Frontend:** GitHub Pages — `https://owusuduahephraim1.github.io/nana-k-it-solutions-consult/`
- **API:** Cloudflare Worker — `https://nanak-it-solutions-api.nana-k-it-solutions-consult.workers.dev`
- **Database:** Neon PostgreSQL project `nana-k-it-solutions-consult`
- **Storage:** Cloudflare R2 through Worker binding `STORAGE`
- **Bot protection:** Cloudflare Turnstile
- **Abuse protection:** Cloudflare Worker Rate Limiting API

## Neon project

- Project name: `nana-k-it-solutions-consult`
- Project ID: `bitter-glade-60284002`
- Main branch ID: `br-bitter-mud-b7qryafs`
- Database: `neondb`
- PostgreSQL: 18

The database was restored from the provided backend package with the original operational tables, indexes, constraints, functions and current data snapshot.

### Restored data

- `blog_posts`: 5 rows
- `projects`: 4 rows
- `testimonials`: 3 rows
- `contacts`: 0 rows
- `quotes`: 0 rows
- `tickets`: 0 rows
- `newsletter_subscribers`: 0 rows

## Repository layout

```text
site/        Static GitHub Pages frontend
worker/      Cloudflare Worker API, Turnstile, rate limiting and R2 access
database/    Reconstructable Neon schema and data snapshot
.github/     GitHub Pages and manual Worker deployment workflows
```

## GitHub Pages

The workflow `.github/workflows/deploy-pages.yml` publishes the `site/` directory.
GitHub Pages must be configured to use **GitHub Actions** as the publishing source.

## Cloudflare Worker secrets

The following values must be stored as Worker secrets and must never be committed:

- `DATABASE_URL` — connection string for the new Neon project
- `TURNSTILE_SECRET_KEY`
- `R2_UPLOAD_SECRET`

The Worker must also allow the GitHub Pages browser origin:

```text
https://owusuduahephraim1.github.io
```

## Cloudflare Turnstile

The existing public site key is configured in `site/assets/js/config.js`. The Turnstile widget must allow the hostname:

```text
owusuduahephraim1.github.io
```

## R2

The blueprint uses the existing R2 binding:

- Production bucket: `nanak-it-assets`
- Preview bucket: `nanak-it-assets-dev`
- Worker binding: `STORAGE`

The bucket itself remains private; files are delivered through the Worker `/files/...` route.

## Database restore

For a fresh Neon database:

```bash
psql "$DATABASE_URL" -f database/full_backup.sql
```

No live credentials or Cloudflare secrets are committed to this repository.

