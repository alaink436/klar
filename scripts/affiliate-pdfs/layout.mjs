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
  const { brand, leftLabel, rightLabel, pageIdx, totalPages, pageWord } = opts;
  const small = doc.common.page.fonts.small_size;
  const muted = rgbFrom(doc.common.page.colors.muted);
  // top header: leftLabel ... rightLabel (page X / Y)
  const topY = doc.pageH - 28;
  page.drawText(sanitise(leftLabel), { x: doc.margin, y: topY, size: small, font: fonts.regular, color: muted });
  const right = sanitise(`${rightLabel}  ·  ${pageWord || 'Page'} ${pageIdx}/${totalPages}`);
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

// drawTable — light grid table.
// columns: [{ header, widthFrac }]  widthFracs should sum to ~1
// rows:    [[cellText, cellText, ...]]
export function drawTable(cursor, columns, rows, opts = {}) {
  const size = opts.size ?? 9;
  const leading = opts.leading ?? size + 3;
  const pad = 4;
  const totalW = cursor.doc.contentW();
  const colW = columns.map((c) => Math.floor(totalW * c.widthFrac));
  const rule = rgbFrom(cursor.doc.common.page.colors.rule);
  const ink = rgbFrom(cursor.doc.common.page.colors.ink);
  const muted = rgbFrom(cursor.doc.common.page.colors.muted);
  const headerBg = rgb(0.95, 0.95, 0.96);

  cursor.move(4);

  // Wrap each header
  const headerLines = columns.map((c, i) => wrapWords(c.header, cursor.fonts.bold, size, colW[i] - 2 * pad));
  const headerHeight = Math.max(...headerLines.map((l) => l.length)) * leading + 2 * pad;

  // Header background
  cursor.page.drawRectangle({
    x: cursor.x,
    y: cursor.y - headerHeight,
    width: totalW,
    height: headerHeight,
    color: headerBg,
    borderColor: rule,
    borderWidth: 0.4,
  });

  // Header text
  let cx = cursor.x;
  for (let i = 0; i < columns.length; i++) {
    const lines = headerLines[i];
    let ty = cursor.y - pad - size;
    for (const line of lines) {
      cursor.page.drawText(line, { x: cx + pad, y: ty, size, font: cursor.fonts.bold, color: ink });
      ty -= leading;
    }
    cx += colW[i];
  }
  cursor.move(headerHeight);

  // Rows
  for (const row of rows) {
    const cellLinesPerCol = row.map((cell, i) => wrapWords(String(cell ?? ''), cursor.fonts.regular, size, colW[i] - 2 * pad));
    const rowHeight = Math.max(...cellLinesPerCol.map((l) => l.length)) * leading + 2 * pad;

    // Page break if needed (best-effort)
    if (cursor.spaceLeft() < rowHeight + 20) {
      // Caller handles page break before calling drawTable usually; here we just stop drawing this row.
      // Push the move forward so subsequent content shifts to a new page logically.
      break;
    }

    // Row border (bottom rule only between rows)
    cursor.page.drawRectangle({
      x: cursor.x,
      y: cursor.y - rowHeight,
      width: totalW,
      height: rowHeight,
      borderColor: rule,
      borderWidth: 0.3,
    });

    let rcx = cursor.x;
    for (let i = 0; i < columns.length; i++) {
      const lines = cellLinesPerCol[i];
      let ty = cursor.y - pad - size;
      const isFirstCol = i === 0;
      for (const line of lines) {
        cursor.page.drawText(line, {
          x: rcx + pad,
          y: ty,
          size,
          font: isFirstCol ? cursor.fonts.bold : cursor.fonts.regular,
          color: isFirstCol ? ink : muted,
        });
        ty -= leading;
      }
      rcx += colW[i];
    }
    cursor.move(rowHeight);
  }
  cursor.move(8);
}
