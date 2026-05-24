// Brief layout: ~2 pages.
// Page 1: Cover-style header, app name, tagline, "What it is", "Who for", "Key features".
// Page 2: "Business model", "Affiliate compensation", "Why this works", legal footer.

import { PDFDocument, rgb } from 'pdf-lib';
import {
  loadFonts, createDoc, Cursor, drawHeaderFooter, drawCoverChrome,
  drawH1, drawH2, drawParagraph, drawBullets, drawRule, ensureSpace, rgbFrom, wrapWords
} from './layout.mjs';
import { sanitise } from './sanitiser.mjs';

export async function buildBrief(common, app) {
  const pdf = await PDFDocument.create();
  const fonts = await loadFonts(pdf);
  const doc = createDoc(common);
  const b = app.brief;
  const aff = common.affiliate;

  pdf.setTitle(`${app.app.name} — Affiliate Product Brief`);
  pdf.setAuthor('Klar Affiliate / Alain Kessler');
  pdf.setSubject('Affiliate Product Brief');
  pdf.setCreator('Klar PDF Generator');
  pdf.setProducer('pdf-lib');
  pdf.setCreationDate(new Date());

  // ===== Page 1: cover-ish opener =====
  const page1 = pdf.addPage([doc.pageW, doc.pageH]);
  drawCoverChrome(page1, doc, fonts);
  const cursor = new Cursor(page1, doc, fonts);
  cursor.move(60);

  // App name H1
  drawH1(cursor, app.app.name);

  // Tagline
  drawParagraph(cursor, b.tagline, { italic: true, color: rgbFrom(doc.common.page.colors.muted) });
  cursor.move(6);

  drawRule(cursor);

  // What it is
  drawH2(cursor, 'What it is');
  drawParagraph(cursor, b.what_it_is);

  // Who for
  drawH2(cursor, 'Who it is for');
  drawParagraph(cursor, b.who_for);

  // Key features
  drawH2(cursor, 'Key features');
  drawBullets(cursor, b.features);

  // Header/footer chrome NOT on page 1 (cover); add publisher mark bottom
  drawStandLabel(page1, doc, fonts, common.brand.stand_label_en);

  // ===== Page 2 =====
  cursor.newPage(pdf, (p) => drawHeaderFooter(p, doc, fonts, {
    brand: common.brand,
    leftLabel: `${app.app.name}  ·  Affiliate Product Brief`,
    rightLabel: 'Klar',
    pageIdx: 2,
    totalPages: 2,
  }));

  // Business model
  drawH2(cursor, 'Business model');
  drawBullets(cursor, b.business_model_lines);

  // Affiliate compensation
  drawH2(cursor, 'Affiliate compensation');
  drawBullets(cursor, [
    `${aff.rate_percent}% of net Premium subscription revenue for ${aff.window_months} months from each attributed user's first paid month.`,
    `${aff.refund_holdback_days}-day refund holdback before payout becomes claimable (Apple / Google refund window).`,
    `${aff.min_payout_eur} EUR minimum payout, monthly, via ${aff.payout_methods.join(' / ')}.`,
    'Free Lifetime Premium for onboarded affiliates (no posting obligation).',
    'Per-handle dashboard with live click/install/sub/earning split, no agency layer.',
  ]);

  // Why this works
  drawH2(cursor, 'Why this works as an affiliate pitch');
  drawParagraph(cursor, b.why_this_works);

  // Disclosure footnote
  cursor.move(8);
  drawParagraph(cursor, common.compliance.disclosure_en, { italic: true, size: 9, color: rgbFrom(doc.common.page.colors.muted) });

  // Bottom stand label
  drawStandLabel(cursor.page, doc, fonts, common.brand.stand_label_en);

  return pdf.save();
}

function drawStandLabel(page, doc, fonts, label) {
  const small = doc.common.page.fonts.small_size;
  const muted = rgbFrom(doc.common.page.colors.muted);
  page.drawText(sanitise(label), { x: doc.margin, y: 44, size: small, font: fonts.regular, color: muted });
}
