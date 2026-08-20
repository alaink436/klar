-- Die Referenz-Bibliothek faellt weg.
--
-- `klar_reference` kam mit 0028: eine Liste von Referenzen mit Kennung, aus der
-- man je Kanal eine auswaehlt. Das war an Alains Wunsch vorbei — er wollte ein
-- Feld dort, wo der Kanal steht, und das Hochladen als Zuordnung. Seit 0030
-- macht `klar_channel_reference` genau das, und seit dem Umbau der Oberflaeche
-- liest die Bibliothek niemand mehr: weder das Board, noch der Generator, der
-- das Briefing im AI-Brain schreibt.
--
-- Vor dem Loeschen nachgesehen, statt es anzunehmen (2026-08-20):
--
--   12 Zeilen, alle ohne Datei und ohne Link — `video_pfad` und `video_link`
--   sind durchgehend null. Der Inhalt war Titel, Herkunft und eine kurze Notiz.
--
--   Alle 12 Kennungen stehen im Vault-Manifest `Projects/00-Referenzen.md`,
--   dort mit der vollen Vermessung: Laenge, Schnitte, Kontaktbogen, Fundort der
--   Datei. Die Bibliothek trug davon nur einen Auszug.
--
--   5 Zeilen in `klar_account_direction.referenz` nennen eine dieser Kennungen.
--   Das ist Text ohne Fremdschluessel, sie ueberleben unveraendert und bleiben
--   im Board sichtbar.
--
-- Es geht also nichts verloren, was es nicht anderswo vollstaendiger gibt.
-- Geloescht wird genau diese eine Tabelle; `klar_channel_reference`,
-- `klar_post_sample` und `klar_account_direction` bleiben unberuehrt.

drop table if exists public.klar_reference;

-- Die Schreibschutz-Funktion nennt die Tabelle nicht mehr. Sie bleibt fuer die
-- drei anderen in Kraft; nur der tote Name faellt aus der Liste.
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
    if tg_table_name in ('klar_channel_reference', 'klar_post_sample') then
      new.updated_at := now();
    end if;
    return new;
  end if;
  return old;
end;
$fn$;
