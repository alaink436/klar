-- Manuelle Collab-Einträge: Gespräche, die NICHT über eine Bio-Adresse
-- reinkamen. Alain schreibt Influencer selbst an (Instagram-DM, TikTok-DM,
-- Mail von Hand) und will diese Konversationen im selben Board sehen wie die
-- eingehenden Anfragen — sonst existiert der halbe Kanal nur in seinem Kopf.
--
-- Drei additive Spalten, alle mit Default. Bestandszeilen (Brevo-Inbound und
-- die Antworten aus /admin/collab/reply) bleiben unverändert gültig:
--   channel        = 'email' für alles Bisherige
--   contact_handle = null    (bei Mail ist contact_email die Identität)
--   manual         = false   (kam über den Webhook / die Reply-Route)
--
-- Thread-Key bleibt (app, contact_email). Für Nicht-Mail-Kanäle trägt
-- contact_email einen synthetischen, stabilen Schlüssel '<channel>:<handle>'
-- (z.B. 'instagram:marie_knits'). Der ist absichtlich KEINE gültige Mail:
-- /admin/collab/reply prüft gegen EMAIL_RE und lehnt so einen Thread ab,
-- statt eine Antwort ins Leere zu schicken.

alter table public.klar_collab_messages
  add column if not exists channel text not null default 'email',
  add column if not exists contact_handle text,
  add column if not exists manual boolean not null default false;

-- Kanalwerte klein und geschlossen halten; 'other' fängt den Rest.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'klar_collab_messages_channel_chk'
  ) then
    alter table public.klar_collab_messages
      add constraint klar_collab_messages_channel_chk
      check (channel in ('email', 'instagram', 'tiktok', 'youtube', 'x', 'other'));
  end if;
end $$;

comment on column public.klar_collab_messages.channel is
  'Kanal der Nachricht: email (Bio-Adresse/Brevo) oder DM-Plattform bei manuellen Einträgen.';
comment on column public.klar_collab_messages.contact_handle is
  'Handle des Gegenübers bei Nicht-Mail-Kanälen, ohne @ (z.B. marie_knits).';
comment on column public.klar_collab_messages.manual is
  'true = im Admin von Hand erfasst (/admin/collab/manual), nicht über Webhook/Brevo.';
