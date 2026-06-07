// Affiliate-Onboarding i18n. Single source of truth for all UI strings.
// Used by OnboardingShell + Step components via getMessages(lang).
//
// Each message can be a string or a function that returns a string for
// interpolation (e.g. brand-name placeholders). Keep all translations in
// the Klar Voice: normie-aspirational, informal address (du/you/tú/tu),
// no dev-jargon, no em-dashes (use comma/colon/parentheses instead).

export type Lang = "de" | "en" | "es" | "it" | "fr";

export const SUPPORTED_LANGS: readonly Lang[] = ["de", "en", "es", "it", "fr"] as const;

export function normalizeLang(input: string | null | undefined): Lang {
  const v = (input ?? "").toLowerCase().slice(0, 2);
  if (v === "es") return "es";
  if (v === "en") return "en";
  if (v === "it") return "it";
  if (v === "fr") return "fr";
  return "de";
}

export interface Messages {
  // Top frame
  brandSubline: string;
  stepShort: string;

  // Step labels
  stepWelcome: string;
  stepTracking: string;
  stepPayout: string;
  stepLive: string;
  /** Sign step label. Optional: the online-signing step currently ships
   *  EN-only copy, so non-EN onboardings fall back to "Sign" in stepLabel(). */
  stepSign?: string;

  // Common buttons / a11y
  next: string;
  back: string;
  backAria: string;

  // Welcome
  welcomeGreet: (handle: string) => string;
  welcomeLede: (brandName: string) => string;
  welcomeEyebrowStreams: string;
  welcomeTitleTwoStreams: { plain: string; italic: string };
  welcomeTitleOneStream: { plain: string; italic: string };
  welcomeEyebrowCalc: string;
  welcomeTitleCalc: { plain: string; italic: string };
  welcomeCalcSubline: string;

  // Welcome V2 (sales variant). Optional until rolled out to every language;
  // when a key is absent the Welcome step falls back to the V1 lede.
  welcomeFreshNote?: string;
  dealEyebrow?: string;
  dealTitle?: { plain: string; italic: string };
  dealBaseYears?: (years: number) => string;
  dealLadder?: (tier1Eur: number, tier1Months: number, tier2Eur: number) => string;
  dealCommission?: (pct: number) => string;
  dealGoodie?: string;
  setupEyebrow?: string;
  setupTitle?: { plain: string; italic: string };
  setupLink?: string;
  setupDashboard?: string;
  setupDrive?: string;

  // Stream cards
  streamEyebrowSub: string;
  streamEyebrowOneShot: string;
  streamTitleSubTail: string;
  streamTitleOneShotTail: string;
  streamDetailSub: (pct: number, months: number, price: string) => string;
  streamDetailOneShot: (pct: number, months: number, price: string) => string;
  streamTitleYarn: { plain: string; italic: string };
  streamTitleAlbum: { plain: string; italic: string };
  streamDetailYarn: string;
  streamDetailAlbum: string;

  // Calculator
  calcViewsLabel: string;
  calcViewsAria: string;
  calcStreamLabel: (label: string) => string;
  calcSubSummary: (price: string, pct: number, months: number) => string;
  calcOneShotSummary: (price: string, pct: number) => string;
  calcConvLabel: string;
  calcConvAria: string;
  calcMiniBioClicks: (ctrPct: string) => string;
  calcMiniInstalls: (installPct: number) => string;
  calcMiniBuyers: (convPct: number) => string;
  calcMiniS2Recurring: string;
  calcMiniS2OneShot: string;
  calcTotalLabelSub: string;
  calcTotalLabelSubTwoStreams: string;
  calcTotalLabelOneShot: string;
  calcTotalLabelOneShotTwoStreams: string;
  calcTotalLabelMonthsHint: (months: number) => string;
  calcTotalSubStreams: string;
  calcOneShotHint: string;
  calcLifetimeHint: (months: number, total: string) => string;
  calcSliderRateLabel: (label: string) => string;
  calcSliderBasketLabel: (label: string) => string;
  calcSlash: string;
  calcSlashAria: string;

  // Tracking step
  trackingTitle: { plain: string; italic: string };
  trackingLede: string;
  trackingProtectionEyebrow: string;
  trackingProtection1: string;
  trackingProtection2: string;
  trackingProtection3: string;
  trackingProtection4: string;
  trackingAdEyebrow: string;
  trackingAdBody: string;
  trackingDiagramCaption: string;
  diagramStep1Caption: string;
  diagramStep2Caption: string;
  diagramStep3Caption: string;
  diagramStep4Caption: string;
  diagramRefundLabel: string;
  diagramRedirectLabel: string;
  diagramReleaseLabel: string;

  // Payout step
  payoutTitle: { plain: string; italic: string };
  payoutLede: string;
  fieldDisplayName: string;
  fieldDisplayNamePh: string;
  fieldCountry: string;
  fieldCountryPlaceholder: string;
  fieldWiseHeader: string;
  fieldWiseBody: string;
  fieldWiseEmail: string;
  fieldWiseEmailPh: string;
  fieldEmailInvalid: string;
  fieldTaxStatus: string;
  taxOptionKleinunt: string;
  taxOptionRegel: string;
  taxOptionUnknown: string;
  invoiceCheckMain: string;
  invoiceCheckHint: string;
  agreementCheckBefore: string;
  agreementCheckLink: string;
  agreementCheckAfter: (version: string) => string;
  agreementCheckHint: (pct: number, months: number, streamWord: string) => string;
  payoutSavingBtn: string;
  payoutSubmitBtn: string;
  payoutErrorFallback: string;
  payoutConsent: string;

  // Live step
  liveTitle: { plain: string; italic: string };
  liveLede: string;
  liveLinkEyebrow: string;
  copy: string;
  copied: string;
  shareLinkBtn: string;
  liveCaptionEyebrow: string;
  liveCaptionTagShort: string;
  liveCaptionTagLong: string;
  liveCaptionShort: (brandName: string, url: string) => string;
  liveCaptionLong: (brandName: string, url: string) => string;
  liveCaptionLegal: string;
  liveResourceMeta: string;
  liveShareEyebrow: string;
  liveShareBio: string;
  liveShareStory: string;
  liveShareCaption: string;
  liveCtaDashboard: string;
  liveFooterMail: (email: string) => string;

  // Status
  statusAlreadyActive: string;
  statusExpiredTitle: { plain: string; italic: string };
  statusExpiredLede: string;
  statusLoading: { italic: string };

  // Misc
  streamWordSub: string;
  streamWordPerSale: string;
  monatlichSuffix: string;
  cohortSuffix: string;

  // Country options
  countryDE: string;
  countryAT: string;
  countryCH: string;
  countryNL: string;
  countryFR: string;
  countryIT: string;
  countryES: string;
  countryOTHER: string;

  // Slider helpers
  followerHint: string;
  pmSuffix: string;
  perInstallCohort: string;

  // Calculator stream-2 notes
  calcS2NoteYarn: (shoppers: string, basket: number, ratePct: string) => string;
  calcS2NoteAlbum: (buyers: string, basket: number, ratePct: string) => string;
  calcS2HintYarn: string;
  calcS2HintAlbum: string;
}

const de: Messages = {
  brandSubline: "Klar Affiliate",
  stepShort: "Step",

  stepWelcome: "Willkommen",
  stepTracking: "Tracking",
  stepPayout: "Auszahlung",
  stepLive: "Live",

  next: "Weiter",
  back: "Zurück",
  backAria: "Zurück",

  welcomeGreet: (handle) => `Hi ${handle},`,
  welcomeLede: (brandName) => `Willkommen im ${brandName} Affiliate-Programm. Vier kurze Schritte, dann ist dein Tracking-Link live.`,
  welcomeEyebrowStreams: "So verdienst du",
  welcomeTitleTwoStreams: { plain: "Zwei Einkommens-", italic: "Ströme." },
  welcomeTitleOneStream: { plain: "Dein ", italic: "Einkommens-Strom." },
  welcomeEyebrowCalc: "Rechne selbst",
  welcomeTitleCalc: { plain: "Was springt für dich ", italic: "raus?" },
  welcomeCalcSubline: "Schieb die Regler auf realistische Werte für deine Audience. Die Rechnung passt sich live an.",

  welcomeFreshNote: "Die App ist noch jung, und genau deshalb fahren wir für die ersten Creator richtig starke Konditionen, statt mit Reichweite zu protzen.",
  dealEyebrow: "Dein Deal",
  dealTitle: { plain: "Warum sich das ", italic: "lohnt." },
  dealBaseYears: (years) => `Mindestens ${years} Jahre Provision auf jeden Premium-Kauf über deinen Link.`,
  dealLadder: (t1, m1, t2) =>
    `Bei ${t1.toLocaleString("de-DE")} € Umsatz werden ${Math.round(m1 / 12)} Jahre draus, bei ${t2.toLocaleString("de-DE")} € wird es Lifetime. Klingt viel, summiert sich aber schneller als gedacht, weil jedes Abo monatlich nachläuft. Du setzt den Link nur einmal.`,
  dealCommission: (pct) => `${pct} % von jedem Premium-Kauf, monatlich per Wise ausgezahlt.`,
  dealGoodie: "Kleines Goodie: gratis Lifetime-Premium für dich.",
  setupEyebrow: "Dein Setup",
  setupTitle: { plain: "So einfach ", italic: "läufts." },
  setupLink: "Eigener Smart-Link: schickt deine Leute per Smart-Label direkt in die App. Kein Code zum Eingeben, die Zuordnung läuft automatisch im Hintergrund.",
  setupDashboard: "Eigenes Dashboard: dein kompletter Funnel von Klick über Install bis Auszahlung, live.",
  setupDrive: "Tiefer einlesen? Im Creator-Drive findest du Strategie-Vorschläge plus eine Erklärung von Tech-Stack und Geschäftsmodell, damit du genau weißt, was du bewirbst.",

  streamEyebrowSub: "Premium-Abos",
  streamEyebrowOneShot: "Premium-Verkäufe",
  streamTitleSubTail: "der Sub.",
  streamTitleOneShotTail: "pro Verkauf.",
  streamDetailSub: (pct, months, price) => `Pro Premium-Kauf bekommst du ${pct} % der Sub-Einnahmen, ${months} Monate lang. Sub-Preis ${price}.`,
  streamDetailOneShot: (pct, months, price) => `Pro Premium-Verkauf bekommst du ${pct} % des Verkaufspreises. Preis ${price}. ${months} Monate Cookie-Window.`,
  streamTitleYarn: { plain: "Anteil an ", italic: "Garn-Käufen." },
  streamTitleAlbum: { plain: "Anteil an ", italic: "Album-Käufen." },
  streamDetailYarn: "Jedes Mal wenn dein User Garn über die In-App Shop-Links kauft, bekommst du einen Anteil an unserer Awin-Provision. Bei Strick-Audiences meist der größere Stream, weil Stricker:innen regelmäßig nachkaufen.",
  streamDetailAlbum: "Wenn dein User ein 4k-Album kauft, bekommst du 50 % des Verkaufspreises. One-Shot, ideal für Event-Trigger wie Hochzeiten oder Festivals.",

  calcViewsLabel: "Views pro Monat · alle Posts zusammen",
  calcViewsAria: "Views pro Monat",
  calcStreamLabel: (label) => `STREAM · ${label}`,
  calcSubSummary: (price, pct, months) => `${price} · ${pct} % an dich, ${months} Monate lang.`,
  calcOneShotSummary: (price, pct) => `${price} · ${pct} % an dich pro Verkauf.`,
  calcConvLabel: "Premium-Conversion nach Install",
  calcConvAria: "Premium-Conversion",
  calcMiniBioClicks: (ctrPct) => `Bio-Klicks (Annahme ${ctrPct} % der Views)`,
  calcMiniInstalls: (installPct) => `Installs (Annahme ${installPct} % der Klicks)`,
  calcMiniBuyers: (convPct) => `Premium-Käufer (${convPct} % Conv)`,
  calcMiniS2Recurring: "Stream 2 pro Monat",
  calcMiniS2OneShot: "Stream 2 pro Install-Cohort",
  calcTotalLabelSub: "monatlich an dich",
  calcTotalLabelSubTwoStreams: "Gesamt monatlich an dich",
  calcTotalLabelOneShot: "pro Cohort an dich",
  calcTotalLabelOneShotTwoStreams: "Gesamt pro Cohort",
  calcTotalLabelMonthsHint: (months) => `${months} Monate lang`,
  calcTotalSubStreams: "Stream 1 + Stream 2",
  calcOneShotHint: "One-Shot Premium-Verkauf",
  calcLifetimeHint: (months, total) => `Lifetime pro Install-Cohort (× ${months} Monate): ${total}`,
  calcSliderRateLabel: (label) => label,
  calcSliderBasketLabel: (label) => label,
  calcSlash: "/ mo",
  calcSlashAria: "pro Monat",

  trackingTitle: { plain: "So funktioniert ", italic: "das Tracking." },
  trackingLede: "Selbst-attributiert, kein zusätzlicher Tracker auf deiner Seite nötig. Dein Link erkennt dich automatisch wieder, der Rest passiert serverseitig bei uns.",
  trackingProtectionEyebrow: "Schutz-Mechanismen",
  trackingProtection1: "Self-Referral-Block: dein eigener Account zählt nicht",
  trackingProtection2: "Refund-Window 30 Tage, danach ist die Provision sicher",
  trackingProtection3: "IP- und Device-Fingerprint gegen Fraud-Bursts",
  trackingProtection4: "Cookie-loses Fallback per Install-Receipt für iOS 14+",
  trackingAdEyebrow: "Werbekennzeichnung",
  trackingAdBody: "Markiere Affiliate-Content immer als Werbung oder Anzeige. Bei Stories reicht der Sticker, bei Reels und Posts gehört es in die ersten Zeilen der Caption. Das schützt dich und uns.",
  trackingDiagramCaption: "Vier Stationen, ein Link. 30 Tage Refund-Holdback nach jedem Kauf, danach landet dein Anteil per Wise auf deinem Konto.",
  diagramStep1Caption: "Du teilst den Link.",
  diagramStep2Caption: "Sie installieren.",
  diagramStep3Caption: "Sie kaufen Premium.",
  diagramStep4Caption: "Du wirst ausgezahlt.",
  diagramRefundLabel: "60 d",
  diagramRedirectLabel: "deeplink",
  diagramReleaseLabel: "30 d",

  payoutTitle: { plain: "Wohin geht ", italic: "das Geld?" },
  payoutLede: "Wir zahlen monatlich aus, sobald 50 € erreicht sind. Beträge darunter laufen in den nächsten Monatslauf. Daten kannst du jederzeit im Dashboard ändern.",
  fieldDisplayName: "Anzeigename auf der Rechnung",
  fieldDisplayNamePh: "Molly Hartmann",
  fieldCountry: "Land der Steuerpflicht",
  fieldCountryPlaceholder: "Bitte wählen",
  fieldWiseHeader: "Auszahlung via Wise",
  fieldWiseBody: "Wir zahlen aktuell ausschließlich über Wise aus. Du brauchst nur eine E-Mail, die mit deinem Wise-Konto verknüpft ist. Wise leitet das Geld in deine Lokalwährung weiter.",
  fieldWiseEmail: "E-Mail deines Wise-Kontos",
  fieldWiseEmailPh: "pay@molly.studio",
  fieldEmailInvalid: "Bitte gib eine vollständige E-Mail-Adresse ein, die mit deinem Wise-Konto verknüpft ist.",
  fieldTaxStatus: "Steuerstatus",
  taxOptionKleinunt: "Kleinunternehmer, keine MwSt",
  taxOptionRegel: "Regelbesteuert, mit MwSt",
  taxOptionUnknown: "Privatperson, ohne Gewerbe",
  invoiceCheckMain: "Ich kann eine Rechnung mit ausgewiesener MwSt ausstellen.",
  invoiceCheckHint: "Falls nicht, übernehmen wir die Gutschrift automatisch für dich.",
  agreementCheckBefore: "Ich akzeptiere die ",
  agreementCheckLink: "Affiliate-Bedingungen",
  agreementCheckAfter: (version) => ` der Version ${version}.`,
  agreementCheckHint: (pct, months, streamWord) => `${pct} % ${streamWord}, ${months} Monate Attribution, 30 Tage Refund-Holdback, monatliche Auszahlung ab 50 €. IP und Zeitstempel werden für den Audit-Trail gespeichert.`,
  payoutSavingBtn: "Speichere…",
  payoutSubmitBtn: "Affiliate-Setup abschließen",
  payoutErrorFallback: "Setup fehlgeschlagen, bitte erneut versuchen.",
  payoutConsent: "Mit Klick auf abschließen bestätigst du, dass die Angaben korrekt sind und du die Affiliate-Bedingungen inklusive der Datenschutz-Hinweise in §05 gelesen hast. Du kannst jederzeit kündigen, ausstehende Provisionen verfallen nicht.",

  liveTitle: { plain: "Du bist ", italic: "live ✓" },
  liveLede: "Dein persönlicher Tracking-Link ist scharf. Erste Klicks tauchen innerhalb von 5 Minuten im Dashboard auf. Du brauchst keinen Code, der Link macht alles.",
  liveLinkEyebrow: "Dein Tracking-Link",
  copy: "Kopieren",
  copied: "Kopiert",
  shareLinkBtn: "Link teilen",
  liveCaptionEyebrow: "Werbe-Caption · zum Kopieren",
  liveCaptionTagShort: "Story / Bio",
  liveCaptionTagLong: "Reel / Post",
  liveCaptionShort: (brandName, url) => `Werbung · ${brandName} App, Link in der Bio. ${url}`,
  liveCaptionLong: (brandName, url) => `Werbung · Ich nutze ${brandName} seit ein paar Wochen und mag, wie viel Alltag mir das spart. Wenn du es testen willst: ${url}`,
  liveCaptionLegal: "Werbung oder Anzeige gehört in die ersten Zeilen, dann ist die UWG-Kennzeichnung sauber. Restlichen Text gerne in deinen Voice umschreiben.",
  liveResourceMeta: "Google Drive · Logos, Screenshots, Playbook-PDF",
  liveShareEyebrow: "So teilst du",
  liveShareBio: "Bio-Link: Setze den Link direkt in deine Instagram- oder TikTok-Bio. Beide Plattformen akzeptieren den Link ohne Redirect.",
  liveShareStory: "Stories & Reels: Link-Sticker drauf, Sprachnotiz dazu, fertig. Werbekennzeichnung nicht vergessen.",
  liveShareCaption: "Captions: Pack den Link auch in die Caption, falls jemand nicht auf die Bio scrollt. Tracking läuft pro Klick, nicht pro Code.",
  liveCtaDashboard: "Zu deinem Affiliate-Dashboard",
  liveFooterMail: (email) => `Bestätigung an ${email || "deine E-Mail"} ist unterwegs. Fragen?`,

  statusAlreadyActive: "Du bist bereits als Affiliate eingerichtet. Bei Fragen: alain@getklar.org",
  statusExpiredTitle: { plain: "Link ", italic: "abgelaufen" },
  statusExpiredLede: "Dein Onboarding-Link ist abgelaufen oder ungültig. Schreib uns kurz an alain@getklar.org, wir erneuern ihn.",
  statusLoading: { italic: "Lade …" },

  streamWordSub: "Sub-Anteil",
  streamWordPerSale: "Anteil",
  monatlichSuffix: "monatlich",
  cohortSuffix: "pro Cohort",

  countryDE: "Deutschland",
  countryAT: "Österreich",
  countryCH: "Schweiz",
  countryNL: "Niederlande",
  countryFR: "Frankreich",
  countryIT: "Italien",
  countryES: "Spanien",
  countryOTHER: "Anderes EU-Land",

  followerHint: "",
  pmSuffix: "pro Monat",
  perInstallCohort: "pro Install-Cohort",

  calcS2NoteYarn: (shoppers, basket, ratePct) => `${shoppers} aktive Garn-Käufer × ${basket} € Korb × ${ratePct} %`,
  calcS2NoteAlbum: (buyers, basket, ratePct) => `${buyers} Album-Käufer × ${basket} € × ${ratePct} %`,
  calcS2HintYarn: "7,5 % Shop-Provision × 50 % Affiliate-Anteil = 3,75 % vom Korb",
  calcS2HintAlbum: "Einmalverkauf, 50 % Anteil pro Album",
};

const es: Messages = {
  brandSubline: "Klar Affiliate",
  stepShort: "Paso",

  stepWelcome: "Bienvenida",
  stepTracking: "Tracking",
  stepPayout: "Cobros",
  stepLive: "En vivo",

  next: "Siguiente",
  back: "Atrás",
  backAria: "Atrás",

  welcomeGreet: (handle) => `Hola ${handle},`,
  welcomeLede: (brandName) => `Bienvenida al programa de afiliados de ${brandName}. Cuatro pasos cortos y tu enlace de tracking estará activo.`,
  welcomeEyebrowStreams: "Así ganas",
  welcomeTitleTwoStreams: { plain: "Dos fuentes de ", italic: "ingresos." },
  welcomeTitleOneStream: { plain: "Tu fuente de ", italic: "ingresos." },
  welcomeEyebrowCalc: "Calcula tú mismo",
  welcomeTitleCalc: { plain: "¿Cuánto te ", italic: "queda?" },
  welcomeCalcSubline: "Mueve los sliders a valores realistas para tu audiencia. El cálculo se actualiza en directo.",

  streamEyebrowSub: "Suscripciones Premium",
  streamEyebrowOneShot: "Ventas Premium",
  streamTitleSubTail: "de la sub.",
  streamTitleOneShotTail: "por venta.",
  streamDetailSub: (pct, months, price) => `Por cada compra Premium recibes el ${pct} % de los ingresos de la suscripción, durante ${months} meses. Precio de la sub ${price}.`,
  streamDetailOneShot: (pct, months, price) => `Por cada venta Premium recibes el ${pct} % del precio. Precio ${price}. Ventana de cookie de ${months} meses.`,
  streamTitleYarn: { plain: "Comisión por ", italic: "compras de lana." },
  streamTitleAlbum: { plain: "Comisión por ", italic: "compras de álbum." },
  streamDetailYarn: "Cada vez que tu usuaria compra lana a través de los enlaces de la tienda integrada en la app, recibes una parte de nuestra comisión Awin. En audiencias tejedoras suele ser el stream más grande, porque las tejedoras recompran constantemente.",
  streamDetailAlbum: "Si tu usuario compra un álbum 4k, recibes el 50 % del precio. Una sola vez, ideal para momentos como bodas o festivales.",

  calcViewsLabel: "Views al mes · todos los posts juntos",
  calcViewsAria: "Views al mes",
  calcStreamLabel: (label) => `STREAM · ${label}`,
  calcSubSummary: (price, pct, months) => `${price} · ${pct} % para ti, durante ${months} meses.`,
  calcOneShotSummary: (price, pct) => `${price} · ${pct} % para ti por venta.`,
  calcConvLabel: "Conversión a Premium tras instalar",
  calcConvAria: "Conversión a Premium",
  calcMiniBioClicks: (ctrPct) => `Clicks en bio (supuesto ${ctrPct} % de las views)`,
  calcMiniInstalls: (installPct) => `Instalaciones (supuesto ${installPct} % de los clicks)`,
  calcMiniBuyers: (convPct) => `Compradores Premium (${convPct} % Conv)`,
  calcMiniS2Recurring: "Stream 2 al mes",
  calcMiniS2OneShot: "Stream 2 por cohorte de instalaciones",
  calcTotalLabelSub: "al mes para ti",
  calcTotalLabelSubTwoStreams: "Total al mes para ti",
  calcTotalLabelOneShot: "por cohorte para ti",
  calcTotalLabelOneShotTwoStreams: "Total por cohorte",
  calcTotalLabelMonthsHint: (months) => `durante ${months} meses`,
  calcTotalSubStreams: "Stream 1 + Stream 2",
  calcOneShotHint: "Venta Premium puntual",
  calcLifetimeHint: (months, total) => `Lifetime por cohorte (× ${months} meses): ${total}`,
  calcSliderRateLabel: (label) => label,
  calcSliderBasketLabel: (label) => label,
  calcSlash: "/ mes",
  calcSlashAria: "al mes",

  trackingTitle: { plain: "Cómo funciona ", italic: "el tracking." },
  trackingLede: "Auto-atribuido, no necesitas ningún tracker extra en tu lado. Tu enlace te reconoce automáticamente, el resto pasa en nuestro servidor.",
  trackingProtectionEyebrow: "Mecanismos de protección",
  trackingProtection1: "Bloqueo de auto-referencia: tu propia cuenta no cuenta",
  trackingProtection2: "Ventana de reembolso de 30 días, después la comisión está asegurada",
  trackingProtection3: "Huella de IP y dispositivo contra ráfagas de fraude",
  trackingProtection4: "Fallback sin cookies vía install-receipt para iOS 14+",
  trackingAdEyebrow: "Identificación como publicidad",
  trackingAdBody: "Marca siempre el contenido de afiliado como Publicidad o Anuncio. En stories basta con el sticker, en Reels y posts debe estar en las primeras líneas de la caption. Te protege a ti y a nosotros.",
  trackingDiagramCaption: "Cuatro estaciones, un enlace. 30 días de retención por reembolso tras cada compra, después tu parte llega a tu cuenta vía Wise.",
  diagramStep1Caption: "Compartes el enlace.",
  diagramStep2Caption: "Ellas instalan.",
  diagramStep3Caption: "Compran Premium.",
  diagramStep4Caption: "Te pagamos.",
  diagramRefundLabel: "60 d",
  diagramRedirectLabel: "deeplink",
  diagramReleaseLabel: "30 d",

  payoutTitle: { plain: "¿Adónde va ", italic: "el dinero?" },
  payoutLede: "Pagamos mensualmente en cuanto alcanzas los 50 €. Los importes inferiores pasan al siguiente mes. Puedes cambiar tus datos en cualquier momento desde el dashboard.",
  fieldDisplayName: "Nombre en la factura",
  fieldDisplayNamePh: "Molly Hartmann",
  fieldCountry: "País fiscal",
  fieldCountryPlaceholder: "Selecciona uno",
  fieldWiseHeader: "Cobro vía Wise",
  fieldWiseBody: "Actualmente pagamos exclusivamente vía Wise. Solo necesitas un email vinculado a tu cuenta Wise. Wise reenvía el dinero a tu moneda local.",
  fieldWiseEmail: "Email de tu cuenta Wise",
  fieldWiseEmailPh: "pay@molly.studio",
  fieldEmailInvalid: "Por favor, introduce un email completo y vinculado a tu cuenta Wise.",
  fieldTaxStatus: "Situación fiscal",
  taxOptionKleinunt: "Régimen simplificado, sin IVA",
  taxOptionRegel: "Régimen general, con IVA",
  taxOptionUnknown: "Persona privada, sin actividad",
  invoiceCheckMain: "Puedo emitir una factura con IVA declarado.",
  invoiceCheckHint: "Si no, generamos automáticamente la nota de abono.",
  agreementCheckBefore: "Acepto las ",
  agreementCheckLink: "Condiciones de Afiliado",
  agreementCheckAfter: (version) => ` de la versión ${version}.`,
  agreementCheckHint: (pct, months, streamWord) => `${pct} % ${streamWord}, ${months} meses de atribución, 30 días de retención por reembolso, pago mensual a partir de 50 €. IP y timestamp se guardan para el audit-trail.`,
  payoutSavingBtn: "Guardando…",
  payoutSubmitBtn: "Completar setup de afiliada",
  payoutErrorFallback: "Setup fallido, por favor inténtalo de nuevo.",
  payoutConsent: "Al hacer clic en completar confirmas que los datos son correctos y que has leído las Condiciones de Afiliado incluida la información sobre protección de datos en §05. Puedes cancelar en cualquier momento, las comisiones pendientes no caducan.",

  liveTitle: { plain: "Ya estás ", italic: "en vivo ✓" },
  liveLede: "Tu enlace de tracking personal está activo. Los primeros clicks aparecen en el dashboard en menos de 5 minutos. No necesitas código, el enlace hace todo.",
  liveLinkEyebrow: "Tu enlace de tracking",
  copy: "Copiar",
  copied: "Copiado",
  shareLinkBtn: "Compartir enlace",
  liveCaptionEyebrow: "Caption de afiliado · para copiar",
  liveCaptionTagShort: "Story / Bio",
  liveCaptionTagLong: "Reel / Post",
  liveCaptionShort: (brandName, url) => `Publi · App ${brandName}, enlace en la bio. ${url}`,
  liveCaptionLong: (brandName, url) => `Publi · Llevo unas semanas usando ${brandName} y me encanta lo mucho que me ahorra. Si quieres probarlo: ${url}`,
  liveCaptionLegal: "Publicidad o Anuncio debe ir en las primeras líneas, así la identificación es limpia. El resto del texto adáptalo a tu voz.",
  liveResourceMeta: "Google Drive · Logos, Screenshots, Playbook-PDF",
  liveShareEyebrow: "Cómo compartirlo",
  liveShareBio: "Enlace en bio: Pon el enlace directamente en tu bio de Instagram o TikTok. Ambas plataformas lo aceptan sin redirect.",
  liveShareStory: "Stories y Reels: Sticker de enlace, audio explicando, listo. Sin olvidar marcarlo como publi.",
  liveShareCaption: "Captions: Mete también el enlace en la caption, por si alguien no scrollea a la bio. El tracking va por click, no por código.",
  liveCtaDashboard: "A tu dashboard de afiliada",
  liveFooterMail: (email) => `Confirmación a ${email || "tu email"} en camino. ¿Dudas?`,

  statusAlreadyActive: "Ya estás registrada como afiliada. Si tienes dudas: alain@getklar.org",
  statusExpiredTitle: { plain: "Enlace ", italic: "caducado" },
  statusExpiredLede: "Tu enlace de onboarding ha caducado o no es válido. Escríbenos a alain@getklar.org y te lo renovamos.",
  statusLoading: { italic: "Cargando …" },

  streamWordSub: "parte de la sub",
  streamWordPerSale: "parte",
  monatlichSuffix: "mensual",
  cohortSuffix: "por cohorte",

  countryDE: "Alemania",
  countryAT: "Austria",
  countryCH: "Suiza",
  countryNL: "Países Bajos",
  countryFR: "Francia",
  countryIT: "Italia",
  countryES: "España",
  countryOTHER: "Otro país UE",

  followerHint: "",
  pmSuffix: "al mes",
  perInstallCohort: "por cohorte de instalación",

  calcS2NoteYarn: (shoppers, basket, ratePct) => `${shoppers} compradoras activas de lana × ${basket} € cesta × ${ratePct} %`,
  calcS2NoteAlbum: (buyers, basket, ratePct) => `${buyers} compradores de álbum × ${basket} € × ${ratePct} %`,
  calcS2HintYarn: "7,5 % de comisión de tienda × 50 % parte afiliada = 3,75 % de la cesta",
  calcS2HintAlbum: "Venta única, 50 % de comisión por álbum",
};

const en: Messages = {
  brandSubline: "Klar Affiliate",
  stepShort: "Step",

  stepWelcome: "Welcome",
  stepTracking: "Tracking",
  stepPayout: "Payout",
  stepLive: "Live",
  stepSign: "Sign",

  next: "Next",
  back: "Back",
  backAria: "Back",

  welcomeGreet: (handle) => `Hi ${handle},`,
  welcomeLede: (brandName) => `Welcome to the ${brandName} Affiliate Program. Four short steps and your tracking link is live.`,
  welcomeEyebrowStreams: "How you earn",
  welcomeTitleTwoStreams: { plain: "Two ", italic: "revenue streams." },
  welcomeTitleOneStream: { plain: "Your ", italic: "revenue stream." },
  welcomeEyebrowCalc: "Run the numbers",
  welcomeTitleCalc: { plain: "What's in it ", italic: "for you?" },
  welcomeCalcSubline: "Drag the sliders to realistic values for your audience. The math updates live.",

  streamEyebrowSub: "Premium subs",
  streamEyebrowOneShot: "Premium sales",
  streamTitleSubTail: "of the sub.",
  streamTitleOneShotTail: "per sale.",
  streamDetailSub: (pct, months, price) => `For every Premium purchase you get ${pct} % of the sub revenue, for ${months} months. Sub price ${price}.`,
  streamDetailOneShot: (pct, months, price) => `For every Premium sale you get ${pct} % of the sale price. Price ${price}. ${months}-month cookie window.`,
  streamTitleYarn: { plain: "Share on ", italic: "yarn purchases." },
  streamTitleAlbum: { plain: "Share on ", italic: "album purchases." },
  streamDetailYarn: "Every time your user buys yarn through the in-app shop links, you get a share of our Awin commission. With knit audiences usually the bigger stream, because knitters keep re-stocking.",
  streamDetailAlbum: "If your user buys a 4k album, you get 50 % of the sale price. One-shot, perfect for event triggers like weddings or festivals.",

  calcViewsLabel: "Views per month · all posts combined",
  calcViewsAria: "Views per month",
  calcStreamLabel: (label) => `STREAM · ${label}`,
  calcSubSummary: (price, pct, months) => `${price} · ${pct} % to you, for ${months} months.`,
  calcOneShotSummary: (price, pct) => `${price} · ${pct} % to you per sale.`,
  calcConvLabel: "Premium conversion after install",
  calcConvAria: "Premium conversion",
  calcMiniBioClicks: (ctrPct) => `Bio clicks (assumed ${ctrPct} % of views)`,
  calcMiniInstalls: (installPct) => `Installs (assumed ${installPct} % of clicks)`,
  calcMiniBuyers: (convPct) => `Premium buyers (${convPct} % conv)`,
  calcMiniS2Recurring: "Stream 2 per month",
  calcMiniS2OneShot: "Stream 2 per install cohort",
  calcTotalLabelSub: "monthly to you",
  calcTotalLabelSubTwoStreams: "Total monthly to you",
  calcTotalLabelOneShot: "per cohort to you",
  calcTotalLabelOneShotTwoStreams: "Total per cohort",
  calcTotalLabelMonthsHint: (months) => `for ${months} months`,
  calcTotalSubStreams: "Stream 1 + Stream 2",
  calcOneShotHint: "One-shot Premium sale",
  calcLifetimeHint: (months, total) => `Lifetime per install cohort (× ${months} months): ${total}`,
  calcSliderRateLabel: (label) => label,
  calcSliderBasketLabel: (label) => label,
  calcSlash: "/ mo",
  calcSlashAria: "per month",

  trackingTitle: { plain: "How the ", italic: "tracking works." },
  trackingLede: "Self-attributed, no extra tracker needed on your side. Your link recognises you automatically, the rest happens server-side on our end.",
  trackingProtectionEyebrow: "Protection mechanisms",
  trackingProtection1: "Self-referral block: your own account doesn't count",
  trackingProtection2: "30-day refund window, after that the commission is safe",
  trackingProtection3: "IP and device fingerprint against fraud bursts",
  trackingProtection4: "Cookie-less fallback via install receipt for iOS 14+",
  trackingAdEyebrow: "Ad disclosure",
  trackingAdBody: "Always mark affiliate content as Ad or Sponsored. For stories the sticker is enough, for Reels and posts it goes in the first lines of the caption. Protects you and us.",
  trackingDiagramCaption: "Four stations, one link. 30-day refund holdback after each purchase, then your share lands in your account via Wise.",
  diagramStep1Caption: "You share the link.",
  diagramStep2Caption: "They install.",
  diagramStep3Caption: "They buy Premium.",
  diagramStep4Caption: "You get paid.",
  diagramRefundLabel: "60 d",
  diagramRedirectLabel: "deeplink",
  diagramReleaseLabel: "30 d",

  payoutTitle: { plain: "Where does ", italic: "the money go?" },
  payoutLede: "We pay out monthly as soon as you hit 50 €. Smaller amounts roll into the next monthly run. You can change your details from the dashboard any time.",
  fieldDisplayName: "Name shown on the invoice",
  fieldDisplayNamePh: "Molly Hartmann",
  fieldCountry: "Tax country",
  fieldCountryPlaceholder: "Please choose",
  fieldWiseHeader: "Payout via Wise",
  fieldWiseBody: "We currently pay out exclusively via Wise. You only need an email linked to your Wise account. Wise forwards the money in your local currency.",
  fieldWiseEmail: "Email of your Wise account",
  fieldWiseEmailPh: "pay@molly.studio",
  fieldEmailInvalid: "Please enter a complete email address linked to your Wise account.",
  fieldTaxStatus: "Tax status",
  taxOptionKleinunt: "Small business, no VAT",
  taxOptionRegel: "Regular tax, with VAT",
  taxOptionUnknown: "Private individual, no business",
  invoiceCheckMain: "I can issue an invoice with VAT shown.",
  invoiceCheckHint: "If not, we'll handle the credit note automatically for you.",
  agreementCheckBefore: "I accept the ",
  agreementCheckLink: "Affiliate Terms",
  agreementCheckAfter: (version) => ` of version ${version}.`,
  agreementCheckHint: (pct, months, streamWord) => `${pct} % ${streamWord}, ${months} months attribution, 30-day refund holdback, monthly payout from 50 €. IP and timestamp are stored for the audit trail.`,
  payoutSavingBtn: "Saving…",
  payoutSubmitBtn: "Complete affiliate setup",
  payoutErrorFallback: "Setup failed, please try again.",
  payoutConsent: "By clicking complete you confirm that the details are correct and that you've read the Affiliate Terms including the data-protection notes in §05. You can cancel any time, outstanding commissions don't expire.",

  liveTitle: { plain: "You're ", italic: "live ✓" },
  liveLede: "Your personal tracking link is armed. First clicks show up in the dashboard within 5 minutes. You don't need a code, the link does everything.",
  liveLinkEyebrow: "Your tracking link",
  copy: "Copy",
  copied: "Copied",
  shareLinkBtn: "Share link",
  liveCaptionEyebrow: "Ad caption · ready to copy",
  liveCaptionTagShort: "Story / Bio",
  liveCaptionTagLong: "Reel / Post",
  liveCaptionShort: (brandName, url) => `Ad · ${brandName} app, link in bio. ${url}`,
  liveCaptionLong: (brandName, url) => `Ad · I've been using ${brandName} for a few weeks and love how much it saves me every day. Want to try it: ${url}`,
  liveCaptionLegal: "Ad or Sponsored belongs in the first lines, that keeps the disclosure clean. Rewrite the rest in your own voice.",
  liveResourceMeta: "Google Drive · logos, screenshots, playbook PDF",
  liveShareEyebrow: "How to share",
  liveShareBio: "Bio link: drop the link directly into your Instagram or TikTok bio. Both platforms accept it without redirect.",
  liveShareStory: "Stories & Reels: link sticker on, voice note with it, done. Don't forget the ad disclosure.",
  liveShareCaption: "Captions: also put the link in the caption in case someone doesn't scroll to bio. Tracking runs per click, not per code.",
  liveCtaDashboard: "Go to your affiliate dashboard",
  liveFooterMail: (email) => `Confirmation to ${email || "your email"} is on the way. Questions?`,

  statusAlreadyActive: "You're already set up as an affiliate. Questions: alain@getklar.org",
  statusExpiredTitle: { plain: "Link ", italic: "expired" },
  statusExpiredLede: "Your onboarding link has expired or is invalid. Drop us a line at alain@getklar.org, we'll renew it.",
  statusLoading: { italic: "Loading …" },

  streamWordSub: "sub share",
  streamWordPerSale: "share",
  monatlichSuffix: "monthly",
  cohortSuffix: "per cohort",

  countryDE: "Germany",
  countryAT: "Austria",
  countryCH: "Switzerland",
  countryNL: "Netherlands",
  countryFR: "France",
  countryIT: "Italy",
  countryES: "Spain",
  countryOTHER: "Other EU country",

  followerHint: "",
  pmSuffix: "per month",
  perInstallCohort: "per install cohort",

  calcS2NoteYarn: (shoppers, basket, ratePct) => `${shoppers} active yarn buyers × ${basket} € basket × ${ratePct} %`,
  calcS2NoteAlbum: (buyers, basket, ratePct) => `${buyers} album buyers × ${basket} € × ${ratePct} %`,
  calcS2HintYarn: "7.5 % shop commission × 50 % affiliate share = 3.75 % of the basket",
  calcS2HintAlbum: "One-off sale, 50 % share per album",
};

const it: Messages = {
  brandSubline: "Klar Affiliate",
  stepShort: "Passo",

  stepWelcome: "Benvenuta",
  stepTracking: "Tracking",
  stepPayout: "Pagamenti",
  stepLive: "Live",

  next: "Avanti",
  back: "Indietro",
  backAria: "Indietro",

  welcomeGreet: (handle) => `Ciao ${handle},`,
  welcomeLede: (brandName) => `Benvenuta nel programma di affiliazione ${brandName}. Quattro passi brevi e il tuo link di tracking è live.`,
  welcomeEyebrowStreams: "Come guadagni",
  welcomeTitleTwoStreams: { plain: "Due fonti di ", italic: "guadagno." },
  welcomeTitleOneStream: { plain: "La tua fonte di ", italic: "guadagno." },
  welcomeEyebrowCalc: "Calcola tu stessa",
  welcomeTitleCalc: { plain: "Quanto ti ", italic: "resta?" },
  welcomeCalcSubline: "Sposta gli slider su valori realistici per la tua audience. Il calcolo si aggiorna in diretta.",

  streamEyebrowSub: "Abbonamenti Premium",
  streamEyebrowOneShot: "Vendite Premium",
  streamTitleSubTail: "dell'abbonamento.",
  streamTitleOneShotTail: "a vendita.",
  streamDetailSub: (pct, months, price) => `Per ogni acquisto Premium ricevi il ${pct} % delle entrate dell'abbonamento, per ${months} mesi. Prezzo abbonamento ${price}.`,
  streamDetailOneShot: (pct, months, price) => `Per ogni vendita Premium ricevi il ${pct} % del prezzo di vendita. Prezzo ${price}. Finestra cookie di ${months} mesi.`,
  streamTitleYarn: { plain: "Quota sugli ", italic: "acquisti di filato." },
  streamTitleAlbum: { plain: "Quota sugli ", italic: "acquisti di album." },
  streamDetailYarn: "Ogni volta che la tua utente compra filato tramite i link dello shop in-app, ricevi una quota della nostra commissione Awin. Con audience di maglia di solito è lo stream più grosso, perché chi lavora a maglia ricompra spesso.",
  streamDetailAlbum: "Se il tuo utente compra un album 4k, ricevi il 50 % del prezzo di vendita. Una tantum, ideale per momenti come matrimoni o festival.",

  calcViewsLabel: "Views al mese · tutti i post insieme",
  calcViewsAria: "Views al mese",
  calcStreamLabel: (label) => `STREAM · ${label}`,
  calcSubSummary: (price, pct, months) => `${price} · ${pct} % a te, per ${months} mesi.`,
  calcOneShotSummary: (price, pct) => `${price} · ${pct} % a te per vendita.`,
  calcConvLabel: "Conversione a Premium dopo l'install",
  calcConvAria: "Conversione a Premium",
  calcMiniBioClicks: (ctrPct) => `Click sulla bio (ipotesi ${ctrPct} % delle views)`,
  calcMiniInstalls: (installPct) => `Installazioni (ipotesi ${installPct} % dei click)`,
  calcMiniBuyers: (convPct) => `Acquirenti Premium (${convPct} % conv)`,
  calcMiniS2Recurring: "Stream 2 al mese",
  calcMiniS2OneShot: "Stream 2 per coorte di install",
  calcTotalLabelSub: "al mese a te",
  calcTotalLabelSubTwoStreams: "Totale al mese a te",
  calcTotalLabelOneShot: "per coorte a te",
  calcTotalLabelOneShotTwoStreams: "Totale per coorte",
  calcTotalLabelMonthsHint: (months) => `per ${months} mesi`,
  calcTotalSubStreams: "Stream 1 + Stream 2",
  calcOneShotHint: "Vendita Premium una tantum",
  calcLifetimeHint: (months, total) => `Lifetime per coorte di install (× ${months} mesi): ${total}`,
  calcSliderRateLabel: (label) => label,
  calcSliderBasketLabel: (label) => label,
  calcSlash: "/ mese",
  calcSlashAria: "al mese",

  trackingTitle: { plain: "Come funziona ", italic: "il tracking." },
  trackingLede: "Auto-attribuito, non serve nessun tracker extra dalla tua parte. Il tuo link ti riconosce in automatico, il resto succede sul nostro server.",
  trackingProtectionEyebrow: "Meccanismi di protezione",
  trackingProtection1: "Blocco auto-referral: il tuo account non conta",
  trackingProtection2: "Finestra di rimborso di 30 giorni, dopo la commissione è sicura",
  trackingProtection3: "Impronta IP e device contro le ondate di frode",
  trackingProtection4: "Fallback senza cookie via install-receipt per iOS 14+",
  trackingAdEyebrow: "Identificazione come pubblicità",
  trackingAdBody: "Marca sempre il contenuto di affiliazione come Pubblicità o Sponsorizzato. Nelle stories basta lo sticker, in Reels e post va nelle prime righe della caption. Protegge te e noi.",
  trackingDiagramCaption: "Quattro stazioni, un link. 30 giorni di trattenuta per rimborso dopo ogni acquisto, poi la tua quota arriva sul tuo conto via Wise.",
  diagramStep1Caption: "Tu condividi il link.",
  diagramStep2Caption: "Loro installano.",
  diagramStep3Caption: "Comprano Premium.",
  diagramStep4Caption: "Vieni pagata.",
  diagramRefundLabel: "60 d",
  diagramRedirectLabel: "deeplink",
  diagramReleaseLabel: "30 d",

  payoutTitle: { plain: "Dove va ", italic: "il denaro?" },
  payoutLede: "Paghiamo ogni mese non appena raggiungi i 50 €. Gli importi inferiori passano al ciclo del mese successivo. Puoi cambiare i dati nella dashboard in qualsiasi momento.",
  fieldDisplayName: "Nome indicato in fattura",
  fieldDisplayNamePh: "Molly Hartmann",
  fieldCountry: "Paese fiscale",
  fieldCountryPlaceholder: "Seleziona",
  fieldWiseHeader: "Pagamento tramite Wise",
  fieldWiseBody: "Al momento paghiamo esclusivamente tramite Wise. Ti serve solo un'email collegata al tuo conto Wise. Wise inoltra il denaro nella tua valuta locale.",
  fieldWiseEmail: "Email del tuo conto Wise",
  fieldWiseEmailPh: "pay@molly.studio",
  fieldEmailInvalid: "Inserisci un'email completa collegata al tuo conto Wise.",
  fieldTaxStatus: "Stato fiscale",
  taxOptionKleinunt: "Regime forfettario, senza IVA",
  taxOptionRegel: "Regime ordinario, con IVA",
  taxOptionUnknown: "Persona privata, senza attività",
  invoiceCheckMain: "Posso emettere una fattura con IVA esposta.",
  invoiceCheckHint: "Se no, generiamo automaticamente la nota di accredito.",
  agreementCheckBefore: "Accetto le ",
  agreementCheckLink: "Condizioni di Affiliazione",
  agreementCheckAfter: (version) => ` della versione ${version}.`,
  agreementCheckHint: (pct, months, streamWord) => `${pct} % ${streamWord}, ${months} mesi di attribuzione, 30 giorni di trattenuta per rimborso, pagamento mensile a partire da 50 €. IP e timestamp vengono salvati per l'audit-trail.`,
  payoutSavingBtn: "Salvataggio…",
  payoutSubmitBtn: "Completa setup di affiliata",
  payoutErrorFallback: "Setup fallito, riprova.",
  payoutConsent: "Cliccando su completa confermi che i dati sono corretti e di aver letto le Condizioni di Affiliazione incluse le informazioni sulla protezione dei dati al §05. Puoi disdire in qualsiasi momento, le commissioni in sospeso non scadono.",

  liveTitle: { plain: "Sei ", italic: "live ✓" },
  liveLede: "Il tuo link di tracking personale è attivo. I primi click compaiono nella dashboard entro 5 minuti. Non ti serve un codice, fa tutto il link.",
  liveLinkEyebrow: "Il tuo link di tracking",
  copy: "Copia",
  copied: "Copiato",
  shareLinkBtn: "Condividi link",
  liveCaptionEyebrow: "Caption di affiliazione · da copiare",
  liveCaptionTagShort: "Story / Bio",
  liveCaptionTagLong: "Reel / Post",
  liveCaptionShort: (brandName, url) => `Pubblicità · App ${brandName}, link in bio. ${url}`,
  liveCaptionLong: (brandName, url) => `Pubblicità · Uso ${brandName} da qualche settimana e mi piace quanto mi semplifica le giornate. Se vuoi provarla: ${url}`,
  liveCaptionLegal: "Pubblicità o Sponsorizzato va nelle prime righe, così l'identificazione è pulita. Il resto del testo riscrivilo con la tua voce.",
  liveResourceMeta: "Google Drive · loghi, screenshot, playbook PDF",
  liveShareEyebrow: "Come condividere",
  liveShareBio: "Link in bio: metti il link direttamente nella tua bio di Instagram o TikTok. Entrambe le piattaforme lo accettano senza redirect.",
  liveShareStory: "Stories e Reels: sticker del link su, audio che spiega, fatto. Non dimenticare di marcarlo come pubblicità.",
  liveShareCaption: "Captions: metti il link anche nella caption, nel caso qualcuno non scorra alla bio. Il tracking va a click, non a codice.",
  liveCtaDashboard: "Alla tua dashboard di affiliata",
  liveFooterMail: (email) => `Conferma a ${email || "la tua email"} in arrivo. Domande?`,

  statusAlreadyActive: "Sei già registrata come affiliata. Per domande: alain@getklar.org",
  statusExpiredTitle: { plain: "Link ", italic: "scaduto" },
  statusExpiredLede: "Il tuo link di onboarding è scaduto o non valido. Scrivici a alain@getklar.org, lo rinnoviamo.",
  statusLoading: { italic: "Caricamento …" },

  streamWordSub: "quota dell'abbonamento",
  streamWordPerSale: "quota",
  monatlichSuffix: "mensile",
  cohortSuffix: "per coorte",

  countryDE: "Germania",
  countryAT: "Austria",
  countryCH: "Svizzera",
  countryNL: "Paesi Bassi",
  countryFR: "Francia",
  countryIT: "Italia",
  countryES: "Spagna",
  countryOTHER: "Altro paese UE",

  followerHint: "",
  pmSuffix: "al mese",
  perInstallCohort: "per coorte di install",

  calcS2NoteYarn: (shoppers, basket, ratePct) => `${shoppers} acquirenti attive di filato × ${basket} € carrello × ${ratePct} %`,
  calcS2NoteAlbum: (buyers, basket, ratePct) => `${buyers} acquirenti di album × ${basket} € × ${ratePct} %`,
  calcS2HintYarn: "7,5 % commissione shop × 50 % quota affiliata = 3,75 % del carrello",
  calcS2HintAlbum: "Vendita una tantum, 50 % di quota per album",
};

const fr: Messages = {
  brandSubline: "Klar Affiliate",
  stepShort: "Étape",

  stepWelcome: "Bienvenue",
  stepTracking: "Tracking",
  stepPayout: "Paiements",
  stepLive: "En ligne",

  next: "Suivant",
  back: "Retour",
  backAria: "Retour",

  welcomeGreet: (handle) => `Salut ${handle},`,
  welcomeLede: (brandName) => `Bienvenue dans le programme d'affiliation ${brandName}. Quatre étapes courtes et ton lien de tracking est en ligne.`,
  welcomeEyebrowStreams: "Comment tu gagnes",
  welcomeTitleTwoStreams: { plain: "Deux sources de ", italic: "revenus." },
  welcomeTitleOneStream: { plain: "Ta source de ", italic: "revenus." },
  welcomeEyebrowCalc: "Fais le calcul",
  welcomeTitleCalc: { plain: "Combien ça te ", italic: "rapporte?" },
  welcomeCalcSubline: "Bouge les sliders sur des valeurs réalistes pour ton audience. Le calcul se met à jour en direct.",

  streamEyebrowSub: "Abonnements Premium",
  streamEyebrowOneShot: "Ventes Premium",
  streamTitleSubTail: "de l'abonnement.",
  streamTitleOneShotTail: "par vente.",
  streamDetailSub: (pct, months, price) => `Pour chaque achat Premium tu reçois ${pct} % des revenus de l'abonnement, pendant ${months} mois. Prix de l'abonnement ${price}.`,
  streamDetailOneShot: (pct, months, price) => `Pour chaque vente Premium tu reçois ${pct} % du prix de vente. Prix ${price}. Fenêtre cookie de ${months} mois.`,
  streamTitleYarn: { plain: "Part sur les ", italic: "achats de laine." },
  streamTitleAlbum: { plain: "Part sur les ", italic: "achats d'album." },
  streamDetailYarn: "À chaque fois que ton utilisatrice achète de la laine via les liens shop de l'app, tu touches une part de notre commission Awin. Sur des audiences tricot, c'est souvent le plus gros stream, parce qu'on rachète tout le temps.",
  streamDetailAlbum: "Si ton utilisateur achète un album 4k, tu reçois 50 % du prix de vente. Une seule fois, parfait pour des moments comme mariages ou festivals.",

  calcViewsLabel: "Views par mois · tous les posts cumulés",
  calcViewsAria: "Views par mois",
  calcStreamLabel: (label) => `STREAM · ${label}`,
  calcSubSummary: (price, pct, months) => `${price} · ${pct} % pour toi, pendant ${months} mois.`,
  calcOneShotSummary: (price, pct) => `${price} · ${pct} % pour toi par vente.`,
  calcConvLabel: "Conversion Premium après installation",
  calcConvAria: "Conversion Premium",
  calcMiniBioClicks: (ctrPct) => `Clics bio (hypothèse ${ctrPct} % des views)`,
  calcMiniInstalls: (installPct) => `Installations (hypothèse ${installPct} % des clics)`,
  calcMiniBuyers: (convPct) => `Acheteurs Premium (${convPct} % conv)`,
  calcMiniS2Recurring: "Stream 2 par mois",
  calcMiniS2OneShot: "Stream 2 par cohorte d'installs",
  calcTotalLabelSub: "par mois pour toi",
  calcTotalLabelSubTwoStreams: "Total par mois pour toi",
  calcTotalLabelOneShot: "par cohorte pour toi",
  calcTotalLabelOneShotTwoStreams: "Total par cohorte",
  calcTotalLabelMonthsHint: (months) => `pendant ${months} mois`,
  calcTotalSubStreams: "Stream 1 + Stream 2",
  calcOneShotHint: "Vente Premium ponctuelle",
  calcLifetimeHint: (months, total) => `Lifetime par cohorte d'installs (× ${months} mois): ${total}`,
  calcSliderRateLabel: (label) => label,
  calcSliderBasketLabel: (label) => label,
  calcSlash: "/ mois",
  calcSlashAria: "par mois",

  trackingTitle: { plain: "Comment marche ", italic: "le tracking." },
  trackingLede: "Auto-attribué, pas besoin de tracker supplémentaire de ton côté. Ton lien te reconnaît tout seul, le reste se passe côté serveur chez nous.",
  trackingProtectionEyebrow: "Mécanismes de protection",
  trackingProtection1: "Blocage auto-referral: ton propre compte ne compte pas",
  trackingProtection2: "Fenêtre de remboursement de 30 jours, ensuite la commission est sécurisée",
  trackingProtection3: "Empreinte IP et device contre les vagues de fraude",
  trackingProtection4: "Fallback sans cookie via install-receipt pour iOS 14+",
  trackingAdEyebrow: "Identification publicitaire",
  trackingAdBody: "Marque toujours le contenu d'affiliation comme Publicité ou Partenariat rémunéré. En stories, le sticker suffit, en Reels et posts ça va dans les premières lignes de la caption. Ça te protège et nous protège.",
  trackingDiagramCaption: "Quatre stations, un lien. 30 jours de retenue pour remboursement après chaque achat, puis ta part arrive sur ton compte via Wise.",
  diagramStep1Caption: "Tu partages le lien.",
  diagramStep2Caption: "Ils installent.",
  diagramStep3Caption: "Ils achètent Premium.",
  diagramStep4Caption: "Tu es payée.",
  diagramRefundLabel: "60 j",
  diagramRedirectLabel: "deeplink",
  diagramReleaseLabel: "30 j",

  payoutTitle: { plain: "Où va ", italic: "l'argent?" },
  payoutLede: "On paye chaque mois dès que tu atteins 50 €. Les montants inférieurs passent au cycle du mois suivant. Tu peux changer tes données dans le dashboard à tout moment.",
  fieldDisplayName: "Nom affiché sur la facture",
  fieldDisplayNamePh: "Molly Hartmann",
  fieldCountry: "Pays fiscal",
  fieldCountryPlaceholder: "Choisis",
  fieldWiseHeader: "Paiement via Wise",
  fieldWiseBody: "On paye actuellement exclusivement via Wise. Il te faut juste une email liée à ton compte Wise. Wise transfère l'argent dans ta monnaie locale.",
  fieldWiseEmail: "Email de ton compte Wise",
  fieldWiseEmailPh: "pay@molly.studio",
  fieldEmailInvalid: "Merci de saisir une adresse email complète liée à ton compte Wise.",
  fieldTaxStatus: "Statut fiscal",
  taxOptionKleinunt: "Micro-entreprise, sans TVA",
  taxOptionRegel: "Régime normal, avec TVA",
  taxOptionUnknown: "Particulier, sans activité",
  invoiceCheckMain: "Je peux émettre une facture avec TVA mentionnée.",
  invoiceCheckHint: "Sinon, on gère la note de crédit automatiquement pour toi.",
  agreementCheckBefore: "J'accepte les ",
  agreementCheckLink: "Conditions d'Affiliation",
  agreementCheckAfter: (version) => ` en version ${version}.`,
  agreementCheckHint: (pct, months, streamWord) => `${pct} % ${streamWord}, ${months} mois d'attribution, 30 jours de retenue pour remboursement, paiement mensuel à partir de 50 €. IP et timestamp sont conservés pour l'audit-trail.`,
  payoutSavingBtn: "Enregistrement…",
  payoutSubmitBtn: "Terminer le setup affilié",
  payoutErrorFallback: "Setup échoué, merci de réessayer.",
  payoutConsent: "En cliquant sur terminer tu confirmes que les données sont correctes et que tu as lu les Conditions d'Affiliation, y compris les mentions de protection des données au §05. Tu peux résilier à tout moment, les commissions en attente n'expirent pas.",

  liveTitle: { plain: "Tu es ", italic: "en ligne ✓" },
  liveLede: "Ton lien de tracking perso est armé. Les premiers clics apparaissent dans le dashboard en moins de 5 minutes. Pas besoin de code, le lien fait tout.",
  liveLinkEyebrow: "Ton lien de tracking",
  copy: "Copier",
  copied: "Copié",
  shareLinkBtn: "Partager le lien",
  liveCaptionEyebrow: "Caption d'affiliation · à copier",
  liveCaptionTagShort: "Story / Bio",
  liveCaptionTagLong: "Reel / Post",
  liveCaptionShort: (brandName, url) => `Publicité · App ${brandName}, lien en bio. ${url}`,
  liveCaptionLong: (brandName, url) => `Publicité · J'utilise ${brandName} depuis quelques semaines et j'aime à quel point ça me simplifie la journée. Si tu veux tester: ${url}`,
  liveCaptionLegal: "Publicité ou Partenariat rémunéré doit aller dans les premières lignes, comme ça l'identification est nette. Le reste du texte, réécris-le avec ta voix.",
  liveResourceMeta: "Google Drive · logos, screenshots, playbook PDF",
  liveShareEyebrow: "Comment partager",
  liveShareBio: "Lien en bio: mets le lien directement dans ta bio Instagram ou TikTok. Les deux plateformes l'acceptent sans redirect.",
  liveShareStory: "Stories et Reels: sticker de lien dessus, note vocale qui explique, fini. N'oublie pas de marquer comme publicité.",
  liveShareCaption: "Captions: mets aussi le lien dans la caption, au cas où quelqu'un ne scrolle pas vers la bio. Le tracking marche au clic, pas au code.",
  liveCtaDashboard: "Vers ton dashboard d'affiliée",
  liveFooterMail: (email) => `Confirmation à ${email || "ton email"} en route. Des questions?`,

  statusAlreadyActive: "Tu es déjà enregistrée comme affiliée. Pour toute question: alain@getklar.org",
  statusExpiredTitle: { plain: "Lien ", italic: "expiré" },
  statusExpiredLede: "Ton lien d'onboarding a expiré ou n'est pas valide. Écris-nous à alain@getklar.org, on te le renouvelle.",
  statusLoading: { italic: "Chargement …" },

  streamWordSub: "part de l'abonnement",
  streamWordPerSale: "part",
  monatlichSuffix: "mensuel",
  cohortSuffix: "par cohorte",

  countryDE: "Allemagne",
  countryAT: "Autriche",
  countryCH: "Suisse",
  countryNL: "Pays-Bas",
  countryFR: "France",
  countryIT: "Italie",
  countryES: "Espagne",
  countryOTHER: "Autre pays UE",

  followerHint: "",
  pmSuffix: "par mois",
  perInstallCohort: "par cohorte d'installs",

  calcS2NoteYarn: (shoppers, basket, ratePct) => `${shoppers} acheteuses actives de laine × ${basket} € panier × ${ratePct} %`,
  calcS2NoteAlbum: (buyers, basket, ratePct) => `${buyers} acheteurs d'album × ${basket} € × ${ratePct} %`,
  calcS2HintYarn: "7,5 % de commission shop × 50 % part affiliée = 3,75 % du panier",
  calcS2HintAlbum: "Vente unique, 50 % de part par album",
};

const TABLE: Record<Lang, Messages> = { de, en, es, it, fr };

export function getMessages(lang: Lang): Messages {
  return TABLE[lang] ?? TABLE.de;
}
