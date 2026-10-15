# Production Workspace

## Admin Workspace
`/admin.html` uses Neon Auth and a short-lived JWT. The Cloudflare Worker verifies that JWT against the production Neon Auth JWKS and then enforces the `ADMIN_EMAILS` allowlist.

The current administrator allowlist is configured in `worker/wrangler.toml`. Administrative APIs never trust browser-supplied user IDs or email addresses.

The workspace manages:
- Contact messages
- Consultation requests
- Support tickets and client-visible ticket updates
- Newsletter subscribers
- Portfolio projects
- Client-approved testimonials
- Blog posts
- Cloudflare R2 managed files
- Remote-support installer publishing
- Notifications
- Audit history

## Client Portal
`/client-portal.html` also uses Neon Auth. Client records are scoped server-side to the verified authenticated email address. A client cannot choose another email address in the API request.

## R2
Admin uploads are authenticated with the Neon Auth JWT. The legacy protected upload route remains available with `R2_UPLOAD_SECRET`. Managed file deletions remove the R2 object and are served with no-store caching so deleted files become inaccessible immediately.

## Public content rules
Public project/blog/testimonial endpoints return only published records. Seed/sample testimonials remain unpublished unless explicitly approved and published through the Admin Workspace.

## External email delivery
The production system records operational alerts in `admin_notifications` and shows them in the Admin Workspace. A third-party transactional email provider can be attached later if outbound email alerts are required.
