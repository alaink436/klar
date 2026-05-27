// WinAnsi-safe text transform.
// pdf-lib's StandardFonts.Helvetica encodes WinAnsi (CP1252).
// Replace glyphs WinAnsi does not map; keep umlauts, accents, §, ·, € which it does.

const REPLACEMENTS = new Map([
  ['—', '-'],   // em-dash
  ['–', '-'],   // en-dash
  ['‘', "'"],   // left single quote
  ['’', "'"],   // right single quote (apostrophe)
  ['“', '"'],   // left double quote
  ['”', '"'],   // right double quote
  ['•', '-'],   // bullet
  ['…', '...'], // ellipsis
  ['→', '->'],  // right arrow
  ['←', '<-'],  // left arrow
  ['≈', '~'],   // approximately
  ['≠', '!='],  // not equal
  ['≤', '<='],  // less or equal
  ['≥', '>='],  // greater or equal
  ['×', 'x'],   // multiplication
  ['÷', '/'],   // division
  ['±', '+/-'], // plus-minus
  ['™', '(TM)'],// trademark
  ['®', '(R)'], // registered
  ['©', '(C)'], // copyright
  [' ', ' '],   // nbsp
  ['﻿', ''],    // BOM
]);

export function sanitise(s) {
  if (s == null) return '';
  let out = String(s);
  for (const [k, v] of REPLACEMENTS) out = out.split(k).join(v);
  return out;
}
