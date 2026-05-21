// Translations for the ThrottleUp affiliate setup form.
// 5 languages fully translated (DE/EN/FR/ES/IT), NL as bonus, PT/PL fall back to EN.

export type Lang = "de" | "en" | "fr" | "es" | "it" | "nl" | "pt" | "pl";

export const SUPPORTED_LANGS: Lang[] = ["de", "en", "fr", "es", "it", "nl", "pt", "pl"];

export function isLang(s: string | null | undefined): s is Lang {
  return !!s && (SUPPORTED_LANGS as string[]).includes(s);
}

export interface T {
  expired_title: string;
  expired_body: string;
  already_done_body: string;
  loading: string;
  done_title: string;
  done_body: string;
  done_share_explainer: string;
  done_tracking_label: string;
  tag: string;
  welcome_title: string;
  welcome_body: string;
  field_name_label: string;
  field_name_placeholder: string;
  field_country_label: string;
  country_other: string;
  field_payout_method_label: string;
  field_iban_label: string;
  field_email_label_paypal: string;
  field_email_label_wise: string;
  field_email_placeholder: string;
  field_tax_label: string;
  tax_kleinunternehmer: string;
  tax_regelbesteuert: string;
  checkbox_invoice_capable: string;
  err_name_required: string;
  err_iban_required: string;
  err_email_required: string;
  err_generic: string;
  submit_idle: string;
  submit_busy: string;
  consent: string;
}

function tpl(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

const de: T = {
  expired_title: "Link abgelaufen",
  expired_body: "Dein Onboarding-Link ist abgelaufen oder ungültig. Schreib uns kurz an alain@getklar.org, wir erneuern ihn.",
  already_done_body: "Du bist bereits als Affiliate eingerichtet. Bei Fragen: alain@getklar.org",
  loading: "Lade noch …",
  done_title: "Setup fertig ✓",
  done_body: "Dein ThrottleUp Affiliate-Account steht. Dein persönlicher Code:",
  done_share_explainer: "{sharePct}% Revenue-Share über {shareMonths} Monate ab erstem Sub. Auszahlung monatlich via Wise, PayPal oder SEPA, 30 Tage Refund-Holdback.",
  done_tracking_label: "Dein Sharing-Link:",
  tag: "ThrottleUp · Onboarding",
  welcome_title: "Hi @{handle},",
  welcome_body: "Letzter Schritt: Auszahlungs-Setup. 2 bis 3 Minuten, dann ist dein persönlicher Link live.",
  field_name_label: "Anzeigename",
  field_name_placeholder: "Wie wir dich nennen",
  field_country_label: "Land (für Steuer)",
  country_other: "Anderes Land",
  field_payout_method_label: "Auszahlungsmethode",
  field_iban_label: "IBAN",
  field_email_label_paypal: "PayPal-Email",
  field_email_label_wise: "Wise-Email",
  field_email_placeholder: "du@example.com",
  field_tax_label: "Steuerstatus (DACH)",
  tax_kleinunternehmer: "Kleinunternehmer, nicht USt-pflichtig",
  tax_regelbesteuert: "Regelbesteuert, USt-pflichtig",
  checkbox_invoice_capable: "Ich kann eine korrekte Rechnung mit MwSt ausstellen",
  err_name_required: "Bitte deinen Anzeigenamen angeben.",
  err_iban_required: "IBAN fehlt.",
  err_email_required: "Payout-Email fehlt.",
  err_generic: "Etwas ging schief. Versuch es nochmal.",
  submit_idle: "Affiliate-Setup abschließen",
  submit_busy: "Wird eingerichtet …",
  consent: "Mit dem Klick bestätige ich {sharePct}% Revenue-Share über {shareMonths} Monate als Direkt-Vereinbarung mit Alain Kessler (CH, Einzelfirma).",
};

const en: T = {
  expired_title: "Link expired",
  expired_body: "Your onboarding link has expired or is invalid. Drop us a line at alain@getklar.org and we'll send a new one.",
  already_done_body: "You're already set up as an affiliate. Questions: alain@getklar.org",
  loading: "Loading …",
  done_title: "Setup complete ✓",
  done_body: "Your ThrottleUp affiliate account is live. Your personal code:",
  done_share_explainer: "{sharePct}% revenue share over {shareMonths} months from the first sub. Monthly payout via Wise, PayPal or SEPA, 30-day refund holdback.",
  done_tracking_label: "Your sharing link:",
  tag: "ThrottleUp · Onboarding",
  welcome_title: "Hi @{handle},",
  welcome_body: "Last step: payout setup. 2 to 3 minutes, then your personal link is live.",
  field_name_label: "Display name",
  field_name_placeholder: "How we should call you",
  field_country_label: "Country (for tax)",
  country_other: "Other country",
  field_payout_method_label: "Payout method",
  field_iban_label: "IBAN",
  field_email_label_paypal: "PayPal email",
  field_email_label_wise: "Wise email",
  field_email_placeholder: "you@example.com",
  field_tax_label: "Tax status (DACH)",
  tax_kleinunternehmer: "Small business, no VAT",
  tax_regelbesteuert: "Standard taxation, with VAT",
  checkbox_invoice_capable: "I can issue a proper invoice with VAT",
  err_name_required: "Please enter your display name.",
  err_iban_required: "IBAN is missing.",
  err_email_required: "Payout email is missing.",
  err_generic: "Something went wrong. Try again.",
  submit_idle: "Complete affiliate setup",
  submit_busy: "Setting up …",
  consent: "By clicking I confirm {sharePct}% revenue share over {shareMonths} months as a direct agreement with Alain Kessler (CH, sole proprietorship).",
};

const fr: T = {
  ...en,
  expired_title: "Lien expiré",
  expired_body: "Ton lien d'onboarding a expiré ou n'est plus valide. Écris-nous à alain@getklar.org et on t'en envoie un nouveau.",
  already_done_body: "Tu es déjà configuré comme affilié. Des questions : alain@getklar.org",
  loading: "Chargement …",
  done_title: "Configuration terminée ✓",
  done_body: "Ton compte affilié ThrottleUp est en ligne. Ton code personnel :",
  done_share_explainer: "{sharePct}% de revenu partagé pendant {shareMonths} mois à partir du premier abonnement. Paiement mensuel via Wise, PayPal ou SEPA, retenue de 30 jours pour les remboursements.",
  done_tracking_label: "Ton lien de partage :",
  tag: "ThrottleUp · Onboarding",
  welcome_title: "Salut @{handle},",
  welcome_body: "Dernière étape : configuration du paiement. 2 à 3 minutes, et ton lien personnel est en ligne.",
  field_name_label: "Nom affiché",
  field_name_placeholder: "Comment t'appeler",
  field_country_label: "Pays (pour la fiscalité)",
  country_other: "Autre pays",
  field_payout_method_label: "Méthode de paiement",
  field_email_label_paypal: "Email PayPal",
  field_email_label_wise: "Email Wise",
  field_email_placeholder: "toi@example.com",
  field_tax_label: "Statut fiscal (DACH)",
  tax_kleinunternehmer: "Micro-entrepreneur, pas de TVA",
  tax_regelbesteuert: "Régime général, avec TVA",
  checkbox_invoice_capable: "Je peux émettre une facture en bonne et due forme avec TVA",
  err_name_required: "Indique ton nom affiché s'il te plaît.",
  err_iban_required: "IBAN manquant.",
  err_email_required: "Email de paiement manquant.",
  err_generic: "Quelque chose s'est mal passé. Réessaie.",
  submit_idle: "Finaliser la configuration",
  submit_busy: "Configuration en cours …",
  consent: "En cliquant je confirme {sharePct}% de revenu partagé sur {shareMonths} mois comme accord direct avec Alain Kessler (CH, entreprise individuelle).",
};

const es: T = {
  ...en,
  expired_title: "Enlace caducado",
  expired_body: "Tu enlace de onboarding ha caducado o no es válido. Escríbenos a alain@getklar.org y te mandamos uno nuevo.",
  already_done_body: "Ya estás configurada como afiliado. Dudas: alain@getklar.org",
  loading: "Cargando …",
  done_title: "Configuración lista ✓",
  done_body: "Tu cuenta de afiliado ThrottleUp está en vivo. Tu código personal:",
  done_share_explainer: "{sharePct}% de revenue share durante {shareMonths} meses desde la primera sub. Pago mensual vía Wise, PayPal o SEPA, 30 días de retención por reembolsos.",
  done_tracking_label: "Tu enlace para compartir:",
  tag: "ThrottleUp · Onboarding",
  welcome_title: "Hola @{handle},",
  welcome_body: "Último paso: configuración del pago. 2 a 3 minutos y tu enlace personal está en vivo.",
  field_name_label: "Nombre visible",
  field_name_placeholder: "Cómo llamarte",
  field_country_label: "País (para impuestos)",
  country_other: "Otro país",
  field_payout_method_label: "Método de pago",
  field_email_label_paypal: "Email de PayPal",
  field_email_label_wise: "Email de Wise",
  field_email_placeholder: "tu@example.com",
  field_tax_label: "Estado fiscal (DACH)",
  tax_kleinunternehmer: "Autónomo, sin IVA",
  tax_regelbesteuert: "Régimen general, con IVA",
  checkbox_invoice_capable: "Puedo emitir una factura correcta con IVA",
  err_name_required: "Pon tu nombre visible por favor.",
  err_iban_required: "Falta el IBAN.",
  err_email_required: "Falta el email de pago.",
  err_generic: "Algo salió mal. Inténtalo de nuevo.",
  submit_idle: "Completar configuración de afiliado",
  submit_busy: "Configurando …",
  consent: "Al hacer clic confirmo {sharePct}% de revenue share por {shareMonths} meses como acuerdo directo con Alain Kessler (CH, empresa individual).",
};

const it: T = {
  ...en,
  expired_title: "Link scaduto",
  expired_body: "Il tuo link di onboarding è scaduto o non valido. Scrivici a alain@getklar.org e te ne mandiamo uno nuovo.",
  already_done_body: "Sei già configurato come affiliato. Domande: alain@getklar.org",
  loading: "Caricamento …",
  done_title: "Configurazione completata ✓",
  done_body: "Il tuo account affiliato ThrottleUp è live. Il tuo codice personale:",
  done_share_explainer: "{sharePct}% di revenue share per {shareMonths} mesi dal primo abbonamento. Pagamento mensile via Wise, PayPal o SEPA, 30 giorni di holdback per i rimborsi.",
  done_tracking_label: "Il tuo link da condividere:",
  tag: "ThrottleUp · Onboarding",
  welcome_title: "Ciao @{handle},",
  welcome_body: "Ultimo passo: configurazione del pagamento. 2 o 3 minuti, poi il tuo link personale è live.",
  field_name_label: "Nome visualizzato",
  field_name_placeholder: "Come chiamarti",
  field_country_label: "Paese (per le tasse)",
  country_other: "Altro paese",
  field_payout_method_label: "Metodo di pagamento",
  field_email_label_paypal: "Email PayPal",
  field_email_label_wise: "Email Wise",
  field_email_placeholder: "tu@example.com",
  field_tax_label: "Stato fiscale (DACH)",
  tax_kleinunternehmer: "Regime forfettario, senza IVA",
  tax_regelbesteuert: "Regime ordinario, con IVA",
  checkbox_invoice_capable: "Posso emettere una fattura corretta con IVA",
  err_name_required: "Inserisci il tuo nome visualizzato.",
  err_iban_required: "Manca l'IBAN.",
  err_email_required: "Manca l'email di pagamento.",
  err_generic: "Qualcosa è andato storto. Riprova.",
  submit_idle: "Completa configurazione affiliato",
  submit_busy: "Configurazione in corso …",
  consent: "Cliccando confermo il {sharePct}% di revenue share per {shareMonths} mesi come accordo diretto con Alain Kessler (CH, ditta individuale).",
};

const nl: T = {
  ...en,
  expired_title: "Link verlopen",
  expired_body: "Je onboarding-link is verlopen of ongeldig. Stuur ons een mail op alain@getklar.org en we sturen je een nieuwe.",
  already_done_body: "Je bent al ingesteld als affiliate. Vragen: alain@getklar.org",
  loading: "Laden …",
  done_title: "Setup voltooid ✓",
  done_body: "Je ThrottleUp affiliate-account is live. Je persoonlijke code:",
  done_share_explainer: "{sharePct}% revenue share gedurende {shareMonths} maanden vanaf de eerste sub. Maandelijkse uitbetaling via Wise, PayPal of SEPA, 30 dagen refund-holdback.",
  done_tracking_label: "Jouw deel-link:",
  tag: "ThrottleUp · Onboarding",
  welcome_title: "Hi @{handle},",
  welcome_body: "Laatste stap: uitbetaling instellen. 2 tot 3 minuten en je persoonlijke link is live.",
  field_name_label: "Weergavenaam",
  field_name_placeholder: "Hoe we je mogen noemen",
  field_country_label: "Land (voor belasting)",
  country_other: "Ander land",
  field_payout_method_label: "Uitbetalingsmethode",
  field_email_label_paypal: "PayPal-email",
  field_email_label_wise: "Wise-email",
  field_email_placeholder: "jij@example.com",
  field_tax_label: "Belastingstatus (DACH)",
  tax_kleinunternehmer: "Kleine ondernemer, geen btw",
  tax_regelbesteuert: "Reguliere ondernemer, met btw",
  checkbox_invoice_capable: "Ik kan een correcte factuur met btw uitschrijven",
  err_name_required: "Vul je weergavenaam in.",
  err_iban_required: "IBAN ontbreekt.",
  err_email_required: "Uitbetalings-email ontbreekt.",
  err_generic: "Er ging iets mis. Probeer het opnieuw.",
  submit_idle: "Affiliate-setup afronden",
  submit_busy: "Instellen …",
  consent: "Door te klikken bevestig ik {sharePct}% revenue share over {shareMonths} maanden als directe afspraak met Alain Kessler (CH, eenmanszaak).",
};

const pt: T = { ...en };
const pl: T = { ...en };

const ALL: Record<Lang, T> = { de, en, fr, es, it, nl, pt, pl };

export function t(lang: Lang | string | null | undefined): T {
  if (isLang(lang)) return ALL[lang];
  return de;
}

export function fill(s: string, vars: Record<string, string | number>): string {
  return tpl(s, vars);
}
