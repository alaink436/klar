-- Das Referenzvideo haengt am Kanal, nicht an einer Bibliothek.
--
-- 0028 und 0029 haben eine Referenz-Bibliothek gebaut: Eintraege mit Kennung,
-- die man einem Kanal zuweist. Das war an Alains Wunsch vorbei. Er will kein
-- Auswahlfeld, sondern **ein Feld je App, je Plattform und je Kanal, in das er
-- das Video hochlaedt** — und mit dem Hochladen ist die Zuordnung erledigt.
-- Keine Kennung tippen, keine Liste durchsuchen.
--
-- Deshalb `scope`: eine Zeile je Ebene, und die Ebenen erben nach unten.
--
--   'basalt'                        gilt fuer alle Basalt-Kanaele
--   'basalt:tiktok'                 gilt fuer alle Basalt-TikToks
--   'basalt:tiktok:realone9947'     gilt fuer genau diesen Kanal
--
-- Aufgeloest wird von unten nach oben: der spezifischste Treffer gewinnt. Das
-- ist der Normalfall in Alains Bestand — die drei Kelva-Kanaele fahren dasselbe
-- (`content_group` = kelvaapp), die zwei Basalt-Motivationskanaele auch. Ein
-- Video einmal an der App zu hinterlegen statt dreimal am Kanal ist genau die
-- Arbeit, die sonst jedes Mal anfaellt.
--
-- Der `scope` ist ein Praefix des `account_key` aus lib/socialAccounts
-- ("app:plattform:handle"). Damit ist die Aufloesung reines Zeichenketten-
-- Abschneiden und braucht keine zweite Landkarte, die man nachziehen muesste.
--
-- Die Bibliothek aus 0028 (`klar_reference`) bleibt bestehen, aber in ihrer
-- eigentlichen Rolle: sie traegt die Kennung, unter der das AI-Brain die
-- **Vermessung** eines Videos fuehrt (Laenge, Schnitte, Kameraführung). Wer
-- will, haengt eine solche Kennung an eine Scope-Zeile; noetig ist es nicht.
-- Hochladen allein reicht, damit die Zuordnung klar ist.
--
-- Schreibschutz wie in 0028: Agenten lesen, Alain schreibt.

create table if not exists public.klar_channel_reference (
  scope text primary key,
  -- Wie Alain das Video nennt. Leer erlaubt: der Upload ist die Aussage,
  -- ein Pflichtfeld waere nur eine Huerde davor.
  titel text,
  notiz text,
  video_pfad text,
  video_link text,
  -- Optionaler Zeiger auf die Vermessung im AI-Brain (`<projekt>/<id>`).
  kennung text,
  quelle text not null default 'board',
  updated_at timestamptz not null default now(),
  -- app | app:plattform | app:plattform:handle
  constraint klar_channel_reference_scope_form
    check (scope ~ '^[a-zA-Z0-9._-]+(:[a-zA-Z0-9._-]+){0,2}$')
);

comment on table public.klar_channel_reference is
  'Das Referenzvideo je Ebene: App, Plattform oder einzelner Kanal. Der spezifischste Treffer gewinnt. `scope` ist ein Praefix des account_key. Service-role only (RLS no-policy).';
comment on column public.klar_channel_reference.scope is
  'app | app:plattform | app:plattform:handle — Praefix des account_key aus lib/socialAccounts.';
comment on column public.klar_channel_reference.kennung is
  'Optionaler Zeiger auf die Vermessung im AI-Brain-Manifest. Fuer die Zuordnung nicht noetig.';

alter table public.klar_channel_reference enable row level security;
-- keine anon/auth policies -> nur service-role (die Admin-Server-Routen).

drop trigger if exists klar_channel_reference_nur_board on public.klar_channel_reference;
create trigger klar_channel_reference_nur_board
  before insert or update or delete on public.klar_channel_reference
  for each row execute function public.klar_nur_ueber_das_board();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'referenzen',
  'referenzen',
  false,
  209715200,
  array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

-- Der Trigger aus 0028 frischt `updated_at` bisher nur fuer `klar_reference`
-- auf. Die neue Tabelle hat dieselbe Spalte und dieselbe Erwartung daran.
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
      'Diese Tabelle wird ueber das Posting-Board gepflegt, nicht direkt in der Datenbank. Richtung und Referenz setzt Alain auf /admin/todos. Fuer echte Wartung: set local klar.wartung = ''ja'';'
      using errcode = 'insufficient_privilege',
            hint = 'Agenten lesen diese Tabelle, sie schreiben sie nicht.';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new.quelle := case when hat_request then 'board' else 'wartung' end;
    if tg_table_name in ('klar_reference', 'klar_channel_reference') then
      new.updated_at := now();
    end if;
    return new;
  end if;
  return old;
end;
$fn$;
