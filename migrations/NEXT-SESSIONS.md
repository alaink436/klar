# Next-Sessions Handover

> Stand 2026-05-20 nach Klar-Commits `d4edd9f` + `28da1d6` (Funnel rich-schema)
> + heutigem MCP-Deploy von 3 `affiliate-ingest` Edge Functions.
>
> Diese Datei beschreibt **genau was die nächste Session pro App machen muss**.
> Eine Session = eine App. ~30 Min Aufwand pro App.

## Was JETZT live ist (kein User-Schritt mehr)

Drei Edge Functions sind deployed (MCP, ohne git-commit, ohne user-action):

| App | Project ID | Function | Slug | Status |
|---|---|---|---|---|
| Yarn-Stash | `zysmsgaordfkptzngntn` | affiliate-ingest | v1 | inactive (Secret fehlt) |
| Trubel | `hinivxigapnkrytpcqdl` | affiliate-ingest | v1 | inactive (Secret fehlt) |
| MyLoo | `jkgymggxshtsljjvketi` | affiliate-ingest | v1 | inactive (Secret fehlt) |

Wavelength hat seine eigene `revenuecat-webhook` v8 die das schon live macht.
Kelva + Moto: brauchen erst Migration `0002_attribution_for_kelva_moto.sql`
(siehe Session 5 unten).

## Per-Session-Aufgaben

Pro App-Session sind das die Schritte. Jede Session kann komplett unabhängig
vom Klar-Repo passieren — nur RC-Dashboard + Supabase-Dashboard für die
jeweilige App.

### Session 1 — Yarn-Stash aktivieren

1. **Secret holen:** SSH `root@5.75.147.188`, dann
   `grep yarnstash /root/affiliate-ingest-secrets.txt`. Den Wert nach
   `yarnstash: ` kopieren.
2. **Supabase Secret setzen:**
   - https://supabase.com/dashboard/project/zysmsgaordfkptzngntn/functions
   - "Manage secrets" → Add new
   - Name: `RC_WEBHOOK_SECRET`
   - Value: (aus Schritt 1)
   - Save
3. **RC Dashboard Webhook konfigurieren:**
   - RC Dashboard → Yarn-Stash App → Integrations → Webhooks → Add webhook
   - URL: `https://zysmsgaordfkptzngntn.supabase.co/functions/v1/affiliate-ingest`
   - Authorization header: (gleicher Wert wie Schritt 1, NICHT mit "Bearer "-Prefix)
   - Events: alle aktivieren (INITIAL_PURCHASE, RENEWAL, TRIAL_CONVERSION,
     PRODUCT_CHANGE, NON_RENEWING_PURCHASE, REFUND, CHARGEBACK, CANCELLATION,
     UNCANCELLATION, EXPIRATION)
   - Save Webhook
4. **Smoke-Test:** im RC-Dashboard auf den neuen Webhook → "Send test event"
   → Antwort sollte `{"ok":true,"test":true}` sein
5. **Verify in Funnel:** `https://getklar.org/admin/analytics?tab=funnel` →
   Yarn-Stash-Karte zeigt jetzt Backend live (kein "pending"-Hint mehr)

**Wichtig Yarn-Stash:** das ist NUR der RC-Pfad (Premium-Sub). Der Awin-Pfad
(Yarn-Shop-Provisionen) läuft schon separat via `awin-postback` Function +
`awin_conversions` Tabelle. Die Funnel-View summiert beide Quellen.

### Session 2 — Trubel aktivieren

Identisch zu Session 1, mit:
- Secret-Key: `grep trubel /root/affiliate-ingest-secrets.txt`
- Project ID: `hinivxigapnkrytpcqdl`
- URL: `https://hinivxigapnkrytpcqdl.supabase.co/functions/v1/affiliate-ingest`
- RC Dashboard: Trubel App

**Wichtig Trubel:** Reject-Round-2 Fixes sind noch pending (laut STATUS).
Affiliate-Ingest läuft trotzdem — Premium-Subs landen sauber sobald App live.

### Session 3 — MyLoo aktivieren

Identisch zu Session 1, mit:
- Secret-Key: `grep myloo /root/affiliate-ingest-secrets.txt`
- Project ID: `jkgymggxshtsljjvketi`
- URL: `https://jkgymggxshtsljjvketi.supabase.co/functions/v1/affiliate-ingest`
- RC Dashboard: MyLoo App

**Wichtig MyLoo:** Android blockiert (Google org-policy). Nur iOS-Traffic
für jetzt. Affiliate-Ingest funktioniert iOS-only auch sauber.

### Session 4 — Kelva aktivieren (zwei Phasen)

**Phase A (Migration, ~5 Min):**
1. Migration apply via Supabase MCP:
   - Tool: `mcp__46fdf25e-6c55-4f1d-890f-9d85eed88410__apply_migration`
   - project_id: `absnjkjxbxeyekmcmpof`
   - name: `kelva_attribution_v1`
   - query: vollständiger Inhalt von `klar/migrations/0002_attribution_for_kelva_moto.sql`
2. Verify: Tabelle `influencer_codes` existiert, `profiles.referred_by_code_id`
   Column vorhanden, RPCs `admin_create_influencer_code`/`validate_referral_code`/`capture_referral` da.

**Phase B (Deploy + Setup):**
3. Edge Function deployen (template-Pattern, SHAPE="B"):
   - Tool: `mcp__46fdf25e-6c55-4f1d-890f-9d85eed88410__deploy_edge_function`
   - project_id: `absnjkjxbxeyekmcmpof`
   - name: `affiliate-ingest`
   - verify_jwt: false
   - files: vom `migrations/templates/affiliate-ingest.ts` mit
     `APP = "kelva"`, `SHAPE = "B"`
4. Restliche Schritte wie Session 1, mit Secret-Key `grep kelva ...`

**App-Side TODO Kelva (separater Job im kelva/universal-life-hub-Repo):**
- App muss `captureReferralFromClipboard()` haben analog zu Yarn-Stash
  → Clipboard-Token-Format `kelvaref:<CODE>:v1` lesen, `capture_referral(code)`
  RPC aufrufen beim ersten Cold-Start

### Session 5 — Moto aktivieren (zwei Phasen)

Identisch zu Session 4 Kelva, mit:
- project_id: `mpqapdnixzgolmfyckla`
- Migration name: `moto_attribution_v1`
- APP: `"moto"`, SHAPE: `"B"`
- Secret-Key: `grep moto /root/affiliate-ingest-secrets.txt`
- Clipboard-Token-Format: `motoref:<CODE>:v1`

**Wichtig Moto:** Moto hat aktuell KEINE deployed `revenuecat-webhook` (nur
wise-dispatch + wise-reconcile). Heißt: kein bestehender Entitlement-Toggle.
Frage vor Deploy: hat Moto überhaupt RC + Premium-IAP konfiguriert? Wenn
nein, ist affiliate-ingest sinnlos bis RC eingerichtet ist.

## Was NACH allen 5 Sessions noch fehlt

Auch dann ist die Pipeline noch nicht vollständig. Pro App fehlt zusätzlich:

| Bauteil | Wavelength | Yarn-Stash | Trubel | MyLoo | Kelva | Moto |
|---|---|---|---|---|---|---|
| 1. Onboarding-Flow | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 2. Landing-Page | ✓ | ✓ | ❌ | ❌ | ❌ | ❌ |
| 3. Attribution in-App | ✓ | ✓ | ❌ | ❌ | ❌ | ❌ |
| 4. Ingest (heute) | ✓ | ✓ | ✓ | ✓ | ❌ | ❌ |
| 5. pg_cron Batch-Builder | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Onboarding-Flow (Bauteil 1)** ist eine ganz separate Stage 2-Session:
- `/affiliate/apply` Formular auf getklar.org (eventuell pro App)
- Admin-Approve-Button im `/admin/inbox`
- Approval ruft `admin_create_influencer_code` RPC für die jeweilige App-Supabase
- Wise-Recipient-Setup-Mail an Influencer

**Landing-Pages (Bauteil 2)** existieren nur für Wavelength + Yarn-Stash.
Andere brauchen `getklar.org/i/<app>/<code>` Routen (siehe
Yarn-Stash-Implementation als Vorlage in klar `src/app/i/yarnstash/[code]/`).

**App-Side Clipboard-Capture (Bauteil 3)** ist Code-Änderung pro App-Repo
(Wavelength + Yarn-Stash haben es bereits). Pro App ~1-2h.

**pg_cron Batch-Builder (Bauteil 5)** ist Stage 3 — monatlicher Job pro
App-Supabase der reife `referral_revenue_events` zu `influencer_payout_batches`
gruppiert. Existing Wise-Dispatch-Pipeline nimmt es dann auf.

## Wichtige Pfade & Referenzen

- **Template:** `klar/migrations/templates/affiliate-ingest.ts`
- **Doku:** `klar/migrations/INGEST-TEMPLATE.md` (Schema-Details, Shape-Erklärung)
- **Kelva/Moto Migration:** `klar/migrations/0002_attribution_for_kelva_moto.sql`
- **Secrets (VPS-only):** `root@5.75.147.188:/root/affiliate-ingest-secrets.txt`
- **Funnel-View:** `https://getklar.org/admin/analytics?tab=funnel`
- **Wavelength Reference:** `revenuecat-webhook` v8 in Wavelength Supabase
  `yxhzwzgnbmpjztkvdudr` (richer schema, nicht portierbar)
- **Klar Repo:** github.com/alaink436/klar, branch master, HEAD `d4edd9f`

## Fragen die jede Session-Person stellen sollte (vor Start)

1. **Hat die App RC + Premium-IAP konfiguriert?** Wenn nein → no-op, Ingest ist sinnlos
2. **Hat die App schon Test-Traffic im RC-Sandbox?** Wenn ja → smoke-test mit echtem Event statt nur TEST-Event
3. **Hat die App Influencers in der `influencers` Tabelle?** Wenn nein → Ingest läuft, Events landen mit `influencer_id=NULL` (handle reicht für die Attribution-Logik)
4. **Soll der existing `revenuecat-webhook` (entitlement-only) parallel laufen oder ersetzt werden?** Standard: parallel lassen, RC fires both URLs. Concerns sind sauber getrennt.
