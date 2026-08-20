-- Posts, die gelaufen sind — und die Anweisung, sich daran zu halten.
--
-- Die Referenz (0030/0031) ist ein FREMDES Video, dessen Machart wir uebernehmen.
-- Das hier ist das Gegenstueck: ein EIGENER Post, der konvertiert hat. Alain
-- laedt ihn hoch und schreibt dazu, was daran kuenftig wiederholt werden soll.
--
-- Warum das nicht in dieselbe Tabelle gehoert:
--
--   Referenz   genau eine je Ebene, mit Verlauf. Die Frage ist „wonach bauen wir".
--   Post       beliebig viele je Kanal, nebeneinander. Die Frage ist „was hat
--              hier schon funktioniert".
--
-- Zusammengelegt muesste eine der beiden Fragen falsch beantwortet werden: ein
-- Verlauf mit einer laufenden Zeile kann keine Sammlung sein, und eine Sammlung
-- ohne `bis` kann nicht sagen, was gerade gilt.
--
-- `scope` ist dieselbe Form wie bei der Referenz (Praefix des account_key), damit
-- ein Post auch an einer App haengen kann — was auf einem Kelva-Kanal lief, ist
-- meist auch fuer die anderen beiden das Vorbild. Aufgeloest wird hier aber
-- NICHT nach dem spezifischsten Treffer, sondern gesammelt: ein Kanal zeigt
-- seine eigenen Posts UND die seiner App. Bei einer Sammlung ist mehr richtig,
-- bei einer Referenz waere es mehrdeutig.
--
-- `aktiv` statt loeschen: ein Post, der einmal lief, bleibt ein Beleg, auch wenn
-- er nicht mehr das Vorbild sein soll.
--
-- Schreibschutz wie ueberall hier: Agenten lesen, Alain schreibt.

create table if not exists public.klar_post_sample (
  id bigint generated always as identity primary key,
  scope text not null,
  titel text,
  -- Alains Anweisung. Das ist das eigentliche Feld: „so aufbauen wie hier",
  -- „gleicher Hook, andere App". Ohne sie waere der Post nur ein Video.
  notiz text,
  video_pfad text,
  video_link text,
  gepostet_am date,
  -- Was er gebracht hat. Freitext, weil die Zahl von der Plattform abhaengt
  -- und eine erzwungene Spalte nur zu Nullen fuehrt.
  ergebnis text,
  aktiv boolean not null default true,
  quelle text not null default 'board',
  angelegt_am timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klar_post_sample_scope_form
    check (scope ~ '^[a-zA-Z0-9._-]+(:[a-zA-Z0-9._-]+){0,2}$')
);

comment on table public.klar_post_sample is
  'Eigene Posts, die konvertiert haben, je Kanal oder App. Gesammelt, nicht mit Verlauf: die Frage ist „was hat hier funktioniert". Das Gegenstueck ist klar_channel_reference, das fremde Vorbild. Service-role only (RLS no-policy).';
comment on column public.klar_post_sample.notiz is
  'Alains Anweisung, worauf sich kuenftige Posts beziehen sollen. Das wichtigste Feld der Zeile.';
comment on column public.klar_post_sample.scope is
  'app | app:plattform | app:plattform:handle. Ein Kanal zeigt seine eigenen Posts UND die seiner App.';

create index if not exists klar_post_sample_scope
  on public.klar_post_sample (scope, aktiv, angelegt_am desc);

alter table public.klar_post_sample enable row level security;
-- keine anon/auth policies -> nur service-role (die Admin-Server-Routen).

drop trigger if exists klar_post_sample_nur_board on public.klar_post_sample;
create trigger klar_post_sample_nur_board
  before insert or update or delete on public.klar_post_sample
  for each row execute function public.klar_nur_ueber_das_board();

-- Der Trigger frischt `updated_at` bisher nur fuer zwei Tabellen auf.
create or replace function public.klar_nur_ueber_das_board()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  hat_request boolean;
  wartung text;
begin
  hat_request := coalesce(current_setting('request.jwt.claims', true), '') <> ''
              or coalesce(current_setting('request.method', true), '') <> '';
  wartung := coalesce(current_setting('klar.wartung', true), '');

  if not hat_request and wartung <> 'ja' then
    raise exception
      'Diese Tabelle wird ueber das Posting-Board gepflegt, nicht direkt in der Datenbank. Richtung, Referenz und Posts setzt Alain auf /admin/todos. Fuer echte Wartung: set local klar.wartung = ''ja'';'
      using errcode = 'insufficient_privilege',
            hint = 'Agenten lesen diese Tabellen, sie schreiben sie nicht.';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new.quelle := case when hat_request then 'board' else 'wartung' end;
    if tg_table_name in ('klar_reference', 'klar_channel_reference', 'klar_post_sample') then
      new.updated_at := now();
    end if;
    return new;
  end if;
  return old;
end;
$fn$;
