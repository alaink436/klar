// Admin-UI language. Klar Control ships German copy; English is opt-in per
// browser via the DE/EN switch in the sidebar. The choice lives in the
// `klar_lang` cookie so the server components already render the right
// language — no flash of German before hydration, and it survives reloads.
//
// Scope on purpose: UI chrome only (labels, buttons, dialogs, hints).
// Vault *data* — the labels, providers and category names the admin typed —
// stays exactly as stored. Translating category names would fragment them the
// moment somebody saved an English one against a German datalist.

export type AdminLang = "de" | "en";

export const ADMIN_LANGS: readonly AdminLang[] = ["de", "en"] as const;

/** Cookie the switch writes and every server component reads. */
export const LANG_COOKIE = "klar_lang";
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function normalizeAdminLang(input: string | null | undefined): AdminLang {
  return (input ?? "").toLowerCase().slice(0, 2) === "en" ? "en" : "de";
}

/** Date format for the "last used" column. */
export const DATE_LOCALE: Record<AdminLang, string> = { de: "de-CH", en: "en-GB" };

/**
 * A piece of text inside a data table (provider presets, category examples).
 * A plain string is language-neutral (URLs, key prefixes like `sk-ant-…`);
 * the object form is used only where the text actually reads as prose.
 */
export type Localized = string | { de: string; en: string };

export function loc(value: Localized, lang: AdminLang): string {
  return typeof value === "string" ? value : value[lang];
}

const DE = {
  // ── Sidebar / shell ──────────────────────────────────────────────────────
  brandHome: "Klar Control Home",
  sectionStudio: "Studio",
  sectionCreator: "Creator",
  sectionCreatorNote: "pausiert",
  navOverview: "Übersicht",
  navTodos: "To-do",
  navInbox: "Inbox",
  navCollabs: "Collabs",
  navOutreach: "Outreach",
  navContent: "Content",
  navBookings: "Bookings",
  navCal: "Cal Admin",
  navAnalytics: "Analytics",
  navBrain: "AI-Brain",
  navChronik: "Chronik",
  navVault: "Vault",
  navRevenue: "Einnahmen",
  navPayouts: "Auszahlungen",
  navNoApps: "keine Apps",
  navCalNewTab: "Cal in neuem Tab",
  navSettings: "Einstellungen",
  navLogout: "Logout",
  themeToggle: "Theme wechseln",
  navDragHint: "Ziehen, um das Menü umzusortieren",
  todoSub:
    "Deine eigene Liste, als Wochenplan. Neue Punkte landen links ohne Termin — zieh sie auf einen Tag, setz bei Bedarf eine Uhrzeit. Was sich aus Daten ableiten lässt, steht auf der Übersicht.",
  todoPlaceholder: "Was ist zu tun?",
  todoAdd: "Hinzufügen",
  todoEmpty: "Nichts offen. Schreib den nächsten Punkt oben rein.",
  todoDelete: "Löschen",
  todoEditHint: "Klicken zum Bearbeiten",
  todoShowDone: (n: number) => `${n} erledigt anzeigen`,
  todoHideDone: (n: number) => `${n} erledigt ausblenden`,
  todoClearDone: "Erledigte entfernen",
  todoDoneAria: (title: string) => `„${title}“ abhaken`,
  todoReopenAria: (title: string) => `„${title}“ wieder öffnen`,
  todoNotConfigured: "Kein Schlüssel für die Datenbank gesetzt — die Liste kann nichts speichern.",
  chronikSub:
    "Was gelaufen ist und was du dir vorgenommen hast — beides direkt aus dem AI-Brain gelesen, nicht hier gepflegt.",
  chronikGoals: "Vorgenommen",
  chronikGoalsMeta: (open: number, blocked: number) =>
    blocked > 0 ? `${open} offen, davon ${blocked} blockiert` : `${open} offen`,
  chronikBlocked: "blockiert",
  chronikSessions: "Gelaufen",
  chronikSessionsMeta: (n: number, days: number) => `${n} Einträge an ${days} Tagen`,
  chronikNoBrain:
    "Kein Zugriff aufs AI-Brain — ohne BRAIN_GITHUB_TOKEN bleibt die Chronik leer.",
  todoPlanToday: "Heute",
  todoPlanTomorrow: "Morgen",
  todoPlanAria: (title: string) => `Tag für „${title}“ wählen`,
  todoBucketOverdue: "Überfällig",
  todoBucketToday: "Heute",
  todoBucketTomorrow: "Morgen",
  todoBucketWeek: "Diese Woche",
  todoBucketLater: "Später",
  todoBucketNone: "Ohne Termin",
  todoPrevWeek: "Woche zurück",
  todoNextWeek: "Woche vor",
  todoThisWeek: "Diese Woche",
  todoDropHere: "Hier ablegen",
  todoAllDay: "ganztägig",
  todoTimeAria: (title: string) => `Uhrzeit für „${title}“`,
  icalTitle: "Im iPhone-Kalender mitlesen",
  icalBody: (n: number) =>
    `Geplante Punkte (aktuell ${n}) lassen sich als Kalender abonnieren — sie erscheinen dann als ganztägige Einträge im iPhone. Der Kalender ist nur zum Lesen: geändert wird hier.`,
  icalStep1: "In AI-Brain → Zugang einen Token mit dem Scope todos:ical erzeugen (wird nur einmal angezeigt).",
  icalStep2: "Auf dem iPhone: Einstellungen → Apps → Kalender → Accounts → Account hinzufügen → Andere → Kalenderabo. Dort einsetzen:",
  icalStep3: "Apple fragt etwa stündlich nach. Wird der Token widerrufen, bleibt der Kalender leer — abbestellen genügt dann.",
  navSettingsTitle: "Menü",
  navSettingsBody:
    "Reihenfolge der Menüeinträge und welche du überhaupt siehst. In der Seitenleiste kannst du die Einträge auch direkt ziehen. Ausgeblendete Seiten bleiben über ihre Adresse erreichbar — sie stehen nur nicht mehr im Menü.",
  navMoveUp: "Hoch",
  navMoveDown: "Runter",
  navHide: "Ausblenden",
  navShow: "Einblenden",
  navReset: "Auf Standard zurücksetzen",
  collabOpenAria: (n: number) => `${n} unbeantwortete Collab-Anfrage${n === 1 ? "" : "n"}`,
  collabsSub:
    "Wer auf die Adressen aus den TikTok- und Instagram-Bios schreibt, landet hier. Geantwortet wird in der Inbox — jede Zeile führt direkt zum Thread.",

  // Language switch
  langSection: "Sprache",
  langAria: "Sprache der Oberfläche",
  langHint: "Stellt die Oberfläche um. Gespeicherte Einträge bleiben, wie du sie angelegt hast.",

  // ── Vault page ───────────────────────────────────────────────────────────
  vaultTitle: "Vault",
  vaultSubA: "Keys werden AES-256-GCM verschlüsselt gespeichert (Master-Key nur in Vercel). Ein Agent mit ",
  vaultSubB: "-Token nutzt sie über den Proxy, ohne sie je zu sehen. Klartext ist bewusst nicht abrufbar.",
  vaultInactiveA: "Vault inaktiv: setze ",
  vaultInactiveB: " in Vercel, dann werden Keys ver- und entschlüsselt.",
  statStored: "Gespeicherte Keys",
  statActive: "Aktiv genutzt",
  badgeActive: "Vault aktiv",
  badgeInactive: "Vault inaktiv",

  // Flash messages posted back by /admin/vault/save (mapped from codes).
  flashSaved: "Vault-Key gespeichert (verschlüsselt).",
  flashRotated: "Vault-Key rotiert (neu verschlüsselt).",
  flashUpdated: "Vault-Eintrag aktualisiert.",
  flashDeleted: "Vault-Key gelöscht.",
  flashNoEntry: "Kein Eintrag angegeben.",
  flashNoKey: "Kein Key angegeben.",
  flashNoNewKey: "Kein neuer Key angegeben.",
  flashDeleteFailed: "Löschen fehlgeschlagen.",
  flashBadForm: "Formular konnte nicht gelesen werden.",
  flashUnknownAction: "Unbekannte Aktion.",
  flashVaultNotConfigured: "Vault nicht konfiguriert.",
  flashBadBaseUrl: "Base-URL ungültig.",

  // ── Vault manager: toolbar + table ───────────────────────────────────────
  searchPlaceholder: "Suchen: Label, Provider, Kategorie, URL …",
  searchAria: "Vault durchsuchen",
  addKey: "Key hinzufügen",
  colKey: "Key",
  colProxy: "Proxy-URL",
  colLastUsed: "Zuletzt",
  storeOnly: "Store-only · kein Proxy",
  showKey: "Key anzeigen",
  moreActions: "Weitere Aktionen",
  copyProxy: "Proxy-URL kopieren",
  copied: "Kopiert ✓",
  edit: "Bearbeiten",
  rotate: "Key rotieren",
  delete: "Löschen",

  // Empty states
  emptyTitle: "Noch keine Keys im Vault",
  emptyBody:
    "Über „Key hinzufügen“ einen Key ablegen — mit Kategorie. Mit Base-URL über den Proxy nutzbar, ohne nur zum späteren Anzeigen.",
  noHits: (q: string) => `Keine Treffer für „${q}“`,
  resetSearch: "Suche zurücksetzen",

  // ── Form fields ──────────────────────────────────────────────────────────
  fieldLabel: "Label",
  fieldCategory: "Kategorie",
  fieldCategoryPlaceholder: "z.B. KI / LLM",
  fieldProvider: "Provider",
  fieldPreset: "Provider-Vorlage",
  fieldPresetHint: "(füllt URL + Auth automatisch)",
  presetPickAny: "— Provider wählen (optional) —",
  presetPickIn: (category: string) => `— ${category}-Provider wählen —`,
  fieldAuthHeader: "Auth-Header",
  fieldQueryParam: "Query-Param-Name",
  fieldBaseUrl: "Base-URL — leer lassen = nur speichern (kein Proxy)",
  fieldAuthScheme: "Schema-Prefix (leer bei x-api-key / api-key)",
  fieldAuthSchemeShort: "Schema-Prefix",
  fieldAuthIn: "Auth-Ort",
  fieldAuthInHintA: "(Header = Standard; Query = Key als URL-Parameter, z.B. Evomi ",
  fieldAuthInHintB: ")",
  optHeader: "Header",
  optQuery: "Query-Parameter",
  fieldSecret: "API-Key (wird verschlüsselt, danach nicht mehr lesbar)",
  secretPlaceholderRotate: "neuer Key …",
  exampleFor: (what: string) => `Beispiel für ${what}:`,
  thisCategory: "diese Kategorie",
  eg: (hint: string) => `z.B. ${hint}`,

  // ── Dialogs ──────────────────────────────────────────────────────────────
  cancel: "Abbrechen",
  addTitle: "API-Key hinzufügen",
  addBody:
    "Wird server-seitig AES-256-GCM verschlüsselt. Mit Base-URL über den Proxy nutzbar; ohne Base-URL nur gespeichert und per „Key anzeigen“ abrufbar.",
  addSubmit: "Verschlüsselt speichern",

  rotateTitle: "Key rotieren",
  rotateBody: (label: string) => `Neuer Key für „${label}“. Der alte wird ersetzt; die Proxy-URL bleibt gleich.`,
  rotateSubmit: "Rotieren",

  editTitle: "Eintrag bearbeiten",
  editBody: (label: string) =>
    `Metadaten von „${label}“ ändern. Der gespeicherte Key bleibt unverändert (zum Ersetzen „Key rotieren“). Base-URL leeren = nur speichern, kein Proxy; die Proxy-URL/ID bleibt gleich.`,
  editSubmit: "Speichern",

  revealTitle: (label: string) => `Key anzeigen — ${label}`,
  revealBody: "Klartext, nur für dich (Admin). Kopier ihn und schließe das Fenster wieder.",
  revealLoading: "Entschlüssele…",
  revealError: (status: number) => `Fehler ${status}`,
  revealNetworkError: "Netzwerkfehler",
  close: "Schließen",
  copyKey: "Key kopieren",
  copiedKey: "✓ Kopiert",

  deleteTitle: "Vault-Key löschen?",
  deleteBody: (label: string) =>
    `„${label}“ wird endgültig gelöscht. Agents mit dieser Proxy-URL verlieren den Zugriff. Das lässt sich nicht rückgängig machen.`,
  deleteSubmit: "Endgültig löschen",
};

export type AdminMessages = typeof DE;

const EN: AdminMessages = {
  // ── Sidebar / shell ──────────────────────────────────────────────────────
  brandHome: "Klar Control home",
  sectionStudio: "Studio",
  sectionCreator: "Creator",
  sectionCreatorNote: "paused",
  navOverview: "Overview",
  navTodos: "To-do",
  navInbox: "Inbox",
  navCollabs: "Collabs",
  navOutreach: "Outreach",
  navContent: "Content",
  navBookings: "Bookings",
  navCal: "Cal admin",
  navAnalytics: "Analytics",
  navBrain: "AI-Brain",
  navChronik: "History",
  navVault: "Vault",
  navRevenue: "Revenue",
  navPayouts: "Payouts",
  navNoApps: "no apps",
  navCalNewTab: "Cal in a new tab",
  navSettings: "Settings",
  navLogout: "Log out",
  themeToggle: "Switch theme",
  navDragHint: "Drag to reorder the menu",
  todoSub:
    "Your own list, as a week. New items land on the left with no date — drag one onto a day and add a time if it needs one. Anything that follows from data lives on the overview.",
  todoPlaceholder: "What needs doing?",
  todoAdd: "Add",
  todoEmpty: "Nothing open. Write the next one in above.",
  todoDelete: "Delete",
  todoEditHint: "Click to edit",
  todoShowDone: (n: number) => `Show ${n} done`,
  todoHideDone: (n: number) => `Hide ${n} done`,
  todoClearDone: "Clear done",
  todoDoneAria: (title: string) => `Tick off “${title}”`,
  todoReopenAria: (title: string) => `Reopen “${title}”`,
  todoNotConfigured: "No database key configured — the list cannot save anything.",
  chronikSub:
    "What happened and what you set out to do — both read straight from the AI-Brain, not maintained here.",
  chronikGoals: "Set out to do",
  chronikGoalsMeta: (open: number, blocked: number) =>
    blocked > 0 ? `${open} open, ${blocked} blocked` : `${open} open`,
  chronikBlocked: "blocked",
  chronikSessions: "Happened",
  chronikSessionsMeta: (n: number, days: number) => `${n} entries across ${days} days`,
  chronikNoBrain: "No access to the AI-Brain — without BRAIN_GITHUB_TOKEN the history stays empty.",
  todoPlanToday: "Today",
  todoPlanTomorrow: "Tomorrow",
  todoPlanAria: (title: string) => `Pick a day for “${title}”`,
  todoBucketOverdue: "Overdue",
  todoBucketToday: "Today",
  todoBucketTomorrow: "Tomorrow",
  todoBucketWeek: "This week",
  todoBucketLater: "Later",
  todoBucketNone: "No date",
  todoPrevWeek: "Previous week",
  todoNextWeek: "Next week",
  todoThisWeek: "This week",
  todoDropHere: "Drop here",
  todoAllDay: "all day",
  todoTimeAria: (title: string) => `Time for “${title}”`,
  icalTitle: "Follow along in the iPhone calendar",
  icalBody: (n: number) =>
    `Planned items (currently ${n}) can be subscribed to as a calendar — they show up as all-day entries on the phone. Read-only: changes happen here.`,
  icalStep1: "In AI-Brain → Zugang, mint a token with the todos:ical scope (shown once).",
  icalStep2: "On the iPhone: Settings → Apps → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar. Paste:",
  icalStep3: "Apple refreshes roughly hourly. Revoke the token and the calendar simply goes empty — then unsubscribe.",
  navSettingsTitle: "Menu",
  navSettingsBody:
    "The order of the menu entries and which ones you see at all. You can also drag them directly in the sidebar. Hidden pages stay reachable by their address — they just leave the menu.",
  navMoveUp: "Up",
  navMoveDown: "Down",
  navHide: "Hide",
  navShow: "Show",
  navReset: "Reset to default",
  collabOpenAria: (n: number) => `${n} unanswered collab request${n === 1 ? "" : "s"}`,
  collabsSub:
    "Whoever writes to the addresses in the TikTok and Instagram bios shows up here. You reply from the inbox — every row leads straight to the thread.",

  langSection: "Language",
  langAria: "Interface language",
  langHint: "Switches the interface. Saved entries stay exactly as you created them.",

  // ── Vault page ───────────────────────────────────────────────────────────
  vaultTitle: "Vault",
  vaultSubA:
    "Keys are stored AES-256-GCM encrypted (the master key lives in Vercel only). An agent holding a ",
  vaultSubB: " token uses them through the proxy without ever seeing them. Plaintext is deliberately not retrievable.",
  vaultInactiveA: "Vault inactive: set ",
  vaultInactiveB: " in Vercel, then keys get encrypted and decrypted.",
  statStored: "Stored keys",
  statActive: "In active use",
  badgeActive: "Vault active",
  badgeInactive: "Vault inactive",

  flashSaved: "Vault key saved (encrypted).",
  flashRotated: "Vault key rotated (re-encrypted).",
  flashUpdated: "Vault entry updated.",
  flashDeleted: "Vault key deleted.",
  flashNoEntry: "No entry given.",
  flashNoKey: "No key given.",
  flashNoNewKey: "No new key given.",
  flashDeleteFailed: "Delete failed.",
  flashBadForm: "Could not read the form.",
  flashUnknownAction: "Unknown action.",
  flashVaultNotConfigured: "Vault not configured.",
  flashBadBaseUrl: "Base URL is invalid.",

  // ── Vault manager: toolbar + table ───────────────────────────────────────
  searchPlaceholder: "Search: label, provider, category, URL …",
  searchAria: "Search the vault",
  addKey: "Add key",
  colKey: "Key",
  colProxy: "Proxy URL",
  colLastUsed: "Last used",
  storeOnly: "Store-only · no proxy",
  showKey: "Show key",
  moreActions: "More actions",
  copyProxy: "Copy proxy URL",
  copied: "Copied ✓",
  edit: "Edit",
  rotate: "Rotate key",
  delete: "Delete",

  emptyTitle: "No keys in the vault yet",
  emptyBody:
    "Use “Add key” to store one — with a category. With a base URL it works through the proxy, without one it is only kept for later viewing.",
  noHits: (q: string) => `No matches for “${q}”`,
  resetSearch: "Clear search",

  // ── Form fields ──────────────────────────────────────────────────────────
  fieldLabel: "Label",
  fieldCategory: "Category",
  fieldCategoryPlaceholder: "e.g. KI / LLM",
  fieldProvider: "Provider",
  fieldPreset: "Provider preset",
  fieldPresetHint: "(fills URL + auth automatically)",
  presetPickAny: "— pick a provider (optional) —",
  presetPickIn: (category: string) => `— pick a ${category} provider —`,
  fieldAuthHeader: "Auth header",
  fieldQueryParam: "Query param name",
  fieldBaseUrl: "Base URL — leave empty = store only (no proxy)",
  fieldAuthScheme: "Scheme prefix (empty for x-api-key / api-key)",
  fieldAuthSchemeShort: "Scheme prefix",
  fieldAuthIn: "Auth location",
  fieldAuthInHintA: "(header = default; query = key as a URL parameter, e.g. Evomi ",
  fieldAuthInHintB: ")",
  optHeader: "Header",
  optQuery: "Query parameter",
  fieldSecret: "API key (gets encrypted, not readable afterwards)",
  secretPlaceholderRotate: "new key …",
  exampleFor: (what: string) => `Example for ${what}:`,
  thisCategory: "this category",
  eg: (hint: string) => `e.g. ${hint}`,

  // ── Dialogs ──────────────────────────────────────────────────────────────
  cancel: "Cancel",
  addTitle: "Add API key",
  addBody:
    "Encrypted server-side with AES-256-GCM. With a base URL it is usable through the proxy; without one it is only stored and readable via “Show key”.",
  addSubmit: "Save encrypted",

  rotateTitle: "Rotate key",
  rotateBody: (label: string) => `New key for “${label}”. The old one is replaced; the proxy URL stays the same.`,
  rotateSubmit: "Rotate",

  editTitle: "Edit entry",
  editBody: (label: string) =>
    `Change the metadata of “${label}”. The stored key is untouched (use “Rotate key” to replace it). Clearing the base URL means store-only, no proxy; the proxy URL/ID stays the same.`,
  editSubmit: "Save",

  revealTitle: (label: string) => `Show key — ${label}`,
  revealBody: "Plaintext, for your eyes only (admin). Copy it and close the window again.",
  revealLoading: "Decrypting…",
  revealError: (status: number) => `Error ${status}`,
  revealNetworkError: "Network error",
  close: "Close",
  copyKey: "Copy key",
  copiedKey: "✓ Copied",

  deleteTitle: "Delete vault key?",
  deleteBody: (label: string) =>
    `“${label}” will be deleted for good. Agents using this proxy URL lose access. This cannot be undone.`,
  deleteSubmit: "Delete permanently",
};

export function tAdmin(lang: AdminLang): AdminMessages {
  return lang === "en" ? EN : DE;
}

/**
 * Flash codes posted back by /admin/vault/save. Anything that is not a known
 * code (e.g. a technical error string from lib/vault) is shown verbatim.
 */
export function flashText(code: string, lang: AdminLang): string {
  const t = tAdmin(lang);
  const map: Record<string, string> = {
    saved: t.flashSaved,
    rotated: t.flashRotated,
    updated: t.flashUpdated,
    deleted: t.flashDeleted,
    "no-entry": t.flashNoEntry,
    "no-key": t.flashNoKey,
    "no-new-key": t.flashNoNewKey,
    "delete-failed": t.flashDeleteFailed,
    "bad-form": t.flashBadForm,
    "unknown-action": t.flashUnknownAction,
    // raw strings from lib/vault that read as prose
    "vault not configured": t.flashVaultNotConfigured,
    "kein Key angegeben": t.flashNoKey,
    "base_url ungültig": t.flashBadBaseUrl,
  };
  return map[code] ?? code;
}
