// Brief layout: two variants per lang.
//   short — ~2 pages, marketing summary + business model + light attribution pointer
//   long  — ~4-5 pages, marketing + business + Codebase / DIY-attribution deep dive

import { PDFDocument } from 'pdf-lib';
import {
  loadFonts, createDoc, Cursor, drawHeaderFooter, drawCoverChrome,
  drawH1, drawH2, drawParagraph, drawBullets, drawRule, ensureSpace, rgbFrom
} from './layout.mjs';
import { sanitise } from './sanitiser.mjs';

export const BRIEF_VARIANTS = ['short', 'long'];

export async function buildBrief(common, app, lang = 'en', variant = 'short') {
  if (!BRIEF_LABELS[lang]) throw new Error(`brief: unsupported lang ${lang}`);
  if (!BRIEF_VARIANTS.includes(variant)) throw new Error(`brief: unsupported variant ${variant}`);
  const root = app.brief && app.brief[lang];
  if (!root) throw new Error(`brief: no ${lang} content for ${app.app.key}`);
  const b = root[variant];
  if (!b) {
    // Legacy: flat brief with no short/long. Render as short if it has tagline.
    if (variant === 'short' && root.tagline) return renderShort(common, app, lang, root);
    throw new Error(`brief: no ${variant} content for ${app.app.key} / ${lang}`);
  }

  if (variant === 'short') return renderShort(common, app, lang, b);
  return renderLong(common, app, lang, b);
}

async function renderShort(common, app, lang, b) {
  const pdf = await PDFDocument.create();
  const fonts = await loadFonts(pdf);
  const doc = createDoc(common);
  const aff = common.affiliate;
  const L = BRIEF_LABELS[lang];

  pdf.setTitle(`${app.app.name} — ${L.docTitleShort}`);
  pdf.setAuthor('Klar Affiliate / Alain Kessler');
  pdf.setSubject(L.docTitleShort);
  pdf.setCreator('Klar PDF Generator');
  pdf.setProducer('pdf-lib');
  pdf.setCreationDate(new Date());

  // ===== Page 1: cover =====
  const page1 = pdf.addPage([doc.pageW, doc.pageH]);
  drawCoverChrome(page1, doc, fonts);
  const cursor = new Cursor(page1, doc, fonts);
  cursor.move(60);

  drawH1(cursor, app.app.name);
  drawParagraph(cursor, b.tagline, { italic: true, color: rgbFrom(doc.common.page.colors.muted) });
  cursor.move(6);

  drawRule(cursor);

  drawH2(cursor, L.whatItIs);
  drawParagraph(cursor, b.what_it_is);

  drawH2(cursor, L.whoFor);
  drawParagraph(cursor, b.who_for);

  drawH2(cursor, L.keyFeatures);
  drawBullets(cursor, b.key_features || b.features || []);

  drawStandLabel(page1, doc, fonts, common.brand[`stand_label_${lang}`] || common.brand.stand_label_en);

  // ===== Page 2 =====
  cursor.newPage(pdf, (p) => drawHeaderFooter(p, doc, fonts, {
    brand: common.brand,
    leftLabel: `${app.app.name}  ·  ${L.docTitleShort}`,
    rightLabel: 'Klar',
    pageIdx: 2,
    totalPages: 2,
    pageWord: L.pageWord,
  }));

  drawH2(cursor, L.businessModel);
  drawBullets(cursor, b.business_model_lines || []);

  drawH2(cursor, L.affiliateComp);
  drawBullets(cursor, affiliateCompensationBullets(lang, aff));

  if (b.attribution_one_paragraph) {
    drawH2(cursor, L.attributionShort);
    drawParagraph(cursor, b.attribution_one_paragraph);
  }

  if (b.see_long_pointer) {
    cursor.move(6);
    drawParagraph(cursor, b.see_long_pointer, { italic: true, color: rgbFrom(doc.common.page.colors.muted) });
  }

  cursor.move(8);
  drawParagraph(cursor, common.compliance[`disclosure_${lang}`] || common.compliance.disclosure_en, { italic: true, size: 9, color: rgbFrom(doc.common.page.colors.muted) });

  drawStandLabel(cursor.page, doc, fonts, common.brand[`stand_label_${lang}`] || common.brand.stand_label_en);

  return pdf.save();
}

async function renderLong(common, app, lang, b) {
  const pdf = await PDFDocument.create();
  const fonts = await loadFonts(pdf);
  const doc = createDoc(common);
  const aff = common.affiliate;
  const L = BRIEF_LABELS[lang];

  pdf.setTitle(`${app.app.name} — ${L.docTitleLong}`);
  pdf.setAuthor('Klar Affiliate / Alain Kessler');
  pdf.setSubject(L.docTitleLong);
  pdf.setCreator('Klar PDF Generator');
  pdf.setProducer('pdf-lib');
  pdf.setCreationDate(new Date());

  const standLabel = common.brand[`stand_label_${lang}`] || common.brand.stand_label_en;

  // ===== Page 1: cover =====
  const cover = pdf.addPage([doc.pageW, doc.pageH]);
  drawCoverChrome(cover, doc, fonts);
  const cursor = new Cursor(cover, doc, fonts);
  cursor.move(60);

  drawH1(cursor, app.app.name);
  drawParagraph(cursor, b.tagline, { italic: true, color: rgbFrom(doc.common.page.colors.muted) });
  cursor.move(6);
  drawRule(cursor);

  drawH2(cursor, L.whatItIs);
  drawParagraph(cursor, b.what_it_is);

  drawH2(cursor, L.whoFor);
  drawParagraph(cursor, b.who_for);

  drawH2(cursor, L.keyFeatures);
  drawBullets(cursor, b.key_features || b.features || []);

  drawStandLabel(cover, doc, fonts, standLabel);

  // ===== Body pages (no chrome stamped now; second pass adds chrome) =====
  const headerLeft = `${app.app.name}  ·  ${L.docTitleLong}`;
  const noChrome = () => {};
  cursor.newPage(pdf, noChrome);

  drawH2(cursor, L.businessModel);
  drawBullets(cursor, b.business_model_lines || []);

  if (b.pricing_lines) {
    drawParagraph(cursor, L.pricingHeader, { bold: true });
    drawBullets(cursor, b.pricing_lines);
  }

  if (b.market_gap) {
    cursor.move(4);
    drawParagraph(cursor, L.marketGapHeader, { bold: true });
    drawParagraph(cursor, b.market_gap);
  }

  if (b.business_model_why_now) {
    cursor.move(4);
    drawParagraph(cursor, L.whyNowHeader, { bold: true });
    drawParagraph(cursor, b.business_model_why_now);
  }

  ensureSpace(cursor, 200, pdf, noChrome);
  drawH2(cursor, L.affiliateComp);
  drawBullets(cursor, affiliateCompensationBullets(lang, aff));

  // ===== Codebase / DIY attribution deep dive =====
  if (b.attribution) {
    const a = b.attribution;
    ensureSpace(cursor, 220, pdf, noChrome);
    drawH2(cursor, L.attributionLong);
    if (a.intro) drawParagraph(cursor, a.intro);
    if (a.why_diy) {
      drawParagraph(cursor, L.whyDIY, { bold: true });
      drawParagraph(cursor, a.why_diy);
    }
    if (a.android_install_referrer) {
      drawParagraph(cursor, L.androidReferrer, { bold: true });
      drawParagraph(cursor, a.android_install_referrer);
    }
    if (a.ios_warm_universal_link) {
      drawParagraph(cursor, L.iosWarm, { bold: true });
      drawParagraph(cursor, a.ios_warm_universal_link);
    }
    if (a.ios_cold_clipboard) {
      drawParagraph(cursor, L.iosCold, { bold: true });
      drawParagraph(cursor, a.ios_cold_clipboard);
    }
    if (a.confirmation_step) {
      drawParagraph(cursor, L.confirmStep, { bold: true });
      drawParagraph(cursor, a.confirmation_step);
    }
    if (a.revenuecat_webhook) {
      drawParagraph(cursor, L.rcWebhook, { bold: true });
      drawParagraph(cursor, a.revenuecat_webhook);
    }
    if (a.payout_pipeline) {
      drawParagraph(cursor, L.payoutPipeline, { bold: true });
      drawParagraph(cursor, a.payout_pipeline);
    }
    if (a.dashboard_transparency) {
      drawParagraph(cursor, L.dashboardTransparency, { bold: true });
      drawParagraph(cursor, a.dashboard_transparency);
    }
  }

  if (b.why_this_works) {
    ensureSpace(cursor, 140, pdf, noChrome);
    drawH2(cursor, L.whyThisWorks);
    drawParagraph(cursor, b.why_this_works);
  }

  cursor.move(8);
  drawParagraph(cursor, common.compliance[`disclosure_${lang}`] || common.compliance.disclosure_en, { italic: true, size: 9, color: rgbFrom(doc.common.page.colors.muted) });

  drawStandLabel(cursor.page, doc, fonts, standLabel);

  // ===== Second pass: stamp chrome on body pages with correct page totals =====
  const pages = pdf.getPages();
  const total = pages.length;
  for (let i = 1; i < total; i++) {
    drawHeaderFooter(pages[i], doc, fonts, {
      brand: common.brand,
      leftLabel: headerLeft,
      rightLabel: 'Klar',
      pageIdx: i + 1,
      totalPages: total,
      pageWord: L.pageWord,
    });
  }

  return pdf.save();
}

function drawStandLabel(page, doc, fonts, label) {
  const small = doc.common.page.fonts.small_size;
  const muted = rgbFrom(doc.common.page.colors.muted);
  page.drawText(sanitise(label), { x: doc.margin, y: 44, size: small, font: fonts.regular, color: muted });
}

function affiliateCompensationBullets(lang, aff) {
  const t = COMP_TEMPLATES[lang];
  return [
    t.rate(aff.rate_percent, aff.window_months),
    t.holdback(aff.refund_holdback_days),
    t.minPayout(aff.min_payout_eur, aff.payout_methods.join(' / ')),
    t.lifetime,
    t.dashboard,
  ];
}

const BRIEF_LABELS = {
  en: {
    docTitleShort: 'Product Brief — Short',
    docTitleLong: 'Product Brief — Extended (Codebase + Attribution)',
    pageWord: 'Page',
    whatItIs: 'What it is',
    whoFor: 'Who it is for',
    keyFeatures: 'Key features',
    businessModel: 'Business model',
    pricingHeader: 'Pricing',
    marketGapHeader: 'Market gap — what was missing',
    whyNowHeader: 'Why now',
    affiliateComp: 'Affiliate compensation',
    attributionShort: 'How tracking works (one paragraph)',
    attributionLong: 'How tracking works — DIY attribution stack',
    whyDIY: 'Why we built our own instead of Branch.io',
    androidReferrer: 'Android: Google Play install-referrer',
    iosWarm: 'iOS warm (app already installed)',
    iosCold: 'iOS cold (~99% of creator traffic)',
    confirmStep: 'Optional first-open confirmer',
    rcWebhook: 'RevenueCat webhook → payout queue',
    payoutPipeline: 'Holdback → batch → Wise',
    dashboardTransparency: 'What you see on your dashboard',
    whyThisWorks: 'Why this works as an affiliate pitch',
  },
  de: {
    docTitleShort: 'Produkt-Brief — Kurzfassung',
    docTitleLong: 'Produkt-Brief — Ausführlich (Codebase + Attribution)',
    pageWord: 'Seite',
    whatItIs: 'Was ist das',
    whoFor: 'Für wen',
    keyFeatures: 'Hauptfunktionen',
    businessModel: 'Geschäftsmodell',
    pricingHeader: 'Pricing',
    marketGapHeader: 'Marktlücke — was fehlte',
    whyNowHeader: 'Warum jetzt',
    affiliateComp: 'Affiliate-Vergütung',
    attributionShort: 'Wie das Tracking läuft (ein Absatz)',
    attributionLong: 'Wie das Tracking läuft — DIY-Attribution-Stack',
    whyDIY: 'Warum wir das selbst gebaut haben statt Branch.io',
    androidReferrer: 'Android: Google Play Install-Referrer',
    iosWarm: 'iOS warm (App schon installiert)',
    iosCold: 'iOS cold (~99% des Creator-Traffic)',
    confirmStep: 'Optionaler First-Open-Confirmer',
    rcWebhook: 'RevenueCat-Webhook → Payout-Queue',
    payoutPipeline: 'Holdback → Batch → Wise',
    dashboardTransparency: 'Was du im Dashboard siehst',
    whyThisWorks: 'Warum das als Affiliate-Pitch funktioniert',
  },
  it: {
    docTitleShort: 'Brief Prodotto — Sintesi',
    docTitleLong: 'Brief Prodotto — Esteso (Codebase + Attribuzione)',
    pageWord: 'Pagina',
    whatItIs: "Cos'è",
    whoFor: 'A chi è rivolto',
    keyFeatures: 'Funzionalità principali',
    businessModel: 'Modello di business',
    pricingHeader: 'Prezzo',
    affiliateComp: 'Compenso per affiliati',
    attributionShort: 'Come funziona il tracciamento (un paragrafo)',
    attributionLong: 'Come funziona il tracciamento — stack di attribuzione DIY',
    whyDIY: 'Perché abbiamo costruito il nostro invece di Branch.io',
    androidReferrer: 'Android: Google Play install-referrer',
    iosWarm: 'iOS warm (app già installata)',
    iosCold: 'iOS cold (~99% del traffico creator)',
    confirmStep: 'Conferma opzionale al primo avvio',
    rcWebhook: 'Webhook RevenueCat → coda pagamenti',
    payoutPipeline: 'Trattenuta → batch → Wise',
    dashboardTransparency: 'Cosa vedi nella dashboard',
    whyThisWorks: 'Perché funziona come pitch per affiliati',
  },
  fr: {
    docTitleShort: 'Brief Produit — Court',
    docTitleLong: 'Brief Produit — Étendu (Codebase + Attribution)',
    pageWord: 'Page',
    whatItIs: "Qu'est-ce que c'est",
    whoFor: 'À qui ça s\'adresse',
    keyFeatures: 'Fonctionnalités clés',
    businessModel: 'Modèle économique',
    pricingHeader: 'Prix',
    affiliateComp: 'Rémunération des affiliés',
    attributionShort: 'Comment fonctionne le tracking (un paragraphe)',
    attributionLong: 'Comment fonctionne le tracking — stack d\'attribution DIY',
    whyDIY: 'Pourquoi on a construit le nôtre au lieu de Branch.io',
    androidReferrer: 'Android : Google Play install-referrer',
    iosWarm: 'iOS warm (app déjà installée)',
    iosCold: 'iOS cold (~99 % du trafic créateur)',
    confirmStep: 'Confirmation optionnelle au premier lancement',
    rcWebhook: 'Webhook RevenueCat → queue de paiement',
    payoutPipeline: 'Retenue → batch → Wise',
    dashboardTransparency: 'Ce que tu vois sur ton tableau de bord',
    whyThisWorks: 'Pourquoi ça marche comme pitch affilié',
  },
  es: {
    docTitleShort: 'Brief de Producto — Corto',
    docTitleLong: 'Brief de Producto — Ampliado (Codebase + Atribución)',
    pageWord: 'Página',
    whatItIs: 'Qué es',
    whoFor: 'Para quién es',
    keyFeatures: 'Funciones principales',
    businessModel: 'Modelo de negocio',
    pricingHeader: 'Precio',
    affiliateComp: 'Compensación para afiliados',
    attributionShort: 'Cómo funciona el tracking (un párrafo)',
    attributionLong: 'Cómo funciona el tracking — stack de atribución DIY',
    whyDIY: 'Por qué hicimos el nuestro en vez de Branch.io',
    androidReferrer: 'Android: Google Play install-referrer',
    iosWarm: 'iOS warm (app ya instalada)',
    iosCold: 'iOS cold (~99 % del tráfico de creators)',
    confirmStep: 'Confirmación opcional al primer arranque',
    rcWebhook: 'Webhook RevenueCat → cola de pago',
    payoutPipeline: 'Retención → batch → Wise',
    dashboardTransparency: 'Lo que ves en tu panel',
    whyThisWorks: 'Por qué funciona como pitch para afiliados',
  },
};

const COMP_TEMPLATES = {
  en: {
    rate: (pct, win) => `${pct}% of net Premium subscription revenue for ${win} months from each attributed user's first paid month.`,
    holdback: (d) => `${d}-day refund holdback before payout becomes claimable (Apple / Google refund window).`,
    minPayout: (eur, m) => `${eur} EUR minimum payout, monthly, via ${m}.`,
    lifetime: 'Free Lifetime Premium for onboarded affiliates (no posting obligation).',
    dashboard: 'Per-handle dashboard with live click / install / sub / earning split, no agency layer.',
  },
  de: {
    rate: (pct, win) => `${pct}% des Netto-Premium-Subscription-Umsatzes über ${win} Monate ab dem ersten bezahlten Monat jedes attribuierten Users.`,
    holdback: (d) => `${d} Tage Refund-Holdback bevor die Auszahlung claimable wird (Apple-/Google-Refund-Fenster).`,
    minPayout: (eur, m) => `${eur} EUR Mindest-Auszahlung, monatlich, via ${m}.`,
    lifetime: 'Free Lifetime Premium für onboarded Affiliates (kein Posting-Zwang).',
    dashboard: 'Pro-Handle-Dashboard mit Live-Click-/Install-/Sub-/Earning-Split, keine Agentur-Layer.',
  },
  it: {
    rate: (pct, win) => `${pct}% del ricavo netto degli abbonamenti Premium per ${win} mesi dal primo mese a pagamento di ogni utente attribuito.`,
    holdback: (d) => `Trattenuta di ${d} giorni per i rimborsi prima che il pagamento diventi reclamabile (finestra rimborsi Apple / Google).`,
    minPayout: (eur, m) => `Pagamento minimo di ${eur} EUR, mensile, tramite ${m}.`,
    lifetime: 'Premium gratuito a vita per gli affiliati onboarded (nessun obbligo di posting).',
    dashboard: 'Dashboard per ogni handle con split live di click / install / abbonamento / guadagni, senza layer di agenzia.',
  },
  fr: {
    rate: (pct, win) => `${pct}% du revenu net des abonnements Premium pendant ${win} mois à partir du premier mois payé de chaque utilisateur attribué.`,
    holdback: (d) => `Retenue de ${d} jours pour les remboursements avant que le paiement devienne réclamable (fenêtre de remboursement Apple / Google).`,
    minPayout: (eur, m) => `Paiement minimum de ${eur} EUR, mensuel, via ${m}.`,
    lifetime: 'Premium gratuit à vie pour les affiliés onboarded (aucune obligation de publication).',
    dashboard: 'Tableau de bord par handle avec split en direct des clics / installs / abonnements / gains, sans couche d\'agence.',
  },
  es: {
    rate: (pct, win) => `${pct}% del ingreso neto de las suscripciones Premium durante ${win} meses desde el primer mes pagado de cada usuario atribuido.`,
    holdback: (d) => `Retención de ${d} días para reembolsos antes de que el pago sea reclamable (ventana de reembolso de Apple / Google).`,
    minPayout: (eur, m) => `Pago mínimo de ${eur} EUR, mensual, vía ${m}.`,
    lifetime: 'Premium gratis de por vida para los afiliados onboarded (sin obligación de publicar).',
    dashboard: 'Panel por handle con desglose en vivo de clics / instalaciones / suscripciones / ganancias, sin capa de agencia.',
  },
};
