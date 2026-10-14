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


-- Nana K IT Solutions Consult
-- Data snapshot from Neon project hidden-water-92411074 / main / neondb
-- Exported 2026-10-14

BEGIN;

-- blog_posts: 5 rows
INSERT INTO public.blog_posts (id, title, slug, content, excerpt, category, image_url, published_at) VALUES ('137ef01e-05c1-49e9-a5ef-ba514d072c6c', 'Why Every Small Business Needs a Management Information System', 'why-every-small-business-needs-a-management-information-system', '<p>A Management Information System helps an organization capture, organize, process, and report information that managers need for routine decisions.</p><h2>Consistency matters</h2><p>When every department records information differently, reporting becomes slow and unreliable. An MIS encourages common fields, definitions, and procedures.</p><h2>Better visibility</h2><p>Structured reports can help management understand trends in operations, service delivery, inventory, finances, or other business areas.</p><h2>Start with the process</h2><p>Technology should follow a clear understanding of the business workflow. The goal is not to digitize confusion but to support a better process.</p>', 'A well-designed MIS can turn everyday operational data into consistent information for monitoring, reporting, and decision-making.', 'MIS', 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80', '2026-08-26T19:13:10.915Z') ON CONFLICT DO NOTHING;
INSERT INTO public.blog_posts (id, title, slug, content, excerpt, category, image_url, published_at) VALUES ('5d9f6b08-3afb-4e1c-8877-3b4565e30436', 'How to Set Up a Secure Office Network', 'how-to-set-up-a-secure-office-network', '<p>A secure office network is not only about a strong Wi-Fi password. It requires deliberate choices about network equipment, access, updates, and monitoring.</p><h2>Use business-grade network equipment</h2><p>Managed switches, centrally managed access points, and a capable firewall provide better visibility and control than unmanaged consumer equipment.</p><h2>Separate staff and guest traffic</h2><p>Network segmentation reduces unnecessary access between devices and keeps visitor traffic away from internal systems.</p><h2>Protect administrative access</h2><p>Change default credentials, use unique administrator accounts, enable MFA where available, and limit who can modify network settings.</p><h2>Document the environment</h2><p>Maintain an equipment list, addressing plan, backup of configurations, and a clear process for updates.</p>', 'A secure office network starts with sound design, managed equipment, segmentation, strong administration, and documented maintenance.', 'Networking', 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200&q=80', '2026-08-26T19:13:10.705Z') ON CONFLICT DO NOTHING;
INSERT INTO public.blog_posts (id, title, slug, content, excerpt, category, image_url, published_at) VALUES ('7bbefbc0-70db-432c-bb79-ce01743478e4', 'Basic Cybersecurity Tips for Employees', 'basic-cybersecurity-tips-for-employees', '<p>Cybersecurity is a shared responsibility. Employees do not need to be security specialists, but they should understand a few habits that reduce common risks.</p><h2>Use MFA and strong, unique passwords</h2><p>MFA adds another layer of protection when a password is stolen or reused.</p><h2>Check unexpected messages</h2><p>Be cautious with urgent payment requests, login prompts, attachments, and links that arrive unexpectedly.</p><h2>Keep devices updated</h2><p>Security updates address known software weaknesses. Restart devices when updates require it.</p><h2>Report concerns quickly</h2><p>Early reporting can help limit damage when a suspicious message is opened or credentials may have been exposed.</p>', 'Simple employee habits such as MFA, careful link checking, updates, and quick reporting can reduce common cyber risks.', 'Cybersecurity', 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80', '2026-08-26T19:13:11.125Z') ON CONFLICT DO NOTHING;
INSERT INTO public.blog_posts (id, title, slug, content, excerpt, category, image_url, published_at) VALUES ('9f327b33-5e12-40ba-8712-812d84ec8cf7', '5 Signs Your Business Needs Professional IT Support', '5-signs-your-business-needs-professional-it-support', '<p>Small businesses often begin with informal technology support because the environment is manageable at first. As the number of users, devices, cloud services, and business processes grows, the cost of unmanaged IT also grows.</p><h2>1. Recurring technical problems interrupt work</h2><p>If the same connectivity, software, printer, or account issues return every week, the organization may need a structured support process rather than one-off fixes.</p><h2>2. Updates and backups are inconsistent</h2><p>Routine maintenance should be documented and scheduled. Missed updates and unverified backups can create avoidable operational risk.</p><h2>3. Security decisions are being made ad hoc</h2><p>Professional support can help establish practical controls such as MFA, least-privilege access, device updates, and incident reporting.</p><h2>4. New staff onboarding is slow</h2><p>A repeatable onboarding checklist reduces setup time and improves account ownership.</p><h2>5. Technology decisions lack a plan</h2><p>An IT partner can help align technology spending with business priorities, capacity, and risk.</p>', 'Recurring downtime, patching problems, security uncertainty, and unmanaged devices can signal that informal IT support is no longer enough.', 'IT Support', 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80', '2026-08-26T19:13:10.405Z') ON CONFLICT DO NOTHING;
INSERT INTO public.blog_posts (id, title, slug, content, excerpt, category, image_url, published_at) VALUES ('fb37d8fb-e675-48b2-8592-60a76aad1f8d', 'Cloud Storage vs Local Storage: Which Is Right for Your Business?', 'cloud-storage-vs-local-storage-which-is-right-for-your-business', '<p>Cloud storage and local storage solve similar problems in different ways. Many businesses use a combination rather than choosing only one.</p><h2>Cloud storage</h2><p>Cloud services can simplify remote access, collaboration, and off-site resilience. They also introduce recurring costs and dependence on internet connectivity and provider controls.</p><h2>Local storage</h2><p>Local storage provides direct control and can support high-speed access on-site. It requires the business to manage hardware, backups, physical security, and lifecycle replacement.</p><h2>Use a risk-based decision</h2><p>Consider who needs access, how quickly data must be restored, regulatory requirements, available bandwidth, and the cost of downtime.</p>', 'Cloud and local storage each have advantages. The right choice depends on access, resilience, cost, compliance, and connectivity requirements.', 'Cloud', 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200&q=80', '2026-08-26T19:13:11.425Z') ON CONFLICT DO NOTHING;

-- contacts: 0 rows

-- newsletter_subscribers: 0 rows

-- projects: 4 rows
INSERT INTO public.projects (id, title, slug, category, description, challenge, solution, technologies, result, image_url, created_at) VALUES ('20ef75a2-7614-4ec0-921a-fcf4c98bcd49', 'IT Support for a Law Firm', 'it-support-law-firm', 'IT Support', 'A practical support and maintenance framework for office devices, user accounts, updates, and common productivity issues.', 'Frequent workstation issues and inconsistent support processes caused avoidable downtime.', 'Introduced preventative maintenance, support triage, software patching, endpoint checks, account management, and user guidance.', 'Windows, Microsoft 365, endpoint tools, remote support', 'Faster issue resolution and a more predictable day-to-day IT environment.', 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80', '2026-08-27T19:13:08.865Z') ON CONFLICT DO NOTHING;
INSERT INTO public.projects (id, title, slug, category, description, challenge, solution, technologies, result, image_url, created_at) VALUES ('35bf6ea1-634a-4e70-b018-3e008a8154da', 'Office 365 & Email Setup', 'office-365-email-setup', 'IT Support', 'Business email and productivity setup focused on reliable identity, mailbox configuration, and user onboarding.', 'The organization needed a professional email environment and a repeatable way to configure users and devices.', 'Configured tenant settings, mailboxes, basic security controls, device setup, and an onboarding checklist for staff.', 'Microsoft 365, Exchange Online, DNS, MFA', 'A professional email setup with clearer account ownership and stronger sign-in practices.', 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80', '2026-08-27T19:13:09.375Z') ON CONFLICT DO NOTHING;
INSERT INTO public.projects (id, title, slug, category, description, challenge, solution, technologies, result, image_url, created_at) VALUES ('6edfc21c-3caf-423e-b677-898ca5eb6ae6', 'Small Business Network Setup', 'small-business-network-setup', 'Networking', 'A structured wired and wireless office network designed for stable connectivity, secure access, and future growth.', 'The client had inconsistent Wi-Fi coverage, unmanaged cabling, and no separation between staff and guest traffic.', 'Designed a small-business network with managed switching, secure wireless access, guest segmentation, documented addressing, and backup configuration procedures.', 'Managed switch, VLANs, Wi-Fi access points, firewall configuration, CAT6 cabling', 'More reliable connectivity, easier troubleshooting, and a safer guest-access model.', 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80', '2026-08-27T19:13:08.555Z') ON CONFLICT DO NOTHING;
INSERT INTO public.projects (id, title, slug, category, description, challenge, solution, technologies, result, image_url, created_at) VALUES ('a63cd905-552e-439c-99c3-6cefd8c3b33e', 'Management Information System for a Clinic', 'mis-for-clinic', 'MIS', 'A lightweight management information workflow for organizing operational records and improving access to routine reports.', 'Records were fragmented across paper files and spreadsheets, making reporting slow and error-prone.', 'Mapped the clinic workflow, standardized core data fields, and implemented a simple information system with role-based data handling and management reports.', 'PostgreSQL, web forms, reporting dashboard, backup procedures', 'Improved record consistency and quicker access to operational information.', 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80', '2026-08-27T19:13:09.165Z') ON CONFLICT DO NOTHING;

-- quotes: 0 rows

-- testimonials: 3 rows
INSERT INTO public.testimonials (id, client_name, company, quote, rating, created_at) VALUES ('62837a32-8e8e-4c09-89c2-7dd3ed7df929', 'Sample Client C', 'Healthcare Practice', 'The MIS guidance helped us structure our information better and reduced the time spent searching across different records.', 5, '2026-08-27T19:13:10.194Z') ON CONFLICT DO NOTHING;
INSERT INTO public.testimonials (id, client_name, company, quote, rating, created_at) VALUES ('7f099a7b-a30b-448b-bb32-1176d9eb4c03', 'Sample Client B', 'Professional Services Firm', 'The support process was organized, responsive, and practical. We now have clearer procedures for recurring IT issues.', 5, '2026-08-27T19:13:09.985Z') ON CONFLICT DO NOTHING;
INSERT INTO public.testimonials (id, client_name, company, quote, rating, created_at) VALUES ('8fec1920-58c2-457c-b955-2883f93f358e', 'Sample Client A', 'Small Business', 'Nana K IT Solutions Consult explained the options clearly and delivered a network setup that is much easier for our team to use.', 5, '2026-08-27T19:13:09.685Z') ON CONFLICT DO NOTHING;

-- tickets: 0 rows

COMMIT;
