-- Der Stand eines Collab-Gesprächs: wie weit ist die Sache gediehen?
--
-- `klar_collab_messages` sagt, WER zuletzt geschrieben hat — daraus leitet das
-- Board seit 0025 offen/angeschrieben/beantwortet ab. Das ist der Ton der
-- Konversation, nicht ihr Fortschritt: ein "beantwortet" kann heissen, dass
-- der Deal steht, oder dass man einmal höflich abgesagt hat. Alain verliert
-- damit den Überblick, sobald mehr als eine Handvoll Gespräche laufen.
--
-- Also eine zweite, VON HAND gepflegte Achse: eine Zeile pro Thread mit einer
-- Stufe und einer freien Notiz. Bewusst getrennt von den Nachrichten, weil
-- klar_collab_messages append-only ist (Webhook + Reply-Route schreiben da
-- hinein) und ein Zustand nichts ist, was man anhängt.
--
-- Schlüssel = derselbe Thread-Key wie dort: (app, contact_email). Bei DMs ist
-- das der synthetische '<channel>:<handle>' aus collabContactKey().
--
-- Kein Eintrag = "noch kein Stand gesetzt". Das ist ein eigener, sichtbarer
-- Zustand im Board und absichtlich nicht 'kontakt' per Default: sonst sähen
-- alle Altzeilen nach gepflegter Dokumentation aus, ohne dass je jemand
-- hingeschaut hätte.

create table if not exists public.klar_collab_stages (
  app         text not null,           -- App-Slug, wie in klar_collab_messages.app
  contact_key text not null,           -- = klar_collab_messages.contact_email
  stage       text not null,
  note        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (app, contact_key)
);

-- Die Leiter, geschlossen gehalten. 'abgesagt' ist der einzige Ausgang;
-- alles andere läuft von oben nach unten durch.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'klar_collab_stages_stage_chk'
  ) then
    alter table public.klar_collab_stages
      add constraint klar_collab_stages_stage_chk
      check (stage in ('kontakt', 'gespraech', 'zugesagt', 'material', 'live', 'abgesagt'));
  end if;
end $$;

comment on table public.klar_collab_stages is
  'Von Hand gepflegter Stand je Collab-Thread (/admin/collabs). Ergänzt die aus den Nachrichten abgeleitete Antwort-Lage um den Fortschritt der Zusammenarbeit.';
comment on column public.klar_collab_stages.stage is
  'kontakt | gespraech | zugesagt | material | live | abgesagt';
comment on column public.klar_collab_stages.note is
  'Freie Notiz: was wurde abgemacht, worauf wartet man. Reine Dokumentation, nichts leitet sich daraus ab.';

alter table public.klar_collab_stages enable row level security;
-- Absichtlich keine Policies => anon/authenticated sehen nichts, service-role
-- umgeht RLS. Gleiche Haltung wie klar_collab_messages und klar_todos.
