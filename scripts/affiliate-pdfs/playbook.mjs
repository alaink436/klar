// Playbook layout — v3.
// Pages: cover, intro, science (UGC vs Faceless + sources), Creator Types table,
//        UGC strategy, Faceless strategy, audience fit, cadence, math, tracking summary,
//        onboarding, dashboard, brand assets, FAQ, closing.

import { PDFDocument } from 'pdf-lib';
import {
  loadFonts, createDoc, Cursor, drawHeaderFooter, drawCoverChrome,
  drawH1, drawH2, drawParagraph, drawBullets, drawRule, drawCallout, drawTable, ensureSpace, rgbFrom
} from './layout.mjs';
import { sanitise } from './sanitiser.mjs';

export const PLAYBOOK_LANGS = ['en', 'de', 'it', 'fr', 'es'];

export async function buildPlaybook(common, app, lang) {
  if (!PLAYBOOK_LANGS.includes(lang)) throw new Error(`playbook: unsupported lang ${lang}`);
  const pb = app.playbook[lang];
  if (!pb) throw new Error(`No ${lang} playbook for ${app.app.key}`);
  const pdf = await PDFDocument.create();
  const fonts = await loadFonts(pdf);
  const doc = createDoc(common);

  const docTitleSuffix = { en: 'EN', de: 'DE', it: 'IT', fr: 'FR', es: 'ES' }[lang];
  pdf.setTitle(`${app.app.name} — Affiliate Playbook (${docTitleSuffix})`);
  pdf.setAuthor('Klar Affiliate / Alain Kessler');
  pdf.setSubject('Affiliate Playbook');
  pdf.setCreator('Klar PDF Generator');
  pdf.setProducer('pdf-lib');
  pdf.setCreationDate(new Date());

  const L = labels(lang, app, common);
  const standLabel = common.brand[`stand_label_${lang}`] || common.brand.stand_label_en;

  // ===== Cover =====
  const cover = pdf.addPage([doc.pageW, doc.pageH]);
  drawCoverChrome(cover, doc, fonts);
  const cursor = new Cursor(cover, doc, fonts);
  cursor.move(80);
  drawH1(cursor, app.app.name);
  drawParagraph(cursor, pb.subtitle || L.coverSubtitleFallback, { italic: true, color: rgbFrom(doc.common.page.colors.muted) });
  cursor.move(10);
  if (pb.hero_quote) {
    drawCallout(cursor, `"${pb.hero_quote}"`);
    cursor.move(8);
  }
  drawParagraph(cursor, L.coverIntro, { color: rgbFrom(doc.common.page.colors.muted) });
  cursor.move(20);
  drawRule(cursor);
  drawParagraph(cursor, L.toc, { size: 9, color: rgbFrom(doc.common.page.colors.muted) });
  drawStandLabel(cover, doc, fonts, standLabel);

  // ===== Body =====
  const headerLeft = `${app.app.name}  ·  ${L.docName}`;
  const noChrome = () => {};
  cursor.newPage(pdf, noChrome);

  // 1. Intro
  drawH2(cursor, L.s1_title);
  if (pb.sixty_seconds_intro) drawParagraph(cursor, pb.sixty_seconds_intro);
  if (pb.why_this_works) {
    cursor.move(4);
    drawParagraph(cursor, L.whyHeader, { bold: true });
    drawParagraph(cursor, pb.why_this_works);
  }
  if (pb.free_vs_premium) {
    cursor.move(4);
    drawParagraph(cursor, L.freeVsPremiumHeader, { bold: true });
    drawBullets(cursor, pb.free_vs_premium);
  }

  // 2. Science: UGC vs Faceless + sources
  if (pb.science) {
    ensureSpace(cursor, 240, pdf, noChrome);
    drawH2(cursor, L.s2_title);
    if (pb.science.headline) drawParagraph(cursor, pb.science.headline, { bold: true });
    if (pb.science.what_research_says) drawParagraph(cursor, pb.science.what_research_says);
    if (pb.science.caveat) {
      cursor.move(4);
      drawParagraph(cursor, L.caveatHeader, { bold: true });
      drawParagraph(cursor, pb.science.caveat);
    }
    if (pb.science.when_each_works) {
      cursor.move(4);
      drawParagraph(cursor, L.whenEachWorksHeader, { bold: true });
      drawParagraph(cursor, pb.science.when_each_works);
    }
    if (pb.science.sources && pb.science.sources.length) {
      cursor.move(4);
      drawParagraph(cursor, L.sourcesHeader, { bold: true });
      drawBullets(cursor, pb.science.sources, { size: 9 });
    }
  }

  // 3. Creator types — table mapping influencer archetype → recommended path
  if (pb.creator_types_table && pb.creator_types_table.length) {
    ensureSpace(cursor, 300, pdf, noChrome);
    drawH2(cursor, L.s3_title);
    if (pb.creator_types_intro) drawParagraph(cursor, pb.creator_types_intro);
    const columns = [
      { header: L.col_creator_type, widthFrac: 0.20 },
      { header: L.col_recommended_path, widthFrac: 0.18 },
      { header: L.col_best_hooks, widthFrac: 0.42 },
      { header: L.col_expected_conv, widthFrac: 0.20 },
    ];
    const rows = pb.creator_types_table.map((r) => [r.type, r.path, r.hooks, r.expected_conversion]);
    drawTable(cursor, columns, rows);
  }

  // 4. UGC strategy
  if (pb.ugc_strategy) {
    ensureSpace(cursor, 220, pdf, noChrome);
    drawH2(cursor, L.s4_title);
    drawStrategyBlock(cursor, pb.ugc_strategy, L);
  }

  // 5. Faceless strategy
  if (pb.faceless_strategy) {
    ensureSpace(cursor, 220, pdf, noChrome);
    drawH2(cursor, L.s5_title);
    drawStrategyBlock(cursor, pb.faceless_strategy, L);
  }

  // 6. Audience fit
  if (pb.audience_fit_good || pb.audience_fit_poor) {
    ensureSpace(cursor, 180, pdf, noChrome);
    drawH2(cursor, L.s6_title);
    if (pb.audience_fit_good) {
      drawParagraph(cursor, L.audienceGood, { bold: true });
      drawBullets(cursor, pb.audience_fit_good);
    }
    if (pb.audience_fit_poor) {
      drawParagraph(cursor, L.audiencePoor, { bold: true });
      drawBullets(cursor, pb.audience_fit_poor);
    }
  }

  // 7. Posting cadence
  if (pb.posting_cadence) {
    ensureSpace(cursor, 120, pdf, noChrome);
    drawH2(cursor, L.s7_title);
    drawParagraph(cursor, pb.posting_cadence);
  }

  // 8. Conversion math
  if (pb.conversion_math) {
    ensureSpace(cursor, 160, pdf, noChrome);
    drawH2(cursor, L.s8_title);
    drawParagraph(cursor, pb.conversion_math);
  }

  // 9. Tracking summary
  if (pb.tracking_summary || pb.tracking_model_lines) {
    ensureSpace(cursor, 140, pdf, noChrome);
    drawH2(cursor, L.s9_title);
    if (pb.tracking_summary) drawParagraph(cursor, pb.tracking_summary);
    else if (pb.tracking_model_lines) drawBullets(cursor, pb.tracking_model_lines);
  }

  // 10. Onboarding
  if (pb.onboarding_steps) {
    ensureSpace(cursor, 160, pdf, noChrome);
    drawH2(cursor, L.s10_title);
    drawBullets(cursor, pb.onboarding_steps);
  }

  // 11. Dashboard
  if (pb.dashboard_lines) {
    ensureSpace(cursor, 120, pdf, noChrome);
    drawH2(cursor, L.s11_title);
    drawBullets(cursor, pb.dashboard_lines);
  }

  // 12. Brand assets
  if (pb.brand_assets) {
    ensureSpace(cursor, 80, pdf, noChrome);
    drawH2(cursor, L.s12_title);
    drawParagraph(cursor, pb.brand_assets);
  }

  // 13. FAQ
  if (pb.faq && pb.faq.length) {
    ensureSpace(cursor, 200, pdf, noChrome);
    drawH2(cursor, L.s13_title);
    for (const [q, a] of pb.faq) {
      drawParagraph(cursor, q, { bold: true });
      drawParagraph(cursor, a);
      cursor.move(4);
    }
  }

  // 14. Closing
  if (pb.closing) {
    ensureSpace(cursor, 140, pdf, noChrome);
    drawH2(cursor, L.s14_title);
    drawParagraph(cursor, pb.closing);
  }

  // Disclosure footer
  cursor.move(8);
  const disclosure = common.compliance[`disclosure_${lang}`] || common.compliance.disclosure_en;
  drawParagraph(cursor, disclosure, { italic: true, size: 9, color: rgbFrom(doc.common.page.colors.muted) });
  drawStandLabel(cursor.page, doc, fonts, standLabel);

  // Second pass: chrome with totals
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

function drawStrategyBlock(cursor, strat, L) {
  if (strat.archetype) {
    drawParagraph(cursor, L.archetypeHeader, { bold: true });
    drawParagraph(cursor, strat.archetype);
  }
  if (strat.hook_examples) {
    drawParagraph(cursor, L.hookExamplesHeader, { bold: true });
    drawBullets(cursor, strat.hook_examples);
  }
  if (strat.format_templates) {
    drawParagraph(cursor, L.formatTemplatesHeader, { bold: true });
    drawBullets(cursor, strat.format_templates);
  }
  if (strat.do_dont) {
    drawParagraph(cursor, L.doDontHeader, { bold: true });
    drawBullets(cursor, strat.do_dont);
  }
}

function drawStandLabel(page, doc, fonts, label) {
  const small = doc.common.page.fonts.small_size;
  const muted = rgbFrom(doc.common.page.colors.muted);
  page.drawText(sanitise(label), { x: doc.margin, y: 44, size: small, font: fonts.regular, color: muted });
}

function labels(lang, app, common) {
  const cal = common.brand.cal_link;
  const langLabels = LANG_LABELS[lang] || LANG_LABELS.en;
  return langLabels(app, common, cal);
}

const LANG_LABELS = {
  en: (app, common, cal) => ({
    docName: 'Affiliate Playbook',
    pageWord: 'Page',
    coverSubtitleFallback: 'for creators who want to know what they are actually pitching',
    coverIntro: 'You replied, thank you. This is the long-form companion to the email. It walks through what the research says about face-on-camera vs faceless content, then breaks down which path fits your creator archetype.',
    toc: 'Contents: 1. App + business · 2. UGC vs faceless — what the research says · 3. Creator types table · 4. UGC strategy · 5. Faceless strategy · 6. Audience fit · 7. Cadence · 8. Conversion math · 9. Tracking summary · 10. Onboarding · 11. Dashboard · 12. Brand assets · 13. FAQ · 14. One last thing',
    s1_title: '1. App + business in 60 seconds',
    whyHeader: 'Why it sells',
    freeVsPremiumHeader: 'Free vs Premium',
    s2_title: '2. UGC vs faceless — what the research says',
    caveatHeader: 'The caveat',
    whenEachWorksHeader: 'When each path works',
    sourcesHeader: 'Sources',
    s3_title: '3. Creator types — which path fits you',
    s4_title: '4. UGC strategy (you on camera)',
    s5_title: '5. Faceless strategy (screen-rec, voiceover, B-roll)',
    s6_title: '6. Audience fit',
    audienceGood: 'Works well for',
    audiencePoor: 'Works poorly for',
    s7_title: '7. Posting cadence + best times',
    s8_title: '8. Conversion math (why this pays)',
    s9_title: '9. Tracking summary (full walkthrough in the Extended Brief)',
    s10_title: '10. Onboarding (5 minutes)',
    s11_title: '11. Dashboard (what you see)',
    s12_title: '12. Brand assets (download)',
    s13_title: '13. FAQ',
    s14_title: '14. One last thing',
    archetypeHeader: 'Who this fits',
    hookExamplesHeader: 'Hook examples that work',
    formatTemplatesHeader: 'Format templates',
    doDontHeader: 'Do / Don\'t',
    col_creator_type: 'Creator type',
    col_recommended_path: 'Primary path',
    col_best_hooks: 'Best hook angles',
    col_expected_conv: 'Realistic conversion',
  }),
  de: (app, common, cal) => ({
    docName: 'Affiliate-Playbook',
    pageWord: 'Seite',
    coverSubtitleFallback: 'für Creator die wissen wollen was sie eigentlich pitchen',
    coverIntro: 'Du hast geantwortet, danke. Das hier ist der Lang-Begleiter zur Mail. Geht durch was die Forschung zu UGC (Gesicht in die Kamera) vs Faceless sagt und zeigt welcher Pfad zu welchem Creator-Typ passt.',
    toc: 'Inhalt: 1. App + Business · 2. UGC vs Faceless · 3. Creator-Typen-Tabelle · 4. UGC-Strategie · 5. Faceless-Strategie · 6. Audience-Fit · 7. Cadence · 8. Mathematik · 9. Tracking-Kurzfassung · 10. Onboarding · 11. Dashboard · 12. Brand-Assets · 13. FAQ · 14. Noch eine Sache',
    s1_title: '1. App + Business in 60 Sekunden',
    whyHeader: 'Warum es verkauft',
    freeVsPremiumHeader: 'Free vs Premium',
    s2_title: '2. UGC vs Faceless — was die Forschung sagt',
    caveatHeader: 'Die Einschränkung',
    whenEachWorksHeader: 'Wann welcher Pfad funktioniert',
    sourcesHeader: 'Quellen',
    s3_title: '3. Creator-Typen — welcher Pfad passt zu dir',
    s4_title: '4. UGC-Strategie (du vor der Kamera)',
    s5_title: '5. Faceless-Strategie (Screen-Rec, Voiceover, B-Roll)',
    s6_title: '6. Audience-Fit',
    audienceGood: 'Funktioniert gut für',
    audiencePoor: 'Funktioniert schlecht für',
    s7_title: '7. Posting-Cadence + beste Zeiten',
    s8_title: '8. Conversion-Mathematik',
    s9_title: '9. Tracking-Kurzfassung (volles Walkthrough im Extended Brief)',
    s10_title: '10. Onboarding (5 Minuten)',
    s11_title: '11. Dashboard',
    s12_title: '12. Brand-Assets',
    s13_title: '13. FAQ',
    s14_title: '14. Noch eine Sache',
    archetypeHeader: 'Für wen das passt',
    hookExamplesHeader: 'Hook-Beispiele die ziehen',
    formatTemplatesHeader: 'Format-Templates',
    doDontHeader: 'Do / Don\'t',
    col_creator_type: 'Creator-Typ',
    col_recommended_path: 'Primärer Pfad',
    col_best_hooks: 'Beste Hook-Winkel',
    col_expected_conv: 'Realistische Conversion',
  }),
  it: (app, common, cal) => ({
    docName: 'Playbook per Affiliati',
    pageWord: 'Pagina',
    coverSubtitleFallback: 'per creator che vogliono sapere cosa stanno davvero promuovendo',
    coverIntro: "Hai risposto, grazie. Questo è il compagno lungo della mail. Spiega cosa dice la ricerca su UGC vs faceless e mostra quale percorso si adatta a quale tipo di creator.",
    toc: 'Indice: 1. App + business · 2. UGC vs faceless · 3. Tabella tipi di creator · 4. Strategia UGC · 5. Strategia faceless · 6. Affinità · 7. Cadenza · 8. Matematica · 9. Tracciamento · 10. Onboarding · 11. Dashboard · 12. Asset · 13. FAQ · 14. Un\'ultima cosa',
    s1_title: '1. App + business in 60 secondi',
    whyHeader: 'Perché vende',
    freeVsPremiumHeader: 'Free vs Premium',
    s2_title: '2. UGC vs faceless — cosa dice la ricerca',
    caveatHeader: "L'avvertenza",
    whenEachWorksHeader: 'Quando funziona ognuno',
    sourcesHeader: 'Fonti',
    s3_title: '3. Tipi di creator — quale percorso fa per te',
    s4_title: '4. Strategia UGC (tu in volto)',
    s5_title: '5. Strategia faceless (screen-rec, voiceover, B-roll)',
    s6_title: "6. Affinità con il pubblico",
    audienceGood: 'Funziona bene per',
    audiencePoor: 'Funziona male per',
    s7_title: '7. Cadenza di pubblicazione',
    s8_title: '8. Matematica delle conversioni',
    s9_title: '9. Tracciamento (sintesi)',
    s10_title: '10. Onboarding (5 minuti)',
    s11_title: '11. Dashboard',
    s12_title: '12. Asset del brand',
    s13_title: '13. FAQ',
    s14_title: "14. Un'ultima cosa",
    archetypeHeader: 'A chi va bene',
    hookExamplesHeader: 'Hook che funzionano',
    formatTemplatesHeader: 'Template di formato',
    doDontHeader: 'Da fare / Da evitare',
    col_creator_type: 'Tipo di creator',
    col_recommended_path: 'Percorso primario',
    col_best_hooks: 'Migliori angoli hook',
    col_expected_conv: 'Conversione realistica',
  }),
  fr: (app, common, cal) => ({
    docName: 'Playbook Affilié',
    pageWord: 'Page',
    coverSubtitleFallback: 'pour les créateurs qui veulent savoir ce qu\'ils pitchent vraiment',
    coverIntro: "Tu as répondu, merci. Voici le compagnon long de la mail. Il fait le point sur ce que dit la recherche sur UGC vs faceless et montre quelle voie correspond à chaque type de créateur.",
    toc: "Sommaire : 1. L'app + business · 2. UGC vs faceless · 3. Tableau types de créateurs · 4. Stratégie UGC · 5. Stratégie faceless · 6. Fit audience · 7. Cadence · 8. Maths · 9. Tracking · 10. Onboarding · 11. Dashboard · 12. Assets · 13. FAQ · 14. Une dernière chose",
    s1_title: "1. L'app + business en 60 secondes",
    whyHeader: 'Pourquoi ça vend',
    freeVsPremiumHeader: 'Free vs Premium',
    s2_title: '2. UGC vs faceless — ce que dit la recherche',
    caveatHeader: 'La nuance',
    whenEachWorksHeader: 'Quand chaque voie marche',
    sourcesHeader: 'Sources',
    s3_title: '3. Types de créateurs — quelle voie te correspond',
    s4_title: '4. Stratégie UGC (toi à la caméra)',
    s5_title: '5. Stratégie faceless (screen-rec, voix off, B-roll)',
    s6_title: '6. Fit audience',
    audienceGood: 'Fonctionne bien pour',
    audiencePoor: 'Fonctionne mal pour',
    s7_title: '7. Cadence',
    s8_title: '8. Maths de conversion',
    s9_title: '9. Tracking (résumé)',
    s10_title: '10. Onboarding (5 minutes)',
    s11_title: '11. Tableau de bord',
    s12_title: '12. Assets de marque',
    s13_title: '13. FAQ',
    s14_title: '14. Une dernière chose',
    archetypeHeader: 'À qui ça convient',
    hookExamplesHeader: 'Hooks qui fonctionnent',
    formatTemplatesHeader: 'Templates de format',
    doDontHeader: 'À faire / À éviter',
    col_creator_type: 'Type de créateur',
    col_recommended_path: 'Voie principale',
    col_best_hooks: 'Meilleurs hooks',
    col_expected_conv: 'Conversion réaliste',
  }),
  es: (app, common, cal) => ({
    docName: 'Playbook para Afiliados',
    pageWord: 'Página',
    coverSubtitleFallback: 'para creadores que quieren saber qué están realmente vendiendo',
    coverIntro: 'Has respondido, gracias. Este es el compañero largo del mail. Repasa lo que dice la investigación sobre UGC vs faceless y muestra qué camino encaja con cada tipo de creator.',
    toc: 'Índice: 1. La app + negocio · 2. UGC vs faceless · 3. Tabla tipos de creator · 4. Estrategia UGC · 5. Estrategia faceless · 6. Encaje · 7. Cadencia · 8. Matemática · 9. Tracking · 10. Onboarding · 11. Panel · 12. Recursos · 13. FAQ · 14. Una última cosa',
    s1_title: '1. La app + negocio en 60 segundos',
    whyHeader: 'Por qué vende',
    freeVsPremiumHeader: 'Free vs Premium',
    s2_title: '2. UGC vs faceless — qué dice la investigación',
    caveatHeader: 'El matiz',
    whenEachWorksHeader: 'Cuándo funciona cada camino',
    sourcesHeader: 'Fuentes',
    s3_title: '3. Tipos de creator — qué camino te encaja',
    s4_title: '4. Estrategia UGC (tú a cámara)',
    s5_title: '5. Estrategia faceless (screen-rec, voz en off, B-roll)',
    s6_title: '6. Encaje de audiencia',
    audienceGood: 'Funciona bien para',
    audiencePoor: 'Funciona mal para',
    s7_title: '7. Cadencia',
    s8_title: '8. Matemática de conversiones',
    s9_title: '9. Tracking (resumen)',
    s10_title: '10. Onboarding (5 minutos)',
    s11_title: '11. Panel',
    s12_title: '12. Recursos de marca',
    s13_title: '13. FAQ',
    s14_title: '14. Una última cosa',
    archetypeHeader: 'Para quién encaja',
    hookExamplesHeader: 'Hooks que funcionan',
    formatTemplatesHeader: 'Plantillas de formato',
    doDontHeader: 'Sí / No',
    col_creator_type: 'Tipo de creator',
    col_recommended_path: 'Camino principal',
    col_best_hooks: 'Mejores hooks',
    col_expected_conv: 'Conversión realista',
  }),
};
