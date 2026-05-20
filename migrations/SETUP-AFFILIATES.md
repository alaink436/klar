# Klar Affiliate-Payout Setup

Diese Doku erklärt wie du Wise + die 6 App-Edge-Functions in einem Rutsch
aufsetzt. Das eigentliche Aussstellen läuft über das Skript
`scripts/setup-affiliates.mjs`, du machst nur Pre-flight + Input.

## Was läuft schon

- **Schema** ist via MCP-Migration in alle 6 App-Supabases ausgerollt
  (Yarn-Stash / Trubel / MyLoo / Wavelength / Kelva / Moto). Tabellen:
  `influencers`, `referral_revenue_events`, `influencer_payout_batches`,
  `influencer_payout_items`. View: `influencer_claimable`.
- **Klar /admin** liest die Tabellen, hat eine zentrale Auszahlungen-View
  (`/admin?view=payouts`) und ein „Alle vorbereiten"-Button der über alle
  Apps loopt.
- **Edge Function Code** liegt in `supabase/functions/wise-dispatch/` und
  `supabase/functions/wise-reconcile/` und ist deploy-ready.

## Was du selbst noch tun musst (3 Schritte)

### Schritt 1 — Wise

1. Wise Business → Settings → API tokens → **Create new token** mit
   **Full access**. Token sofort kopieren (wird einmalig angezeigt).
2. Wise Business → Settings → Account details → **Business profile**.
   Notiere die numerische ID.

Die Werte gehen gleich in `affiliates-input.json` (lokal, gitignored).

### Schritt 2 — App-Service-Role-Keys einsammeln

Für jede der 6 Apps brauchst du den `service_role`-Key (RLS-Bypass,
server-only, niemals in Client-Code).

Pro App: Supabase Dashboard → das App-Projekt öffnen → **Settings** →
**API** → unter „Project API keys" den **service_role**-Wert kopieren.

| App         | Project-ID              | Service-Role-Key holen aus               |
| ----------- | ----------------------- | ---------------------------------------- |
| yarn-stash  | `zysmsgaordfkptzngntn`  | Yarn-Stash Supabase Settings → API       |
| trubel      | `hinivxigapnkrytpcqdl`  | Trubel Supabase Settings → API           |
| myloo       | `jkgymggxshtsljjvketi`  | MyLoo Supabase Settings → API            |
| wavelength  | `yxhzwzgnbmpjztkvdudr`  | Wavelength Supabase Settings → API       |
| kelva       | `absnjkjxbxeyekmcmpof`  | Kelva Supabase Settings → API            |
| moto        | `mpqapdnixzgolmfyckla`  | Moto Maintenance Supabase Settings → API |

### Schritt 3 — Skript laufen lassen

**Pre-flight (einmalig):**

```bash
# Supabase CLI installieren (Windows)
scoop install supabase
# oder via npm (cross-platform)
npm install -g supabase

# Supabase einloggen (öffnet Browser)
supabase login
```

**Input-Datei anlegen:**

```bash
cd C:\Users\Alain Kessler\klar
cp scripts/affiliates-input.example.json scripts/affiliates-input.json
# affiliates-input.json öffnen und alle PASTE_* Felder ersetzen
```

In `scripts/affiliates-input.json` füllst du:
- `wise.api_token` → dein Wise-Token aus Schritt 1
- `wise.profile_id` → deine Business Profile-ID aus Schritt 1
- 6× `apps.<slug>.service_role_key` → die aus Schritt 2

**Skript starten:**

```bash
npm run affiliates:setup
```

Das Skript wird pro App:
1. Ein zufälliges 32-byte `KLAR_APP_ADMIN_KEY` erzeugen
2. Alle 4 Wise-Secrets in der App-Supabase setzen
3. `wise-dispatch` und `wise-reconcile` deployen
4. Einen Smoke-Test gegen die deployed Function ausführen
5. Resultate in `scripts/affiliates-output.json` schreiben (gitignored)

Am Ende druckt es ein fertiges `KLAR_ADMIN_APPS`-JSON, das du in Vercel
unter `klar` Project → Settings → Environment Variables einträgst.

### Schritt 4 — Vercel env

Im Vercel-Dashboard:
1. `klar` Projekt → Settings → Environment Variables
2. **New** → Key: `KLAR_ADMIN_APPS`, Value: das JSON vom Skript-Output,
   Environment: **Production** (+ Preview falls du willst)
3. **Save**, dann **Deployments** → letzten Deploy **Redeploy** klicken

Nach dem Redeploy sind alle 6 Apps in `/admin` sichtbar und `/admin?view=payouts`
kann Batches über alle Apps holen.

## Wenn was schiefgeht

Das Skript ist idempotent: bei einem zweiten Run werden bestehende
`admin_key`-Werte aus `affiliates-output.json` wiederverwendet, sodass
dein Vercel-env nicht jedes Mal neu paste-en musst. Du kannst also
gefahrlos nochmal laufen lassen, falls eine App halb durch ist.

Bei Smoke-Test-Failures:
- `401 unauthorized` → admin_key kam nicht an, Secrets neu setzen
- `500 wise_misconfigured` → Wise-Token oder Profile-ID fehlt
- Timeout → Edge Function deploy noch nicht durch, 30s warten und erneut

## Was noch fehlt (Folge-Sprint)

Aufgesetzt ist die Auszahlungs-Pipeline. Was noch nicht da ist:

1. **Per-App Conversion-Ingest** — RevenueCat- + Awin-Webhooks die in
   `referral_revenue_events` schreiben. Wavelength hat das schon, die
   anderen 5 brauchen analoge Edge Functions.
2. **Onboarding-Flow** — wie kommt ein Influencer überhaupt mit
   `wise_recipient_id` in die `influencers`-Tabelle. Aktuell muss man
   das manuell setzen.
3. **pg_cron-Batch-Builder** — der monatliche Job der gereifte Events zu
   Batches rollt. Pro App eigener Cron-Job nötig (Refund-Window
   unterscheidet sich).

Ohne diese drei Dinge bleiben die Tabellen leer und `/admin?view=payouts`
zeigt eine Empty-State. Setup-Skript bereitet aber den Boden vor.
