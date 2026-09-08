-- Podify darf Install- und Open-Ereignisse melden.
--
-- Die Insert-Regel auf klar_app_events traegt eine Allowlist der Apps. Podify
-- (2026-09-08, com.podifyapp.app) fehlte, und eine App, die dort fehlt, meldet
-- sich mit reportInstall() bei jedem Start und landet nie in der Tabelle, ohne
-- Fehler (Learning 2026-08-24, Fire-and-forget-Attribution schweigt doppelt).
-- Der Rest der Regel bleibt Zeichen fuer Zeichen wie gemessen am 2026-09-08.

alter policy "anon insert klar_app_events" on public.klar_app_events
  with check (
    (app = any (array['promillo'::text, 'promillio'::text, 'basalt'::text, 'podify'::text]))
    and (event = any (array['install'::text, 'open'::text]))
    and ((platform is null) or (platform = any (array['ios'::text, 'android'::text, 'web'::text])))
    and (char_length(app) <= 40)
    and (char_length(event) <= 40)
    and (char_length(coalesce(app_version, ''::text)) <= 40)
    and (char_length(coalesce(build, ''::text)) <= 40)
    and (char_length(coalesce(locale, ''::text)) <= 20)
    and (char_length(coalesce(source, ''::text)) <= 200)
    and (char_length(coalesce(device_id, ''::text)) <= 64)
  );
