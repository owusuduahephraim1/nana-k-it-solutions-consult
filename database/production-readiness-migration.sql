-- Nana K IT Solutions Consult - production readiness migration
-- Applied to project little-grass-29247873 / branch br-dark-sky-b559r0ah on 2026-10-14.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.testimonials
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.site_settings (
  key varchar(120) PRIMARY KEY,
  value text,
  is_public boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.managed_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key text NOT NULL UNIQUE,
  original_name text NOT NULL,
  content_type varchar(180),
  size_bytes bigint NOT NULL DEFAULT 0,
  purpose varchar(80) NOT NULL DEFAULT 'general',
  public_url text,
  is_public boolean NOT NULL DEFAULT true,
  uploaded_by varchar(256),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type varchar(80) NOT NULL,
  title varchar(220) NOT NULL,
  body text NOT NULL,
  entity_type varchar(80),
  entity_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id text,
  actor_email varchar(256),
  action varchar(120) NOT NULL,
  entity_type varchar(80),
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ticket_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  body text NOT NULL,
  visible_to_client boolean NOT NULL DEFAULT true,
  created_by_email varchar(256),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.site_settings(key,value,is_public)
VALUES
 ('remote_support_file_url','',true),
 ('remote_support_file_name','',true),
 ('analytics_id','',true)
ON CONFLICT(key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_contacts_status_created ON public.contacts(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_status_created ON public.quotes(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.admin_notifications(is_read,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_managed_files_purpose ON public.managed_files(purpose,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_updates_ticket ON public.ticket_updates(ticket_id,created_at ASC);
