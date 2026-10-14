-- klar_inquiries for the creator form on getklar.org (Alain, 2026-10-14:
-- "getklar.org ist die Akquise-Seite fuer die Creator", creators choose between
-- commission and CPM).
--
-- `deal`: how the creator wants to be paid. Null for older rows and for
-- consulting/coaching requests.
-- target_app: Anime Vault and Learnbound join the list; the old slugs stay so
-- historical rows still pass (myloo = Pocketmate, wavelength = Basalt).
--
-- Lives in the Klar-Hub Supabase (exiuwektrqxvycclqfdd). Applied via MCP
-- migration `inquiry_deal` (2026-10-14).

alter table public.klar_inquiries
  add column if not exists deal text
  check (deal is null or deal in ('commission', 'cpm'));

alter table public.klar_inquiries drop constraint if exists klar_inquiries_target_app_chk;
alter table public.klar_inquiries add constraint klar_inquiries_target_app_chk check (
  target_app is null or target_app in (
    'trubel', 'myloo', 'wavelength', 'yarn-stash', 'kelva', 'moto', 'anime-vault', 'learnbound'
  )
);
