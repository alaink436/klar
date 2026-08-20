-- Eine zweite Adresse, wenn die erste zweimal nicht geantwortet hat.
--
-- Der Fall ist alltäglich: ein Creator wird auf der Adresse aus seiner Bio
-- angeschrieben, dort liest niemand, und die zweite Anfrage verschwindet
-- genauso. Irgendwo steht dann noch eine Management- oder Zweitadresse, und
-- bisher landete die in der freien Notiz — wo sie niemand als Adresse erkennt
-- und niemand nachschlägt.
--
-- WARUM EINE EIGENE TABELLE und nicht eine Spalte an `klar_collab_stages`:
-- dort ist `stage` `not null`. Eine Zeile ohne Stand kann es also nicht geben,
-- und „noch nie hingeschaut" ist in 0026 ausdrücklich eine eigene Aussage, die
-- nicht zu „Kontakt" geschönt werden soll. Eine zweite Adresse zu hinterlegen
-- ist aber kein Stand — wer sie einträgt, hat über den Fortschritt noch nichts
-- gesagt. Beides in eine Zeile zu zwingen hiesse, eine der zwei Aussagen zu
-- erfinden.
--
-- Der Schlüssel ist derselbe wie beim Stand: App plus `contact_key`, also die
-- `contact_email` aus `klar_collab_messages`. Damit hängt die zweite Adresse am
-- Thread und nicht an einer Person, die wir gar nicht führen.
--
-- Die Bedingung „schon zweimal geschrieben" steht bewusst NICHT hier. Sie ist
-- aus den Nachrichten ableitbar (zwei ausgehende, keine eingehende) und wird in
-- der Oberfläche gestellt. Als Spalte wäre sie eine zweite, driftende Fassung
-- derselben Zahl.

create table if not exists public.klar_collab_kontakte (
  app         text not null,
  contact_key text not null,
  -- Die Ausweichadresse. Absichtlich ohne Formatprüfung: hier steht manchmal
  -- auch "über Management, siehe Bio" — eine abgewiesene Eingabe waere
  -- schlechter als eine unsaubere.
  zweite_email text,
  -- Woher sie stammt: Impressum, Linktree, DM. Ohne das steht spaeter eine
  -- Adresse da, der niemand traut.
  quelle      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (app, contact_key)
);

comment on table public.klar_collab_kontakte is
  'Zweite Kontaktadresse je Collab-Thread (/admin/collabs). Getrennt von klar_collab_stages, weil dort stage not null ist und eine Adresse kein Stand ist.';
comment on column public.klar_collab_kontakte.zweite_email is
  'Ausweichadresse, wenn auf der ersten zweimal nichts kam. Ohne Formatpruefung: hier steht manchmal auch ein Weg statt einer Adresse.';
comment on column public.klar_collab_kontakte.quelle is
  'Woher die Adresse stammt (Impressum, Linktree, DM).';

alter table public.klar_collab_kontakte enable row level security;
-- Absichtlich keine Policies => anon/authenticated sehen nichts, service-role
-- umgeht RLS. Gleiche Haltung wie klar_collab_messages und klar_collab_stages.
