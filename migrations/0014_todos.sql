-- Freie To-do-Liste für /admin/todos. Bewusst simpel: ein Titel, ein Haken,
-- eine Sortierung. Keine Fälligkeiten, keine Zuweisungen, keine Projekte —
-- die Projektlage kommt aus AI-Brain/STATUS.md, und alles, was aus echten
-- Daten ableitbar ist (offene Collabs, fällige Auszahlungen), steht schon in
-- der Arbeitsliste auf /admin/overview. Hier landet nur, was NUR im Kopf ist.
--
-- `position` ist ein Float, damit Umsortieren zwischen zwei Nachbarn immer
-- ohne Neuschreiben der ganzen Liste geht (Mittelwert der Nachbarn).
-- service-role only (keine Policies), gleiches RLS-Muster wie
-- klar_inbox_stars und klar_scrape_settings.
create table if not exists public.klar_todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  done boolean not null default false,
  done_at timestamptz,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

-- Offene zuerst, in Sortierreihenfolge — der einzige Zugriffspfad der Liste.
create index if not exists klar_todos_open_idx
  on public.klar_todos (done, position, created_at desc);

alter table public.klar_todos enable row level security;
-- keine anon/auth policies -> nur service-role (die Admin-Server-Routen).
