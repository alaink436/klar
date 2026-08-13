-- Zielnische und ob der Account schon dorthin gesteuert wurde.
--
-- Bei einem frischen Account entscheidet nicht der erste Post, sondern was man
-- vorher konsumiert hat: der Feed muss in die Nische gezogen werden, sonst
-- liefert die Plattform den Post an das falsche Publikum aus. Das ist Arbeit,
-- die man einmal pro Account macht und danach nicht mehr sieht — und genau
-- deshalb vergisst man, welche Accounts sie schon hinter sich haben.
--
-- `steered_at` ist ein Zeitstempel, kein Ja/Nein: das Häkchen zeigt dasselbe,
-- aber nebenbei steht damit fest, seit wann — und bei einem Account, der seit
-- drei Monaten "eingesteuert" ist und nie gepostet hat, ist das die
-- interessantere Zahl.
alter table public.klar_account_status
  add column if not exists niche text,
  add column if not exists steered_at timestamptz;

comment on column public.klar_account_status.niche is
  'Zielnische des Accounts (Häkeln, Anime, Partyspiele …). Freitext, Vorschläge aus dem, was schon eingetragen ist.';
comment on column public.klar_account_status.steered_at is
  'Wann der Feed in die Zielnische gesteuert wurde. NULL = noch nicht; das Häkchen im Board setzt und löscht ihn.';
