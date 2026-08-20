-- Referenzvideos gehören Alain, nicht den Agenten.
--
-- Zwei Dinge auf einmal, weil sie dieselbe Regel sind:
--
--   1. `klar_reference` — die Referenzvideos werden im Board eingetragen, nicht
--      mehr aus dem Vault erzeugt. Bis 0027 kam die Auswahlliste aus
--      `lib/referenceIds.ts`, erzeugt aus dem AI-Brain; Alain konnte nur
--      auswählen, nichts anlegen. Jetzt ist das Board die Quelle dafür, WELCHE
--      Referenzen es gibt und welcher Kanal welche fährt.
--
--   2. Ein Schreibschutz gegen Agenten auf beiden Tabellen. Alain setzt die
--      Richtung, die Agenten lesen sie. Bisher war das nur eine Absprache: ein
--      Agent mit Supabase-Zugang konnte die Richtung eines Kanals genauso gut
--      umschreiben wie Alain, und niemand hätte es gesehen.
--
-- WIE DER SCHREIBSCHUTZ TRÄGT (gemessen am 2026-08-20, nicht vermutet):
--
--   | | Agent über den Supabase-MCP | Board über PostgREST |
--   |---|---|---|
--   | Rolle                   | postgres | service_role |
--   | request.jwt.claims      | **leer** | gesetzt      |
--   | request.method          | **leer** | gesetzt      |
--
-- Ein Agent haengt direkt an der Datenbank, das Board spricht HTTP. Der Trigger
-- weist deshalb genau den Fall ab, in dem GAR KEIN Request-Kontext da ist. Er
-- prüft nicht auf die Rolle: `postgres` ist der Eigentümer der Tabelle und
-- könnte sich jedes entzogene Recht selbst zurückgeben, ein Grant waere also
-- keine Schranke.
--
-- Bewusst so herum formuliert (blockieren nur wenn BEIDES leer ist) und nicht
-- „erlauben nur wenn service_role": faellt am Board mal ein GUC weg, schreibt es
-- trotzdem weiter. Ein Schutz, der das Board lahmlegt, waere schlimmer als das
-- Problem.
--
-- EHRLICH ZUR GRENZE: das ist keine Mauer gegen einen Agenten, der es darauf
-- anlegt. Wer die Datenbank besitzt, kann den Trigger abschalten. Es ist eine
-- Schranke gegen den Fall, der wirklich passiert — ein Agent, der hilfsbereit
-- „aufraeumt" und dabei eine Richtung ueberschreibt. Aus einem Versehen wird
-- damit ein sichtbarer, absichtlicher Schritt. Fuer echte Wartung gibt es einen
-- benannten Weg (`klar.wartung`), und die Spalte `quelle` schreibt mit, welcher
-- Weg es war.

-- ---------------------------------------------------------------------------
-- 1. Die Referenzen selbst.
--
-- `kennung` ist der Schluessel, den die Richtung nennt, Form `<projekt>/<id>`
-- (etwa `basalt/avow-gym-fyp`). Derselbe String steht im Vault-Manifest
-- `Projects/<Projekt>/Content/REFERENZEN.md`. Absichtlich dieselbe Kennung und
-- kein Fremdschluessel: die Videodateien und ihre Vermessung liegen im AI-Brain
-- und auf Drive, nicht hier.
--
-- Arbeitsteilung, damit nichts doppelt gepflegt wird:
--   Board (hier)  WELCHE Referenzen es gibt, wie sie heissen, wo sie herkommen,
--                 und welcher Kanal welche fährt. Das traegt Alain ein.
--   Vault         WIE das Video aufgebaut ist — Laenge, Schnitte, Kameraführung,
--                 Kontaktbogen. Das misst ein Agent und schreibt es ins Manifest.
-- `KANAELE.md` fuegt beides zusammen.
create table if not exists public.klar_reference (
  kennung text primary key,
  titel text not null,
  -- Woher das Video stammt: TikTok-Link, X-Post, "eigene Aufnahme".
  herkunft text,
  -- Alains eigener Satz dazu. Die vermessene Machart kommt aus dem Vault und
  -- wird hier NICHT gepflegt, sonst stuenden zwei Fassungen davon herum.
  notiz text,
  -- Wo die Datei liegt, falls schon bekannt. Rein informativ.
  ablage text,
  aktiv boolean not null default true,
  quelle text not null default 'board',
  angelegt_am timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klar_reference_kennung_form check (kennung ~ '^[a-z0-9._-]+/[a-zA-Z0-9._-]+$')
);

comment on table public.klar_reference is
  'Die Referenzvideos, eingetragen von Alain im Posting-Board. Quelle fuer die Auswahlliste bei der Richtung. Die Vermessung des Videos steht im AI-Brain-Manifest, nicht hier. Service-role only (RLS no-policy).';
comment on column public.klar_reference.kennung is
  'Stabile Kennung <projekt>/<id>, identisch mit der im Vault-Manifest. Kein Fremdschluessel: die Dateien liegen nicht in dieser Datenbank.';
comment on column public.klar_reference.notiz is
  'Alains Satz zur Referenz. Die gemessene Machart kommt aus dem Vault.';

alter table public.klar_reference enable row level security;
-- keine anon/auth policies -> nur service-role (die Admin-Server-Routen).

create index if not exists klar_reference_aktiv on public.klar_reference (aktiv, kennung);

-- Woher eine Richtungszeile kam. Wird vom Trigger gesetzt, nicht vom Aufrufer.
alter table public.klar_account_direction
  add column if not exists quelle text not null default 'board';
comment on column public.klar_account_direction.quelle is
  'Wer geschrieben hat: board (ueber die Oberflaeche) oder wartung (bewusst gesetzter Ausnahmeweg). Vom Trigger gestempelt.';

-- ---------------------------------------------------------------------------
-- 2. Bestand uebernehmen, BEVOR der Schreibschutz steht.
--
-- Die zwoelf Kennungen aus dem Vault-Manifest, Stand 2026-08-20. Sie waren
-- bisher die erzeugte Liste in lib/referenceIds.ts; ab jetzt stehen sie hier
-- und Alain kann sie aendern und ergaenzen. Die Notizen sind bewusst knapp:
-- die volle Vermessung bleibt im Vault.
insert into public.klar_reference (kennung, titel, herkunft, notiz, quelle) values
  ('basalt/avow-gym-fyp', 'Avow Gym-FYP', 'TikTok, fremd',
   'Vorlage der ganzen Gym-Serie. 720x1280, 10,17 s, EIN Schnitt bei 4,83 s.', 'vault'),
  ('basalt/glowup-hiver', 'Glow-up "cet hiver"', 'TikTok, fremd',
   'Sprechkopf plus Glow-up-Montage, neun Schnitte. Das Vorher steckt im Gesicht.', 'vault'),
  ('basalt/pollinkerzz-carousel', 'pollinkerzz Foto-Carousel', 'TikTok @pollinkerzz',
   'Kein Video, Foto-Carousel. Muster fuer die Slideshow-Posts, 60,4K Likes.', 'vault'),
  ('klar-content-pipeline/01-laugh-manhwa-translator', 'Reaction-Hook: Lachen', 'TikTok, fremd',
   'Format A. Webtoon-Uebersetzer. Gesicht-Beat 0,0-2,2 s.', 'vault'),
  ('klar-content-pipeline/02-shock-travel-app', 'Reaction-Hook: Schock', 'TikTok, fremd',
   'Format A. Pose wird 2,5 s gehalten, es bewegt sich die Kamera.', 'vault'),
  ('klar-content-pipeline/03-cry-mise-mealplanner', 'Reaction-Hook: Heulen', 'TikTok, bezahlte AD',
   'Format A. 720x1280 und trotzdem der staerkste der drei.', 'vault'),
  ('klar-content-pipeline/04-pov-lockedin-lovora', 'POV: Schreibtisch (Lovora)', 'TikTok, fremd',
   'Format B, POV am Schreibtisch. Paar-Widget.', 'vault'),
  ('klar-content-pipeline/05-pov-fakeargument-lovora', 'POV: Bett (Lovora)', 'TikTok, fremd',
   'Format B, POV im Bett.', 'vault'),
  ('klar-content-pipeline/06-pov-gaming-lovora', 'POV: Gaming (Lovora)', 'TikTok, fremd',
   'Format B, POV beim Gaming.', 'vault'),
  ('klar-content-pipeline/07-pov-lockedin-lovora-2', 'POV: Schreibtisch, zweite Fassung', 'TikTok, fremd',
   'Zweite Fassung von 04, vollstaendig abgemessen. Datei liegt nicht im Vault.', 'vault'),
  ('trubel/drunktok-heavy-drinkers', 'drunktok "heavy drinkers"', 'TikTok, fremd',
   'Vorlage der Scene-Pack-Schnitte. 1080x1920, 17,2 s, 15 harte Schnitte.', 'vault'),
  ('trubel/stacked-hooks-adriamatz', 'Stacked Hooks (Adria Martinez)', 'X-Post',
   'Hook vorne, Demo hinten. Der Hook hat nichts mit der App zu tun.', 'vault')
on conflict (kennung) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Der Schreibschutz.
create or replace function public.klar_nur_ueber_das_board()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  hat_request boolean;
  wartung text;
begin
  -- PostgREST setzt beides bei jedem Request. Eine direkte Datenbankverbindung
  -- (psql, Supabase-MCP, ein Skript mit Connection-String) setzt keines davon.
  hat_request := coalesce(current_setting('request.jwt.claims', true), '') <> ''
              or coalesce(current_setting('request.method', true), '') <> '';

  -- Der benannte Ausnahmeweg fuer echte Wartung, etwa eine Migration:
  --   set local klar.wartung = 'ja';
  -- Das ist ein bewusster Schritt, und die Zeile traegt danach quelle='wartung'.
  wartung := coalesce(current_setting('klar.wartung', true), '');

  if not hat_request and wartung <> 'ja' then
    raise exception
      'Diese Tabelle wird ueber das Posting-Board gepflegt, nicht direkt in der Datenbank. Richtung und Referenz setzt Alain auf /admin/todos. Fuer echte Wartung: set local klar.wartung = ''ja'';'
      using errcode = 'insufficient_privilege',
            hint = 'Agenten lesen diese Tabelle, sie schreiben sie nicht.';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new.quelle := case when hat_request then 'board' else 'wartung' end;
    if tg_table_name = 'klar_reference' then
      new.updated_at := now();
    end if;
    return new;
  end if;
  return old;
end;
$$;

comment on function public.klar_nur_ueber_das_board() is
  'Weist Schreibzugriffe ab, die von einer direkten Datenbankverbindung kommen (kein PostgREST-Request-Kontext). Ausnahmeweg: set local klar.wartung = ''ja''. Stempelt klar_account_direction.quelle bzw. klar_reference.quelle.';

drop trigger if exists klar_account_direction_nur_board on public.klar_account_direction;
create trigger klar_account_direction_nur_board
  before insert or update or delete on public.klar_account_direction
  for each row execute function public.klar_nur_ueber_das_board();

drop trigger if exists klar_reference_nur_board on public.klar_reference;
create trigger klar_reference_nur_board
  before insert or update or delete on public.klar_reference
  for each row execute function public.klar_nur_ueber_das_board();
