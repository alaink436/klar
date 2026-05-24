// Affiliate-Onboarding i18n. Single source of truth for all UI strings.
// Used by OnboardingShell + Step components via getMessages(lang).
//
// Each message can be a string or a function that returns a string for
// interpolation (e.g. brand-name placeholders). Keep ES translations in
// the Klar Voice: normie-aspirational, du-form (tú), no dev-jargon, no em-dashes.

export type Lang = "de" | "en" | "es";

export const SUPPORTED_LANGS: readonly Lang[] = ["de", "en", "es"] as const;

export function normalizeLang(input: string | null | undefined): Lang {
  const v = (input ?? "").toLowerCase().slice(0, 2);
  if (v === "es") return "es";
  if (v === "en") return "en";
  return "de";
}

export interface Messages {
  // Top frame
  brandSubline: string; // "Klar Affiliate" -> "Klar Affiliate"
  stepShort: string; // "Step"

  // Step labels
  stepWelcome: string;
  stepTracking: string;
  stepPayout: string;
  stepLive: string;

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

  // Stream cards
  streamEyebrowSub: string;
  streamEyebrowOneShot: string;
  streamTitleSubTail: string; // "der Sub."
  streamTitleOneShotTail: string; // "pro Verkauf."
  streamDetailSub: (pct: number, months: number, price: string) => string;
  streamDetailOneShot: (pct: number, months: number, price: string) => string;
  streamTitleYarn: { plain: string; italic: string };
  streamTitleAlbum: { plain: string; italic: string };
  streamDetailYarn: string; // contains <b> markers for layout
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
  calcTotalSubStreams: string; // "Stream 1 + Stream 2"
  calcOneShotHint: string; // "One-Shot Premium-Verkauf"
  calcLifetimeHint: (months: number, total: string) => string;
  calcSliderRateLabel: (label: string) => string;
  calcSliderBasketLabel: (label: string) => string;
  calcSlash: string; // "/ mo" suffix
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

  // Status (token expired / already done)
  statusAlreadyActive: string;
  statusExpiredTitle: { plain: string; italic: string };
  statusExpiredLede: string;
  statusLoading: { italic: string };

  // Misc
  streamWordSub: string; // "Sub-Anteil"
  streamWordPerSale: string; // "Anteil"
  monatlichSuffix: string; // "monatlich" (for sub label)
  cohortSuffix: string; // "pro Cohort"

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
  pmSuffix: string; // "pro Monat"
  perInstallCohort: string; // "pro Install-Cohort"

  // Calculator stream-2 notes (per-kind formula breakdown)
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

// EN-Translation as a near-mirror of DE — used for cross-checks and to keep
// the Lang-type complete. Real EN-pass can refine later.
const en: Messages = {
  ...de,
  stepShort: "Step",
  stepWelcome: "Welcome",
  stepTracking: "Tracking",
  stepPayout: "Payout",
  stepLive: "Live",
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
  copy: "Copy",
  copied: "Copied",
  shareLinkBtn: "Share link",
  liveCtaDashboard: "Go to your affiliate dashboard",
  calcSlash: "/ mo",
  calcSlashAria: "per month",
  pmSuffix: "per month",
};

const TABLE: Record<Lang, Messages> = { de, en, es };

export function getMessages(lang: Lang): Messages {
  return TABLE[lang] ?? TABLE.de;
}
