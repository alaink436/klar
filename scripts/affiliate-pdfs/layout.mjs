// Shared PDF layout helpers for affiliate Briefs + Playbooks.
import { StandardFonts, rgb } from 'pdf-lib';
import { sanitise } from './sanitiser.mjs';

export async function loadFonts(pdf) {
  return {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };
}

export function rgbFrom(arr) {
  return rgb(arr[0], arr[1], arr[2]);
}

export function wrapWords(text, font, size, maxWidth) {
  const words = sanitise(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const probe = cur ? cur + ' ' + w : w;
    const width = font.widthOfTextAtSize(probe, size);
    if (width <= maxWidth) {
      cur = probe;
    } else {
      if (cur) lines.push(cur);
      if (font.widthOfTextAtSize(w, size) > maxWidth) {
        // hard-break overly long token
        let buf = '';
        for (const ch of w) {
          if (font.widthOfTextAtSize(buf + ch, size) <= maxWidth) buf += ch;
          else { lines.push(buf); buf = ch; }
        }
        cur = buf;
      } else {
        cur = w;
      }
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function createDoc(common) {
  return {
    common,
    pageW: common.page.size.width,
    pageH: common.page.size.height,
    margin: common.page.margin,
    contentW() { return this.pageW - 2 * this.margin; },
  };
}

export class Cursor {
  constructor(page, doc, fonts) {
    this.page = page;
    this.doc = doc;
    this.fonts = fonts;
    this.y = doc.pageH - doc.margin;
    this.x = doc.margin;
  }
  spaceLeft() { return this.y - this.doc.margin; }
  move(dy) { this.y -= dy; }
  newPage(pdf, drawChrome) {
    this.page = pdf.addPage([this.doc.pageW, this.doc.pageH]);
    this.y = this.doc.pageH - this.doc.margin;
    this.x = this.doc.margin;
    if (drawChrome) drawChrome(this.page);
  }
}

export function drawHeaderFooter(page, doc, fonts, opts) {
  const { brand, leftLabel, rightLabel, pageIdx, totalPages } = opts;
  const small = doc.common.page.fonts.small_size;
  const muted = rgbFrom(doc.common.page.colors.muted);
  // top header: leftLabel ... rightLabel (page X / Y)
  const topY = doc.pageH - 28;
  page.drawText(sanitise(leftLabel), { x: doc.margin, y: topY, size: small, font: fonts.regular, color: muted });
  const right = sanitise(`${rightLabel}  ·  Page ${pageIdx}/${totalPages}`);
  const w = fonts.regular.widthOfTextAtSize(right, small);
  page.drawText(right, { x: doc.pageW - doc.margin - w, y: topY, size: small, font: fonts.regular, color: muted });
  // top rule
  page.drawLine({
    start: { x: doc.margin, y: topY - 6 },
    end: { x: doc.pageW - doc.margin, y: topY - 6 },
    thickness: 0.4,
    color: rgbFrom(doc.common.page.colors.rule),
  });
  // bottom footer: brand center
  const footY = 28;
  const fLabel = sanitise(brand.publisher);
  const fW = fonts.regular.widthOfTextAtSize(fLabel, small);
  page.drawText(fLabel, { x: (doc.pageW - fW) / 2, y: footY, size: small, font: fonts.regular, color: muted });
}

export function drawCoverChrome(page, doc, fonts) {
  // Cover has no header/footer chrome; only KLAR mark + footer publisher.
  const small = doc.common.page.fonts.small_size;
  const muted = rgbFrom(doc.common.page.colors.muted);
  const mark = sanitise(doc.common.brand.klar_mark);
  page.drawText(mark, { x: doc.margin, y: doc.pageH - doc.margin - 4, size: small + 0.5, font: fonts.bold, color: rgbFrom(doc.common.page.colors.accent) });
  const pub = sanitise(doc.common.brand.publisher);
  const pw = fonts.regular.widthOfTextAtSize(pub, small);
  page.drawText(pub, { x: doc.pageW - doc.margin - pw, y: doc.pageH - doc.margin - 4, size: small, font: fonts.regular, color: muted });
  // bottom: stand label
  page.drawLine({
    start: { x: doc.margin, y: 56 },
    end: { x: doc.pageW - doc.margin, y: 56 },
    thickness: 0.4,
    color: rgbFrom(doc.common.page.colors.rule),
  });
}

export function drawH1(cursor, text) {
  const size = cursor.doc.common.page.fonts.h1_size;
  const lines = wrapWords(text, cursor.fonts.bold, size, cursor.doc.contentW());
  for (const line of lines) {
    cursor.page.drawText(line, { x: cursor.x, y: cursor.y - size, size, font: cursor.fonts.bold, color: rgbFrom(cursor.doc.common.page.colors.ink) });
    cursor.move(size + 4);
  }
  cursor.move(6);
}

export function drawH2(cursor, text) {
  const size = cursor.doc.common.page.fonts.h2_size;
  const leading = size + 4;
  cursor.move(8);
  cursor.page.drawText(sanitise(text), { x: cursor.x, y: cursor.y - size, size, font: cursor.fonts.bold, color: rgbFrom(cursor.doc.common.page.colors.ink) });
  cursor.move(leading + 4);
}

export function drawParagraph(cursor, text, opts = {}) {
  const size = opts.size ?? cursor.doc.common.page.fonts.body_size;
  const leading = opts.leading ?? cursor.doc.common.page.fonts.body_leading;
  const font = opts.bold ? cursor.fonts.bold : (opts.italic ? cursor.fonts.italic : cursor.fonts.regular);
  const color = opts.color ?? rgbFrom(cursor.doc.common.page.colors.ink);
  const lines = wrapWords(text, font, size, cursor.doc.contentW());
  for (const line of lines) {
    cursor.page.drawText(line, { x: cursor.x, y: cursor.y - size, size, font, color });
    cursor.move(leading);
  }
}

export function drawBullets(cursor, items, opts = {}) {
  const size = opts.size ?? cursor.doc.common.page.fonts.body_size;
  const leading = opts.leading ?? cursor.doc.common.page.fonts.body_leading;
  const indent = 14;
  const innerW = cursor.doc.contentW() - indent;
  for (const item of items) {
    const lines = wrapWords(item, cursor.fonts.regular, size, innerW);
    let first = true;
    for (const line of lines) {
      cursor.page.drawText(first ? '-' : ' ', { x: cursor.x, y: cursor.y - size, size, font: cursor.fonts.regular, color: rgbFrom(cursor.doc.common.page.colors.muted) });
      cursor.page.drawText(line, { x: cursor.x + indent, y: cursor.y - size, size, font: cursor.fonts.regular, color: rgbFrom(cursor.doc.common.page.colors.ink) });
      cursor.move(leading);
      first = false;
    }
    cursor.move(2);
  }
}

export function drawRule(cursor, opts = {}) {
  const thickness = opts.thickness ?? 0.4;
  cursor.move(4);
  cursor.page.drawLine({
    start: { x: cursor.x, y: cursor.y },
    end: { x: cursor.x + cursor.doc.contentW(), y: cursor.y },
    thickness,
    color: rgbFrom(cursor.doc.common.page.colors.rule),
  });
  cursor.move(8);
}

export function drawCallout(cursor, text) {
  const size = cursor.doc.common.page.fonts.body_size;
  const leading = cursor.doc.common.page.fonts.body_leading;
  const padding = 10;
  const innerW = cursor.doc.contentW() - 2 * padding;
  const lines = wrapWords(text, cursor.fonts.italic, size, innerW);
  const boxH = padding * 2 + lines.length * leading;
  cursor.move(4);
  cursor.page.drawRectangle({
    x: cursor.x,
    y: cursor.y - boxH,
    width: cursor.doc.contentW(),
    height: boxH,
    borderColor: rgbFrom(cursor.doc.common.page.colors.rule),
    borderWidth: 0.5,
    color: rgb(0.97, 0.97, 0.98),
  });
  let yIn = cursor.y - padding - size;
  for (const line of lines) {
    cursor.page.drawText(line, { x: cursor.x + padding, y: yIn, size, font: cursor.fonts.italic, color: rgbFrom(cursor.doc.common.page.colors.ink) });
    yIn -= leading;
  }
  cursor.move(boxH + 8);
}

export function ensureSpace(cursor, needed, pdf, drawChrome) {
  if (cursor.spaceLeft() < needed + 40) cursor.newPage(pdf, drawChrome);
}
