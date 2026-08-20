-- Auch die Referenz bekommt einen Verlauf.
--
-- 0030 hielt eine Zeile je Ebene, und ein neues Video hat das alte ueberschrieben.
-- Das ist derselbe Fehler, den 0027 fuer die Richtung schon behoben hat: wer
-- umorientiert, loescht sonst die Spur dessen, was vorher lief. Und genau die
-- Frage stellt sich spaeter — „mit welchem Video hatten wir es im August
-- versucht, und warum sind wir weg davon".
--
-- Also dieselbe Form wie `klar_account_direction`: eine Zeile je Ebene UND
-- Wechsel, die laufende ist die mit `bis is null`, ein Wechsel schliesst die
-- alte mit Datum und Grund. Damit lassen sich Richtungswechsel und
-- Referenzwechsel in einer gemeinsamen Zeitleiste zeigen, und das ist die,
-- die Alain sehen will.
--
-- KEIN `drop table`: die Tabelle ist zwar leer (0 Zeilen, heute angelegt), aber
-- ein Neuanlegen waere ein zerstoerender Schritt fuer einen Umbau, der auch
-- additiv geht. Der Primaerschluessel wandert von `scope` auf eine eigene id,
-- und die Eindeutigkeit von `scope` gilt nur noch fuer die laufende Zeile.

alter table public.klar_channel_reference
  drop constraint if exists klar_channel_reference_pkey;

alter table public.klar_channel_reference
  add column if not exists id bigint generated always as identity primary key,
  add column if not exists ab date not null default current_date,
  add column if not exists bis date,
  add column if not exists grund text;

alter table public.klar_channel_reference
  drop constraint if exists klar_channel_reference_zeitraum;
alter table public.klar_channel_reference
  add constraint klar_channel_reference_zeitraum check (bis is null or bis >= ab);

-- Je Ebene hoechstens EIN laufendes Video. Das ist die Regel, an der die
-- Aufloesung haengt: sie nimmt den spezifischsten Scope mit `bis is null`.
create unique index if not exists klar_channel_reference_laufend
  on public.klar_channel_reference (scope)
  where bis is null;

-- Der Verlauf je Ebene, neueste zuerst.
create index if not exists klar_channel_reference_verlauf
  on public.klar_channel_reference (scope, ab desc);

comment on column public.klar_channel_reference.bis is
  'NULL = laeuft. Ein neues Video schliesst die alte Zeile mit dem Datum des Wechsels.';
comment on column public.klar_channel_reference.grund is
  'Warum vom alten Video weg. Steht an der Zeile, die ENDET — das ist die Frage, die man spaeter stellt.';
