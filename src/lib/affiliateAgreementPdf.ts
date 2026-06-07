// SERVER ONLY. Node/Next port of the affiliate agreement PDF renderer that
// already lives in the Deno edge function affiliate-confirmation-email. The
// onboarding now generates the SAME contract PDF on the Next side so the
// affiliate can download it during the sign step and so the signed copy can
// be stored. The only addition over the email-side renderer is the signature
// block at the end, stamped with the typed signer name, date and version.
//
// IMPORTANT: AGREEMENT_SECTIONS_DE / AGREEMENT_SECTIONS_EN are a 1:1 mirror of
// the edge function and the on-site /legal/affiliate-agreement page. When the
// contract text changes, all three (here, edge function, legal page) and the
// AGREEMENT_VERSION constant move together.
//
// pdf-lib StandardFonts.Helvetica uses WinAnsi encoding, which DOES cover
// German umlauts (ä ö ü Ä Ö Ü ß), §, €, mid-dot (·). Em-dashes, curly quotes
// and bullets are NOT in WinAnsi, so sanitiseForWinAnsi() rewrites them before
// any drawText call to avoid "WinAnsi cannot encode character" throws.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type AgreementLang = "de" | "en";

export interface AgreementPdfInput {
  app_name: string;
  handle: string;
  display_name: string;
  contact_email: string;
  tracking_url: string;
  commission_pct: number;
  attribution_months: number;
  agreement_version: string;
  signed_at: string; // ISO timestamp
  language?: AgreementLang;
  // The full legal name the affiliate typed as their electronic signature.
  // When present, a signature block is appended; when absent the document is
  // the plain (unsigned) agreement.
  signer_name?: string | null;
}

function pickLang(p: AgreementPdfInput): AgreementLang {
  return p.language === "en" ? "en" : "de";
}

function formatDate(iso: string, lang: AgreementLang): string {
  try {
    if (lang === "en") {
      return new Date(iso).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
    }
    return new Date(iso).toLocaleDateString("de-CH", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}

interface AgreementSection {
  n: string;
  title: string;
  body: ReadonlyArray<string>;
}

const AGREEMENT_SECTIONS_DE: ReadonlyArray<AgreementSection> = [
  {
    n: "01",
    title: "Vertragspartner",
    body: [
      "Anbieter dieses Affiliate-Programms ist Alain Kessler, Einzelfirma mit Sitz in der Schweiz, erreichbar unter alain@getklar.org (im Folgenden 'Klar').",
      "Vertragspartner als Affiliate ist die im Onboarding-Formular angegebene natürliche oder juristische Person (im Folgenden 'Affiliate').",
    ],
  },
  {
    n: "02",
    title: "Programm-Gegenstand",
    body: [
      "Klar betreibt sechs mobile Apps: Yarn-Stash, ThrottleUp, On Wavelength, Kelva, Trubel und MyLoo. Der Affiliate erhält pro App einen persönlichen Tracking-Link. Wenn ein über diesen Link referrierter Nutzer in der App ein Premium-Abo abschliesst oder eine andere zahlungspflichtige Aktion auslöst, erhält der Affiliate eine Provision gemäss Paragraph 3.",
    ],
  },
  {
    n: "03",
    title: "Vergütung",
    body: [
      "Pro Premium-Sub bekommt der Affiliate einen prozentualen Anteil der monatlichen Sub-Einnahmen für die Attributions-Dauer ab erstem Kauf. Anteil und Dauer unterscheiden sich pro App und sind im Onboarding und im Dashboard transparent ausgewiesen. Standard ist 50 Prozent für 24 Monate; App-spezifische Abweichungen gelten ausdrücklich.",
      "Für Apps mit zweitem Revenue-Stream (Yarn-Stash: Awin-Shop-Provisionen, Trubel: 4k-Album-One-Time-Käufe) erhält der Affiliate zusätzlich einen Anteil an diesem Stream gemäss den im Onboarding ausgewiesenen Konditionen.",
      "Refund-Holdback: Provisionen werden 30 Tage nach dem Umsatz-Event zur Auszahlung freigegeben. Zurückerstattete Käufe werden vor Auszahlung netto abgezogen.",
      "Mindestauszahlung: 50 EUR oder USD. Beträge darunter werden als Carry-over in den nächsten Monatslauf übernommen.",
    ],
  },
  {
    n: "04",
    title: "Pflichten des Affiliates",
    body: [
      "Der Affiliate verpflichtet sich, alle Inhalte mit Affiliate-Bezug klar als Werbung zu kennzeichnen (Schweiz: UWG Art. 3 lit. b; Deutschland: UWG Paragraph 5a Abs. 4; USA: FTC Endorsement Guides). Geeignete Kennzeichnungen sind 'Werbung', 'Anzeige', '#ad' oder Plattform-eigene Paid-Partnership-Labels.",
      "Untersagt sind: Spam, Cookie-Stuffing, irreführende Aussagen über die App-Funktionalität, Markenrechtsverletzungen, der Einsatz des Tracking-Links in Paid-Ads auf den Klar-Marken-Keywords sowie Self-Referral (Käufe über den eigenen Tracking-Link). Verstösse führen zu sofortiger Aussetzung des Accounts und zum Verfall offener Provisionen.",
    ],
  },
  {
    n: "05",
    title: "Tracking und Datenschutz",
    body: [
      "Die Attribution erfolgt server-seitig über einen signierten Token-Mechanismus (Clipboard-Deferred-Deeplink auf iOS, Install-Referrer auf Android). Personenbezogene Daten der referrierten Nutzer werden nicht an den Affiliate übermittelt; er sieht ausschliesslich aggregierte Metriken (Klicks, Installs, Käufe) im Dashboard. Datenschutzgrundlage ist die DSGVO sowie das Schweizer DSG.",
    ],
  },
  {
    n: "06",
    title: "Auszahlung",
    body: [
      "Auszahlungen erfolgen monatlich, jeweils zum Ersten des Folgemonats, für alle bis dahin reifen und nicht zurückerstatteten Conversions. Auszahlungsmethode wird im Onboarding gewählt: PayPal, Wise oder SEPA. Der Affiliate ist für die korrekte Angabe seiner Zahlungsinformationen verantwortlich; nicht zustellbare Beträge werden zurückgehalten, bis korrigierte Daten vorliegen.",
      "Steuerstatus (Kleinunternehmer, regelbesteuert, Privatperson) wird im Onboarding angegeben. Klar erstellt entsprechende Gutschriften oder akzeptiert Rechnungen mit ausgewiesener MwSt, je nach angegebenem Status.",
    ],
  },
  {
    n: "07",
    title: "Laufzeit, Kündigung",
    body: [
      "Der Vertrag beginnt mit der Bestätigung dieser Bedingungen im Onboarding und läuft auf unbestimmte Zeit. Beide Parteien können jederzeit ohne Angabe von Gründen kündigen, schriftlich per E-Mail an alain@getklar.org bzw. an die im Onboarding angegebene Affiliate-E-Mail.",
      "Nach Kündigung werden bereits verdiente Provisionen für noch aktive Subscriptions bis zum Ende der jeweiligen Attributions-Dauer weiter ausgezahlt. Sie verfallen nicht.",
    ],
  },
  {
    n: "08",
    title: "Haftung",
    body: [
      "Klar haftet nur für Vorsatz und grobe Fahrlässigkeit. Bei leichter Fahrlässigkeit ist die Haftung auf den Ersatz vorhersehbarer, vertragstypischer Schäden begrenzt. Eine Haftung für entgangenen Gewinn aus erwartetem Sub-Volumen ist ausgeschlossen.",
    ],
  },
  {
    n: "09",
    title: "Anwendbares Recht und Gerichtsstand",
    body: [
      "Es gilt schweizerisches Recht unter Ausschluss des UN-Kaufrechts. Gerichtsstand für alle Streitigkeiten aus oder im Zusammenhang mit diesem Vertrag ist der Wohnsitz von Klar in der Schweiz, sofern zwingende Verbraucherschutzvorschriften nichts Gegenteiliges erlauben.",
    ],
  },
  {
    n: "10",
    title: "Änderungen, Salvatorische Klausel",
    body: [
      "Klar darf diese Bedingungen mit angemessener Vorankündigung (mindestens 14 Tage per E-Mail) ändern. Widerspricht der Affiliate der Änderung, kann er fristlos kündigen; bereits verdiente Provisionen bleiben erhalten.",
      "Sollte eine Bestimmung dieses Vertrags unwirksam sein, bleibt der Rest des Vertrags wirksam. Anstelle der unwirksamen Bestimmung gilt diejenige Regelung, die dem wirtschaftlichen Zweck am nächsten kommt.",
    ],
  },
];

const AGREEMENT_SECTIONS_EN: ReadonlyArray<AgreementSection> = [
  {
    n: "01",
    title: "Contracting Parties",
    body: [
      "The provider of this affiliate program is Alain Kessler, a sole proprietorship registered in Switzerland, reachable at alain@getklar.org (hereinafter 'Klar').",
      "The contracting affiliate is the natural or legal person specified in the onboarding form (hereinafter 'Affiliate').",
    ],
  },
  {
    n: "02",
    title: "Program Scope",
    body: [
      "Klar operates six mobile apps: Yarn-Stash, ThrottleUp, On Wavelength, Kelva, Trubel and MyLoo. The Affiliate receives a personal tracking link per app. When a user referred via this link signs up for a Premium subscription or triggers another paid action in the app, the Affiliate earns a commission under Section 3.",
    ],
  },
  {
    n: "03",
    title: "Compensation",
    body: [
      "Per Premium subscription the Affiliate receives a percentage share of the monthly subscription revenue for the attribution duration starting from the first purchase. Share and duration differ per app and are transparently disclosed during onboarding and in the dashboard. Standard is 50 percent for 24 months; app-specific deviations apply explicitly.",
      "For apps with a second revenue stream (Yarn-Stash: Awin shop commissions, Trubel: 4k album one-time purchases) the Affiliate additionally receives a share of that stream according to the conditions disclosed during onboarding.",
      "Refund holdback: commissions are released for payout 30 days after the revenue event. Refunded purchases are deducted net before payout.",
      "Minimum payout: 50 EUR or USD. Smaller amounts carry over into the next monthly run.",
    ],
  },
  {
    n: "04",
    title: "Affiliate Obligations",
    body: [
      "The Affiliate undertakes to clearly label all affiliate-related content as advertising (Switzerland: UWG Art. 3 lit. b; Germany: UWG Section 5a para. 4; USA: FTC Endorsement Guides). Suitable labels include 'advertising', 'ad', '#ad' or platform-specific paid-partnership badges.",
      "Prohibited: spam, cookie stuffing, misleading statements about app functionality, trademark infringement, the use of the tracking link in paid ads on Klar brand keywords, and self-referral (purchases through one's own tracking link). Violations lead to immediate account suspension and forfeiture of open commissions.",
    ],
  },
  {
    n: "05",
    title: "Tracking and Data Protection",
    body: [
      "Attribution runs server-side through a signed token mechanism (clipboard deferred deeplink on iOS, install referrer on Android). Personal data of referred users is not transmitted to the Affiliate; the Affiliate only sees aggregated metrics (clicks, installs, purchases) in the dashboard. Legal basis is the GDPR and the Swiss DSG.",
    ],
  },
  {
    n: "06",
    title: "Payout",
    body: [
      "Payouts happen monthly, on the first of the following month, for all conversions that are mature and not refunded by then. The payout method is chosen during onboarding: PayPal, Wise or SEPA. The Affiliate is responsible for correct payment information; non-deliverable amounts are held back until corrected data is provided.",
      "Tax status (small-business, regular taxation, private individual) is declared during onboarding. Klar issues corresponding self-billed credit notes or accepts invoices with declared VAT, depending on the declared status.",
    ],
  },
  {
    n: "07",
    title: "Term and Termination",
    body: [
      "The contract begins with confirmation of these terms during onboarding and runs indefinitely. Both parties may terminate at any time without giving reasons, in writing by email to alain@getklar.org or to the affiliate email registered during onboarding.",
      "After termination, already-earned commissions for still-active subscriptions continue to be paid out until the end of the respective attribution duration. They do not lapse.",
    ],
  },
  {
    n: "08",
    title: "Liability",
    body: [
      "Klar is liable only for intent and gross negligence. For light negligence, liability is limited to foreseeable, contract-typical damages. Liability for lost profit from expected subscription volume is excluded.",
    ],
  },
  {
    n: "09",
    title: "Applicable Law and Jurisdiction",
    body: [
      "Swiss law applies, excluding the UN Convention on Contracts for the International Sale of Goods. Jurisdiction for all disputes arising from or in connection with this contract is the domicile of Klar in Switzerland, unless mandatory consumer-protection provisions stipulate otherwise.",
    ],
  },
  {
    n: "10",
    title: "Amendments, Severability",
    body: [
      "Klar may amend these terms with reasonable advance notice (at least 14 days by email). If the Affiliate objects to the amendment, the Affiliate may terminate without notice; already-earned commissions remain unaffected.",
      "If any provision of this contract is invalid, the remainder of the contract stays valid. Instead of the invalid provision, the regulation that most closely matches the economic purpose applies.",
    ],
  },
];

const PDF_I18N = {
  de: {
    docTitle: (app: string) => `Affiliate-Vertrag - ${app}`,
    docHeader: (app: string) => `Affiliate-Vertrag - ${app}`,
    docSub: (version: string) => `Version ${version} - Stand 21. Mai 2026 - signiert via getklar.org/affiliate Onboarding`,
    introNote: "Diese Bedingungen regeln die Teilnahme am Klar Affiliate-Programm. Mit der Aktivierung deines Affiliate-Accounts auf der Onboarding-Seite bestätigst du, dass du diese Bedingungen gelesen und akzeptiert hast. IP-Adresse, User-Agent, Zeitstempel und Versionsnummer werden für den Audit-Trail im Klar-Backend gespeichert (Tabelle affiliate_agreements).",
    boxAffiliate: "Affiliate",
    boxContact: "Kontakt  ",
    boxProgram: "Programm ",
    boxLink: "Link     ",
    boxShare: "Anteil   ",
    boxSigned: "Signiert ",
    shareUnit: (pct: number, months: number) => `${pct}% für ${months} Monate`,
    footer: (version: string, handle: string, app: string) => `Affiliate-Vertrag ${version} - @${handle} - ${app}`,
    pageWord: "Seite",
    bottomNote: "Anbieter Alain Kessler (CH Einzelfirma) - alain@getklar.org - getklar.org/legal/affiliate-agreement",
    sigHeading: "Unterschrift des Affiliates",
    sigName: "Name      ",
    sigDate: "Datum     ",
    sigVersion: "Version   ",
    sigNote: "Elektronisch signiert durch Eingabe des vollen Namens im getklar.org/affiliate Onboarding. IP-Adresse, User-Agent und Zeitstempel werden zusammen mit diesem Dokument im Klar-Backend gespeichert.",
    sections: AGREEMENT_SECTIONS_DE,
  },
  en: {
    docTitle: (app: string) => `Affiliate Agreement - ${app}`,
    docHeader: (app: string) => `Affiliate Agreement - ${app}`,
    docSub: (version: string) => `Version ${version} - as of 21 May 2026 - signed via getklar.org/affiliate onboarding`,
    introNote: "These terms govern participation in the Klar Affiliate Program. By activating your affiliate account on the onboarding page, you confirm that you have read and accepted these terms. The German version of this agreement (getklar.org/legal/affiliate-agreement) is the legally binding original; this English translation is provided for convenience. IP address, user agent, timestamp and version are recorded in the Klar backend audit trail (table affiliate_agreements).",
    boxAffiliate: "Affiliate",
    boxContact: "Contact  ",
    boxProgram: "Program  ",
    boxLink: "Link     ",
    boxShare: "Share    ",
    boxSigned: "Signed   ",
    shareUnit: (pct: number, months: number) => `${pct}% for ${months} months`,
    footer: (version: string, handle: string, app: string) => `Affiliate Agreement ${version} - @${handle} - ${app}`,
    pageWord: "Page",
    bottomNote: "Provider Alain Kessler (CH sole proprietorship) - alain@getklar.org - getklar.org/legal/affiliate-agreement-en",
    sigHeading: "Affiliate Signature",
    sigName: "Name      ",
    sigDate: "Date      ",
    sigVersion: "Version   ",
    sigNote: "Signed electronically by typing the full legal name in the getklar.org/affiliate onboarding. IP address, user agent and timestamp are stored together with this document in the Klar backend.",
    sections: AGREEMENT_SECTIONS_EN,
  },
} as const;

// pdf-lib StandardFonts.Helvetica is WinAnsi-encoded. Rewrite the small set of
// unicode glyphs we know slip into copy so the PDF never throws "WinAnsi cannot
// encode character" at render time. German umlauts are NOT in this list because
// WinAnsi maps them natively.
function sanitiseForWinAnsi(s: string): string {
  return s
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[„‚]/g, '"')
    .replace(/…/g, "...")
    .replace(/•/g, "-")
    .replace(/ /g, " ");
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface PdfCtx {
  pdf: PDFDocument;
  page: any;
  width: number;
  height: number;
  marginX: number;
  marginTop: number;
  marginBottom: number;
  y: number;
  fontRegular: any;
  fontBold: any;
  fontItalic: any;
  fontMono: any;
  footerText: string;
  pageWord: string;
}

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    let current = "";
    for (const word of words) {
      const candidate = current ? current + " " + word : word;
      const w = font.widthOfTextAtSize(candidate, size);
      if (w <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          let chunk = "";
          for (const ch of word) {
            const cw = font.widthOfTextAtSize(chunk + ch, size);
            if (cw > maxWidth) {
              if (chunk) lines.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function drawFooter(ctx: PdfCtx): void {
  ctx.page.drawText(ctx.footerText, {
    x: ctx.marginX,
    y: ctx.marginBottom - 8,
    size: 8,
    font: ctx.fontMono,
    color: rgb(0.55, 0.6, 0.7),
  });
  const pageNo = `${ctx.pageWord} ${ctx.pdf.getPageCount()}`;
  const w = ctx.fontMono.widthOfTextAtSize(pageNo, 8);
  ctx.page.drawText(pageNo, {
    x: ctx.width - ctx.marginX - w,
    y: ctx.marginBottom - 8,
    size: 8,
    font: ctx.fontMono,
    color: rgb(0.55, 0.6, 0.7),
  });
}

function newPage(ctx: PdfCtx): void {
  drawFooter(ctx);
  ctx.page = ctx.pdf.addPage([ctx.width, ctx.height]);
  ctx.y = ctx.height - ctx.marginTop;
}

function ensureRoom(ctx: PdfCtx, needed: number): void {
  if (ctx.y - needed < ctx.marginBottom + 24) {
    newPage(ctx);
  }
}

function drawParagraph(ctx: PdfCtx, raw: string, opts: {
  size?: number;
  font?: "regular" | "bold" | "italic";
  color?: ReturnType<typeof rgb>;
  lineHeight?: number;
  spaceAfter?: number;
  maxWidth?: number;
}): void {
  const size = opts.size ?? 10.5;
  const font = opts.font === "bold" ? ctx.fontBold : opts.font === "italic" ? ctx.fontItalic : ctx.fontRegular;
  const color = opts.color ?? rgb(0.13, 0.18, 0.28);
  const lh = opts.lineHeight ?? size * 1.45;
  const spaceAfter = opts.spaceAfter ?? 6;
  const maxWidth = opts.maxWidth ?? (ctx.width - ctx.marginX * 2);

  const clean = sanitiseForWinAnsi(raw);
  const lines = wrapText(clean, font, size, maxWidth);
  for (const line of lines) {
    ensureRoom(ctx, lh);
    ctx.page.drawText(line, { x: ctx.marginX, y: ctx.y - size, size, font, color });
    ctx.y -= lh;
  }
  ctx.y -= spaceAfter;
}

function drawDivider(ctx: PdfCtx, opts?: { color?: ReturnType<typeof rgb>; spaceAfter?: number }): void {
  ensureRoom(ctx, 12);
  ctx.page.drawLine({
    start: { x: ctx.marginX, y: ctx.y },
    end: { x: ctx.width - ctx.marginX, y: ctx.y },
    thickness: 0.6,
    color: opts?.color ?? rgb(0.85, 0.87, 0.92),
  });
  ctx.y -= (opts?.spaceAfter ?? 14);
}

function drawDataBox(ctx: PdfCtx, rows: ReadonlyArray<{ label: string; value: string }>): void {
  const innerPadX = 14;
  const innerPadY = 14;
  const rowH = 18;
  const boxH = innerPadY * 2 + rowH * rows.length;
  ensureRoom(ctx, boxH + 14);
  const top = ctx.y;
  const left = ctx.marginX;
  const right = ctx.width - ctx.marginX;

  ctx.page.drawRectangle({
    x: left,
    y: top - boxH,
    width: right - left,
    height: boxH,
    color: rgb(0.97, 0.98, 1.0),
    borderColor: rgb(0.85, 0.88, 0.94),
    borderWidth: 0.8,
  });

  let cursor = top - innerPadY - 10;
  const labelSize = 8.5;
  const valSize = 10.5;
  for (const r of rows) {
    ctx.page.drawText(sanitiseForWinAnsi(r.label).toUpperCase(), {
      x: left + innerPadX,
      y: cursor,
      size: labelSize,
      font: ctx.fontMono,
      color: rgb(0.4, 0.46, 0.56),
    });
    const labelW = ctx.fontMono.widthOfTextAtSize(sanitiseForWinAnsi(r.label).toUpperCase(), labelSize);
    ctx.page.drawText(sanitiseForWinAnsi(r.value), {
      x: left + innerPadX + labelW + 12,
      y: cursor,
      size: valSize,
      font: ctx.fontRegular,
      color: rgb(0.06, 0.09, 0.16),
    });
    cursor -= rowH;
  }
  ctx.y = top - boxH - 16;
}

// Signature block — only drawn when a signer name is present. Renders the typed
// name large in an oblique face above a signature line, plus a small metadata
// box (name, date, version) and the audit note.
function drawSignatureBlock(
  ctx: PdfCtx,
  p: AgreementPdfInput,
  L: { sigHeading: string; sigName: string; sigDate: string; sigVersion: string; sigNote: string },
  lang: AgreementLang,
): void {
  const signer = (p.signer_name ?? "").trim();
  if (!signer) return;

  ensureRoom(ctx, 150);
  drawDivider(ctx, { spaceAfter: 16 });

  // Heading
  drawParagraph(ctx, L.sigHeading, {
    size: 9,
    font: "bold",
    color: rgb(0.4, 0.46, 0.56),
    spaceAfter: 14,
  });

  // The typed signature, rendered large + oblique so it reads as a signature.
  const sigSize = 26;
  ensureRoom(ctx, sigSize + 24);
  ctx.page.drawText(sanitiseForWinAnsi(signer), {
    x: ctx.marginX + 4,
    y: ctx.y - sigSize,
    size: sigSize,
    font: ctx.fontItalic,
    color: rgb(0.08, 0.1, 0.18),
  });
  ctx.y -= sigSize + 8;

  // Signature line
  ctx.page.drawLine({
    start: { x: ctx.marginX, y: ctx.y },
    end: { x: ctx.marginX + 280, y: ctx.y },
    thickness: 0.8,
    color: rgb(0.5, 0.55, 0.64),
  });
  ctx.y -= 18;

  const dateStr = formatDate(p.signed_at, lang);
  const signedStamp = new Date(p.signed_at).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  drawDataBox(ctx, [
    { label: L.sigName, value: signer },
    { label: L.sigDate, value: `${dateStr} (${signedStamp})` },
    { label: L.sigVersion, value: p.agreement_version },
  ]);

  drawParagraph(ctx, L.sigNote, {
    size: 9,
    font: "italic",
    color: rgb(0.4, 0.46, 0.56),
    spaceAfter: 4,
  });
}

export async function renderAgreementPdf(p: AgreementPdfInput): Promise<Uint8Array> {
  const lang = pickLang(p);
  const L = PDF_I18N[lang];
  const pdf = await PDFDocument.create();
  pdf.setTitle(L.docTitle(p.app_name));
  pdf.setAuthor("Alain Kessler / Klar");
  pdf.setSubject(`${L.docTitle(p.app_name)} ${p.agreement_version} - @${p.handle}`);
  pdf.setCreator("Klar Affiliate Onboarding");
  pdf.setProducer("pdf-lib");
  pdf.setCreationDate(new Date(p.signed_at));

  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const fontMono = await pdf.embedFont(StandardFonts.Courier);

  const A4_W = 595.28;
  const A4_H = 841.89;
  const page = pdf.addPage([A4_W, A4_H]);
  const ctx: PdfCtx = {
    pdf,
    page,
    width: A4_W,
    height: A4_H,
    marginX: 56,
    marginTop: 60,
    marginBottom: 60,
    y: A4_H - 60,
    fontRegular,
    fontBold,
    fontItalic,
    fontMono,
    footerText: L.footer(p.agreement_version, p.handle, p.app_name),
    pageWord: L.pageWord,
  };

  // Header line: KLAR + Date
  ctx.page.drawText("KLAR", {
    x: ctx.marginX,
    y: ctx.y - 8,
    size: 11,
    font: ctx.fontMono,
    color: rgb(0.32, 0.31, 0.51),
  });
  const dateStr = formatDate(p.signed_at, lang);
  const dateW = ctx.fontMono.widthOfTextAtSize(dateStr, 9);
  ctx.page.drawText(dateStr, {
    x: ctx.width - ctx.marginX - dateW,
    y: ctx.y - 8,
    size: 9,
    font: ctx.fontMono,
    color: rgb(0.4, 0.46, 0.56),
  });
  ctx.y -= 36;

  drawParagraph(ctx, L.docHeader(p.app_name), {
    size: 24,
    font: "bold",
    color: rgb(0.06, 0.09, 0.16),
    lineHeight: 28,
    spaceAfter: 4,
  });
  drawParagraph(ctx, L.docSub(p.agreement_version), {
    size: 10,
    font: "italic",
    color: rgb(0.4, 0.46, 0.56),
    spaceAfter: 18,
  });
  drawDivider(ctx, { spaceAfter: 18 });

  // Affiliate metadata box (no promo row)
  drawDataBox(ctx, [
    { label: L.boxAffiliate, value: `${p.display_name} (@${p.handle})` },
    { label: L.boxContact, value: p.contact_email },
    { label: L.boxProgram, value: p.app_name },
    { label: L.boxLink, value: p.tracking_url },
    { label: L.boxShare, value: L.shareUnit(p.commission_pct, p.attribution_months) },
    { label: L.boxSigned, value: new Date(p.signed_at).toISOString().replace("T", " ").slice(0, 19) + " UTC" },
  ]);

  drawParagraph(ctx, L.introNote, { size: 10.5, color: rgb(0.28, 0.32, 0.42), spaceAfter: 18 });

  // Sections
  for (const sec of L.sections) {
    ensureRoom(ctx, 60);
    const numSize = 9;
    const titleSize = 13;
    ctx.page.drawText(sec.n, {
      x: ctx.marginX,
      y: ctx.y - titleSize,
      size: numSize,
      font: ctx.fontMono,
      color: rgb(0.4, 0.46, 0.56),
    });
    const numW = ctx.fontMono.widthOfTextAtSize(sec.n, numSize);
    ctx.page.drawText(sanitiseForWinAnsi(sec.title), {
      x: ctx.marginX + numW + 12,
      y: ctx.y - titleSize,
      size: titleSize,
      font: ctx.fontBold,
      color: rgb(0.06, 0.09, 0.16),
    });
    ctx.y -= titleSize + 10;
    for (const para of sec.body) {
      drawParagraph(ctx, para, { size: 10.5, color: rgb(0.18, 0.22, 0.32), spaceAfter: 8 });
    }
    ctx.y -= 6;
  }

  // Signature block (typed-name e-signature) — skipped when no signer name.
  drawSignatureBlock(ctx, p, L, lang);

  drawDivider(ctx, { spaceAfter: 12 });
  drawParagraph(ctx, L.bottomNote, {
    size: 9, color: rgb(0.4, 0.46, 0.56), font: "italic", spaceAfter: 4,
  });

  drawFooter(ctx);

  return await pdf.save();
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Deterministic, filesystem-safe filename for the downloaded / stored PDF.
export function agreementPdfFilename(appSlug: string, handle: string, signedAtIso: string, lang: AgreementLang): string {
  const dateSlug = new Date(signedAtIso).toISOString().slice(0, 10);
  const word = lang === "en" ? "agreement" : "vertrag";
  return `klar-affiliate-${word}-${appSlug}-${handle}-${dateSlug}.pdf`.replace(/[^a-zA-Z0-9._-]/g, "_");
}
