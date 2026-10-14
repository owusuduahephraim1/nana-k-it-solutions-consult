-- Nana K IT Solutions Consult
-- Neon PostgreSQL schema snapshot
-- Project: nana-k-it-solutions (hidden-water-92411074)
-- Branch: main (br-withered-morning-auwxq7ba)
-- Database: neondb
-- PostgreSQL: 18.x
--
-- This export intentionally excludes connection strings/passwords/secrets.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS text
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN 'NK-' || to_char(now(), 'YYYYMMDD') || '-' ||
         upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
END;
$function$;

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title varchar(220) NOT NULL,
  slug varchar(240) NOT NULL,
  content text NOT NULL,
  excerpt text,
  category varchar(80),
  image_url text,
  published_at timestamptz,
  CONSTRAINT blog_posts_pkey PRIMARY KEY (id),
  CONSTRAINT blog_posts_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  email varchar(180) NOT NULL,
  phone varchar(40),
  subject varchar(180) NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contacts_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email varchar(180) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT newsletter_subscribers_pkey PRIMARY KEY (id),
  CONSTRAINT newsletter_subscribers_email_key UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title varchar(180) NOT NULL,
  slug varchar(200) NOT NULL,
  category varchar(80) NOT NULL,
  description text NOT NULL,
  challenge text NOT NULL,
  solution text NOT NULL,
  technologies text NOT NULL,
  result text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  email varchar(180) NOT NULL,
  phone varchar(40),
  service_type varchar(120) NOT NULL,
  description text NOT NULL,
  preferred_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quotes_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_name varchar(160) NOT NULL,
  company varchar(180),
  quote text NOT NULL,
  rating smallint NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT testimonials_pkey PRIMARY KEY (id),
  CONSTRAINT testimonials_rating_check CHECK (rating >= 1 AND rating <= 5)
);

CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_number varchar(32) NOT NULL DEFAULT generate_ticket_number(),
  name varchar(120) NOT NULL,
  email varchar(180) NOT NULL,
  issue_type varchar(120) NOT NULL,
  description text NOT NULL,
  priority varchar(10) NOT NULL DEFAULT 'medium',
  status varchar(30) NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tickets_pkey PRIMARY KEY (id),
  CONSTRAINT tickets_ticket_number_key UNIQUE (ticket_number),
  CONSTRAINT tickets_priority_check CHECK (priority IN ('low','medium','high')),
  CONSTRAINT tickets_status_check CHECK (status IN ('open','in_progress','waiting_client','resolved','closed'))
);

CREATE INDEX IF NOT EXISTS idx_blog_published_at
  ON public.blog_posts (published_at DESC);

CREATE INDEX IF NOT EXISTS idx_contacts_created_at
  ON public.contacts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_category
  ON public.projects (category);

CREATE INDEX IF NOT EXISTS idx_quotes_created_at
  ON public.quotes (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_status_priority
  ON public.tickets (status, priority, created_at DESC);

CREATE OR REPLACE FUNCTION public.show_db_tree()
RETURNS TABLE(tree_structure text)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT ':file_folder: ' || datname || ' (DATABASE)'
    FROM pg_database
    WHERE datistemplate = false;

    RETURN QUERY
    WITH RECURSIVE
    schemas AS (
        SELECT
            n.nspname AS object_name,
            1 AS level,
            n.nspname AS path,
            'SCHEMA' AS object_type
        FROM pg_namespace n
        WHERE n.nspname NOT LIKE 'pg_%'
        AND n.nspname != 'information_schema'
    ),
    objects AS (
        SELECT
            c.relname AS object_name,
            2 AS level,
            s.path || ' → ' || c.relname AS path,
            CASE c.relkind
                WHEN 'r' THEN 'TABLE'
                WHEN 'v' THEN 'VIEW'
                WHEN 'm' THEN 'MATERIALIZED VIEW'
                WHEN 'i' THEN 'INDEX'
                WHEN 'S' THEN 'SEQUENCE'
                WHEN 'f' THEN 'FOREIGN TABLE'
            END AS object_type
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN schemas s ON n.nspname = s.object_name
        WHERE c.relkind IN ('r','v','m','i','S','f')

        UNION ALL

        SELECT
            p.proname AS object_name,
            2 AS level,
            s.path || ' → ' || p.proname AS path,
            'FUNCTION' AS object_type
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        JOIN schemas s ON n.nspname = s.object_name
    ),
    combined AS (
        SELECT * FROM schemas
        UNION ALL
        SELECT * FROM objects
    )
    SELECT
        REPEAT('    ', level) ||
        CASE
            WHEN level = 1 THEN '└── :open_file_folder: '
            ELSE '    └── ' ||
                CASE object_type
                    WHEN 'TABLE' THEN ':bar_chart: '
                    WHEN 'VIEW' THEN ':eye: '
                    WHEN 'MATERIALIZED VIEW' THEN ':newspaper: '
                    WHEN 'FUNCTION' THEN ':zap: '
                    WHEN 'INDEX' THEN ':mag: '
                    WHEN 'SEQUENCE' THEN ':1234: '
                    WHEN 'FOREIGN TABLE' THEN ':globe_with_meridians: '
                    ELSE ''
                END
        END || object_name || ' (' || object_type || ')'
    FROM combined
    ORDER BY path;
END;
$function$;

COMMIT;
