// Playbook layout: ~5-6 pages.
// Page 1: Cover.
// Pages 2-N: numbered sections.

import { PDFDocument } from 'pdf-lib';
import {
  loadFonts, createDoc, Cursor, drawHeaderFooter, drawCoverChrome,
  drawH1, drawH2, drawParagraph, drawBullets, drawRule, drawCallout, ensureSpace, rgbFrom
} from './layout.mjs';
import { sanitise } from './sanitiser.mjs';

export async function buildPlaybook(common, app, lang) {
  if (lang !== 'en' && lang !== 'de') throw new Error('lang must be en or de');
  const pb = app.playbook[lang];
  if (!pb) throw new Error(`No ${lang} playbook for ${app.app.key}`);
  const pdf = await PDFDocument.create();
  const fonts = await loadFonts(pdf);
  const doc = createDoc(common);
  const aff = common.affiliate;

  const docTitle = lang === 'de' ? `${app.app.name} — Affiliate Playbook (DE)` : `${app.app.name} — Affiliate Playbook (EN)`;
  pdf.setTitle(docTitle);
  pdf.setAuthor('Klar Affiliate / Alain Kessler');
  pdf.setSubject('Affiliate Playbook');
  pdf.setCreator('Klar PDF Generator');
  pdf.setProducer('pdf-lib');
  pdf.setCreationDate(new Date());

  const L = labels(lang, app, common);

  // ===== Page 1: Cover =====
  const cover = pdf.addPage([doc.pageW, doc.pageH]);
  drawCoverChrome(cover, doc, fonts);
  const cursor = new Cursor(cover, doc, fonts);
  cursor.move(80);
  drawH1(cursor, app.app.name);
  drawParagraph(cursor, L.coverSubtitle, { italic: true, color: rgbFrom(doc.common.page.colors.muted) });
  cursor.move(10);
  drawCallout(cursor, `"${pb.hero_quote}"`);
  cursor.move(8);
  drawParagraph(cursor, L.coverIntro, { color: rgbFrom(doc.common.page.colors.muted) });
  cursor.move(20);
  drawRule(cursor);
  drawParagraph(cursor, L.toc, { size: 9, color: rgbFrom(doc.common.page.colors.muted) });

  drawStandLabel(cover, doc, fonts, lang === 'de' ? common.brand.stand_label_de : common.brand.stand_label_en);

  // ===== Body pages =====
  // We render content first without chrome. Headers/footers are stamped in a second
  // pass once total page count is known — avoids "Page X/99" placeholder leakage.
  const headerLeft = `${app.app.name}  ·  ${L.docName}`;
  const noChrome = () => {};
  cursor.newPage(pdf, noChrome);

  drawH2(cursor, L.s1_title);
  drawParagraph(cursor, pb.sixty_seconds_intro);
  cursor.move(6);
  drawParagraph(cursor, L.whyHeader, { bold: true });
  drawParagraph(cursor, pb.why_this_works);
  cursor.move(6);
  drawParagraph(cursor, L.freeVsPremiumHeader, { bold: true });
  drawBullets(cursor, pb.free_vs_premium);

  // 2. Audience fit
  ensureSpace(cursor, 200, pdf, noChrome);
  drawH2(cursor, L.s2_title);
  drawParagraph(cursor, L.audienceGood, { bold: true });
  drawBullets(cursor, pb.audience_fit_good);
  drawParagraph(cursor, L.audiencePoor, { bold: true });
  drawBullets(cursor, pb.audience_fit_poor);

  // 3. Reel hooks — flexible group list per app
  ensureSpace(cursor, 200, pdf, noChrome);
  drawH2(cursor, L.s3_title);
  const reelGroups = Array.isArray(pb.reel_hooks)
    ? pb.reel_hooks
    : [{ label: L.reelSportHeader, items: pb.reel_hooks_sport ?? [] }, ...(pb.reel_hooks_productivity ? [{ label: L.reelOtherHeader, items: pb.reel_hooks_productivity }] : []), ...(pb.reel_hooks_produktivity ? [{ label: L.reelOtherHeader, items: pb.reel_hooks_produktivity }] : [])];
  for (const group of reelGroups) {
    drawParagraph(cursor, group.label, { bold: true });
    drawBullets(cursor, group.items);
  }

  // 4. Stories + carousels
  ensureSpace(cursor, 180, pdf, noChrome);
  drawH2(cursor, L.s4_title);
  drawParagraph(cursor, L.storiesHeader, { bold: true });
  drawBullets(cursor, pb.story_ideas);
  drawParagraph(cursor, L.carouselsHeader, { bold: true });
  drawBullets(cursor, pb.carousel_ideas);

  // 5. Posting cadence
  ensureSpace(cursor, 120, pdf, noChrome);
  drawH2(cursor, L.s5_title);
  drawParagraph(cursor, pb.posting_cadence);

  // 6. Conversion math
  ensureSpace(cursor, 160, pdf, noChrome);
  drawH2(cursor, L.s6_title);
  drawParagraph(cursor, pb.conversion_math);

  // 7. Tracking model
  ensureSpace(cursor, 180, pdf, noChrome);
  drawH2(cursor, L.s7_title);
  drawBullets(cursor, pb.tracking_model_lines);

  // 8. Onboarding
  ensureSpace(cursor, 160, pdf, noChrome);
  drawH2(cursor, L.s8_title);
  drawBullets(cursor, pb.onboarding_steps);

  // 9. Dashboard
  ensureSpace(cursor, 120, pdf, noChrome);
  drawH2(cursor, L.s9_title);
  drawBullets(cursor, pb.dashboard_lines);

  // 10. Brand assets
  ensureSpace(cursor, 80, pdf, noChrome);
  drawH2(cursor, L.s10_title);
  drawParagraph(cursor, pb.brand_assets);

  // 11. FAQ
  ensureSpace(cursor, 200, pdf, noChrome);
  drawH2(cursor, L.s11_title);
  for (const [q, a] of pb.faq) {
    drawParagraph(cursor, q, { bold: true });
    drawParagraph(cursor, a);
    cursor.move(4);
  }

  // 12. Next steps
  ensureSpace(cursor, 140, pdf, noChrome);
  drawH2(cursor, L.s12_title);
  drawBullets(cursor, L.nextSteps);

  // Disclosure footer on last page
  cursor.move(8);
  drawParagraph(cursor, lang === 'de' ? common.compliance.disclosure_de : common.compliance.disclosure_en, { italic: true, size: 9, color: rgbFrom(doc.common.page.colors.muted) });

  // Stand label on last page
  drawStandLabel(cursor.page, doc, fonts, lang === 'de' ? common.brand.stand_label_de : common.brand.stand_label_en);

  // ===== Second pass: rewrite top-right page index now that we know totals =====
  const pages = pdf.getPages();
  const total = pages.length;
  // pdf-lib re-draws on demand — easier: redraw header text for pages 2..total.
  for (let i = 1; i < total; i++) {
    const p = pages[i];
    drawHeaderFooter(p, doc, fonts, {
      brand: common.brand,
      leftLabel: headerLeft,
      rightLabel: 'Klar',
      pageIdx: i + 1,
      totalPages: total,
    });
  }

  return pdf.save();
}

function drawStandLabel(page, doc, fonts, label) {
  const small = doc.common.page.fonts.small_size;
  const muted = rgbFrom(doc.common.page.colors.muted);
  page.drawText(sanitise(label), { x: doc.margin, y: 44, size: small, font: fonts.regular, color: muted });
}

function labels(lang, app, common) {
  const cal = common.brand.cal_link;
  if (lang === 'de') {
    return {
      docName: 'Affiliate-Playbook',
      coverSubtitle: app.playbook.de.subtitle,
      coverIntro: 'Du hast geantwortet — danke. Dieses Playbook ist alles was du brauchst um zu entscheiden ob das für dich passt, und falls ja, wie du mit minimaler Reibung zu echten Conversions kommst.',
      toc: 'Inhalt: 1. App in 60 Sekunden · 2. Audience-Fit · 3. Reel-Hooks · 4. Stories + Karussells · 5. Posting-Cadence · 6. Conversion-Mathematik · 7. Tracking-Modell · 8. Onboarding · 9. Dashboard · 10. Brand-Assets · 11. FAQ · 12. Nächste Schritte',
      s1_title: '1. App in 60 Sekunden + Business-Modell',
      whyHeader: 'Warum das funktioniert',
      freeVsPremiumHeader: 'Free vs Premium',
      s2_title: '2. Audience-Fit (passt deine Audience?)',
      audienceGood: 'Funktioniert gut für',
      audiencePoor: 'Funktioniert schlecht für',
      s3_title: '3. Reel-Hooks die funktionieren',
      reelSportHeader: 'Sport-Coach-Reels',
      reelOtherHeader: 'Produktivität / WG-Reels',
      s4_title: '4. Story- und Karussell-Ideen',
      storiesHeader: 'Story-Ideen',
      carouselsHeader: 'Karussell-Ideen (IG)',
      s5_title: '5. Posting-Cadence + beste Zeiten',
      s6_title: '6. Conversion-Mathematik (warum sich das auszahlt)',
      s7_title: '7. Tracking-Modell (wie wird gezählt)',
      s8_title: '8. Onboarding (5 Minuten)',
      s9_title: '9. Dashboard (was du siehst)',
      s10_title: '10. Brand-Assets (Download)',
      s11_title: '11. FAQ',
      s12_title: '12. Nächste Schritte',
      nextSteps: [
        'Fragen? Antworte direkt auf Mail 2.',
        'Loslegen? Klick den Onboarding-Link aus Mail 2, 5 Minuten investieren, du bist live.',
        `15-Minuten-Intro-Call? Slot buchen via ${cal} (Cal.com). Wir gehen Tracking / Payout / Content-Ideen durch falls du vor dem Onboarding klären willst.`,
      ],
    };
  }
  // EN
  return {
    docName: 'Affiliate Playbook',
    coverSubtitle: app.playbook.en.subtitle,
    coverIntro: 'You replied, thank you. This playbook is everything you need to decide whether this is a fit for you, and if so, how to get to real conversions with minimum friction.',
    toc: 'Contents: 1. App in 60 seconds · 2. Audience fit · 3. Reel hooks · 4. Stories + carousels · 5. Posting cadence · 6. Conversion math · 7. Tracking model · 8. Onboarding · 9. Dashboard · 10. Brand assets · 11. FAQ · 12. Next steps',
    s1_title: '1. App in 60 seconds + business model',
    whyHeader: 'Why this works',
    freeVsPremiumHeader: 'Free vs Premium',
    s2_title: '2. Audience fit (does your audience match?)',
    audienceGood: 'Works well for',
    audiencePoor: 'Works poorly for',
    s3_title: '3. Reel hooks that work',
    reelSportHeader: 'Sport-coach reels',
    reelOtherHeader: 'Productivity / flatshare reels',
    s4_title: '4. Story + carousel ideas',
    storiesHeader: 'Story ideas',
    carouselsHeader: 'Carousel ideas (IG)',
    s5_title: '5. Posting cadence + best times',
    s6_title: '6. Conversion math (why this pays)',
    s7_title: '7. Tracking model (how it is counted)',
    s8_title: '8. Onboarding (5 minutes)',
    s9_title: '9. Dashboard (what you see)',
    s10_title: '10. Brand assets (download)',
    s11_title: '11. FAQ',
    s12_title: '12. Next steps',
    nextSteps: [
      'Questions? Reply directly to Mail 2.',
      'Want to start? Click the onboarding link from Mail 2, invest 5 minutes, you are live.',
      `15-minute intro call? Book a slot via ${cal} (Cal.com). We walk through tracking / payout / content ideas if you want to clarify before onboarding.`,
    ],
  };
}
