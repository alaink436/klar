# Klar Affiliate-Payout Setup

Diese Notiz beschreibt was du pro App tun musst, damit `/admin` für sie
Salden anzeigt und „Auszahlungen" über Wise abwickeln kann.

## Was bereits da ist

- **Generisches Schema** ist via MCP-Migration `affiliates_v1_init` in alle
  6 App-Supabases ausgerollt (Yarn-Stash, Trubel, MyLoo, Wavelength,
  Kelva, Moto). Wavelength hatte vorher schon ein **richer** Schema, dort
  wurde nur die kompatible `influencer_claimable` View nachgezogen.
- **Klar `/admin`** (route.ts) liest pro App `influencers`,
  `influencer_claimable`, `referral_revenue_events`,
  `influencer_payout_batches`, `influencer_payout_items`. Apps ohne
  Daten zeigen „nicht ausgerollt", brechen aber nichts.
- **Zentrale Auszahlungs-View** `/admin?view=payouts` aggregiert alle
  Batches aller verdrahteten Apps. „Alle vorbereiten"-Button ruft
  `/admin/dispatch-all` → loop über jede App's `wise-dispatch`.

## Was du selbst noch tun musst

### 1. KLAR_ADMIN_APPS env in Vercel

Setze für jede App, die im `/admin` sichtbar sein soll, einen Eintrag:

```json
[
  {
    "slug": "yarn-stash",
    "name": "Yarn-Stash",
    "supabaseUrl": "https://zysmsgaordfkptzngntn.supabase.co",
    "serviceKey": "<service-role key>",
    "functionsBase": "https://zysmsgaordfkptzngntn.supabase.co/functions/v1",
    "adminKey": "<random 32-byte secret, gleiches Secret in App-Supabase als KLAR_APP_ADMIN_KEY>"
  },
  …
]
```

Supabase Project-IDs:

| slug         | project_id              |
| ------------ | ----------------------- |
| `yarn-stash` | `zysmsgaordfkptzngntn`  |
| `trubel`     | `hinivxigapnkrytpcqdl`  |
| `myloo`      | `jkgymggxshtsljjvketi`  |
| `wavelength` | `yxhzwzgnbmpjztkvdudr`  |
| `kelva`      | `absnjkjxbxeyekmcmpof`  |
| `moto`       | `mpqapdnixzgolmfyckla`  |

### 2. Wise Business-Account + API-Token

- Erstelle (falls noch nicht) einen Wise-Business-Account.
- Generiere ein **Personal Token** unter Settings → API → Tokens.
- Notiere deine `WISE_PROFILE_ID` (Business Profile, integer).

### 3. Edge Functions deployen (pro App)

Templates liegen in `migrations/templates/`:

- `wise-dispatch.ts` → wird `supabase/functions/wise-dispatch/index.ts`
- `wise-reconcile.ts` → wird `supabase/functions/wise-reconcile/index.ts`

Setup pro App-Supabase:

```bash
# in der jeweiligen App-Codebase
supabase functions deploy wise-dispatch
supabase functions deploy wise-reconcile

supabase secrets set \
  WISE_API_TOKEN=<dein Wise-Token> \
  WISE_PROFILE_ID=<deine Profile-ID> \
  WISE_SOURCE_CURRENCY=EUR \
  KLAR_APP_ADMIN_KEY=<gleiches Secret wie in KLAR_ADMIN_APPS.adminKey>
```

### 4. Influencer-Onboarding (Multi-Domain, automatisch)

Sobald ein Influencer einen Code mintet (z. B. via getklar.org/affiliate
oder über die App-Marketing-Seite), schreibt das System eine Row in
`influencers` mit `handle`, `email`, `signup_domain`, `source_app`. Der
`wise_recipient_id` wird beim ersten Auszahlungs-Schritt nachgefragt
(Email-Link zur Wise-Account-Wahl) — das ist der Teil der noch in
einem Folge-Sprint kommt.

### 5. Conversion-Ingest (pro App)

Damit Batches überhaupt Beträge bekommen, müssen `referral_revenue_events`
befüllt werden. Pro App heißt das ein Webhook von:

- **RevenueCat** → schreibt `event_at`, `gross_revenue_cents`,
  `gross_currency` (USD/EUR/CHF…), `share_cents_eur` (50% in EUR),
  `matured_at` (60 Tage später, nach Refund-Window).
- **Awin** (für Knit Picks, Minerva etc.) → analog, source="awin".

Wavelength hat das in ihrem Schema schon abstrahiert (`event_type`,
`counts_for_payout`, `rc_subscriber_id`). Die anderen 5 Apps brauchen
noch ihre App-spezifische `ingest-conversion`-Edge-Function — auch das
ist Folge-Sprint.

### 6. pg_cron-Batch-Builder

Monatlicher Job in jeder App-Supabase, der alle gereiften, ungebatchten
Events zu `influencer_payout_batches` + `influencer_payout_items` rollt
und Status auf `awaiting_release` setzt. Cron-Skript ist app-spezifisch
(Refund-Window, Mindestbetrag, etc.) — nicht im Template enthalten, weil
Trubel/MyLoo/Wavelength/Yarn-Stash unterschiedliche Mindestbeträge haben
können.

## Verification-Checklist

Nach dem Setup einer App:

1. `/admin` → App-Tab klicken → sollte „nicht ausgerollt" durch echte
   Salden ersetzen, sobald `influencers` befüllt ist.
2. `/admin?view=payouts` → KPI-Cards zeigen „Offen gesamt" inkl. dieser App.
3. Test-Batch manuell anlegen, „via Wise" klicken → Wise-Dashboard
   sollte den Transfer als Draft sehen.
4. Wise → Batch funden → 1-2h warten → „Status holen" → Item-Status flippt
   auf `paid`, Batch-Status auf `paid`.

## Quick-Sanity-SQL pro App

```sql
-- in jedem App-Supabase ausführen, sollte 5 Zeilen ergeben
select tablename from pg_tables
where schemaname='public'
  and tablename in ('influencers','referral_revenue_events',
                    'influencer_payout_batches','influencer_payout_items')
order by tablename;

select count(*) from public.influencer_claimable;  -- View vorhanden = 0+ rows ohne Error
```
