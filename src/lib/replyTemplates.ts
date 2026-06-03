// Konversations-Vorlagen für Antworten auf Outreach-Replies. Pro Sprache
// (de/en/es/it/fr) ein Set; {{name}} und {{handle}} werden client-seitig im
// Composer ersetzt (siehe outreachView reply-card JS).
//
// WICHTIG: Diese Vorlagen sind reine Konversation (Interesse, Infos,
// Rückfrage, Absage). Der Onboarding-Link gehört NICHT hier rein — der geht
// ausschliesslich über die explizite "Als Affiliate annehmen"-Aktion raus.
// Nur weil jemand auf die erste Welle antwortet, ist er noch kein Affiliate.
//
// Konditionen spiegeln die Wave-Mail-1 (50% Umsatzbeteiligung, 24 Monate,
// Gratis-Lifetime-Premium, Auszahlung monatlich). Die Vorlage ist ein
// Startpunkt — Alain editiert vor dem Senden frei im Textfeld.

export type ReplyLang = "de" | "en" | "es" | "it" | "fr";

export interface ReplyTemplate {
  id: string;
  label: string; // Anzeige im Dropdown
  subject: string;
  body: string;
}

/** Normalisiert eine beliebige Sprach-Angabe auf eine der 5 unterstützten. */
export function replyLang(raw: string | null | undefined): ReplyLang {
  const v = (raw ?? "").trim().toLowerCase().slice(0, 2);
  if (v === "en" || v === "es" || v === "it" || v === "fr") return v;
  return "de";
}

const DE: ReplyTemplate[] = [
  {
    id: "interesse",
    label: "Interesse + Konditionen",
    subject: "Re: Klar x {{name}}",
    body: `Hi {{name}},

freut mich riesig, dass du Lust hast. Kurz die Eckpunkte:

- Gratis Lifetime-Premium für dich, ohne Bedingungen
- Dein persönlicher Affiliate-Link mit 50% Umsatzbeteiligung auf jedes Premium-Abo das darüber reinkommt, 24 Monate lang, automatisch getrackt
- Auszahlung monatlich (Wise, PayPal oder SEPA)
- Komplette kreative Freiheit, keine Skripte, keine Freigabe-Schleifen

Wenn das für dich passt, sag kurz Bescheid, dann schalte ich dir dein Setup frei und du bekommst deinen Link.

Liebe Grüsse
Alain, Klar Studio`,
  },
  {
    id: "infos",
    label: "Mehr Infos / Loom anbieten",
    subject: "Re: Klar x {{name}}",
    body: `Hi {{name}},

klar, gerne mehr Infos. Ich schicke dir gern ein kurzes Loom-Video (3-4 Min) das die App zeigt, plus zwei, drei Hook-Ideen in deinem Stil.

Sag mir einfach, was dich am meisten interessiert, dann gehe ich gezielt darauf ein.

Liebe Grüsse
Alain, Klar Studio`,
  },
  {
    id: "rueckfrage",
    label: "Rückfrage beantworten",
    subject: "Re: Klar x {{name}}",
    body: `Hi {{name}},

danke für deine Nachricht. [Hier deine Antwort auf ihre Frage.]

Melde dich gern, wenn noch etwas offen ist.

Liebe Grüsse
Alain, Klar Studio`,
  },
  {
    id: "ablehnen",
    label: "Höflich absagen",
    subject: "Re: Klar x {{name}}",
    body: `Hi {{name}},

danke dir fürs Zurückmelden und die offenen Worte. Ich glaube, für den Moment passt es bei uns beiden noch nicht ganz, das ist völlig okay.

Falls sich das später ändert, meld dich jederzeit. Ich wünsch dir weiterhin viel Erfolg mit deinem Content.

Liebe Grüsse
Alain, Klar Studio`,
  },
];

const EN: ReplyTemplate[] = [
  {
    id: "interesse",
    label: "Interest + terms",
    subject: "Re: Klar x {{name}}",
    body: `Hi {{name}},

really glad you're keen. Here are the key points:

- Free lifetime premium for you, no strings
- Your personal affiliate link with 50% revenue share on every premium sub it brings in, for 24 months, tracked automatically
- Payouts monthly (Wise, PayPal or SEPA)
- Full creative freedom, no scripts, no approval cycles

If that works for you, just say the word and I'll unlock your setup so you get your link.

Cheers,
Alain, Klar Studio`,
  },
  {
    id: "infos",
    label: "More info / offer Loom",
    subject: "Re: Klar x {{name}}",
    body: `Hi {{name}},

happy to share more. I can send you a short Loom (3-4 min) walking through the app, plus two or three hook ideas in your style.

Just tell me what matters most to you and I'll focus on that.

Cheers,
Alain, Klar Studio`,
  },
  {
    id: "rueckfrage",
    label: "Answer a question",
    subject: "Re: Klar x {{name}}",
    body: `Hi {{name}},

thanks for your message. [Your answer to their question here.]

Let me know if anything else is open.

Cheers,
Alain, Klar Studio`,
  },
  {
    id: "ablehnen",
    label: "Polite decline",
    subject: "Re: Klar x {{name}}",
    body: `Hi {{name}},

thanks for getting back to me and for being upfront. I think for now it isn't quite the right fit for either of us, and that's totally fine.

If that changes down the line, reach out any time. Wishing you continued success with your content.

Cheers,
Alain, Klar Studio`,
  },
];

const ES: ReplyTemplate[] = [
  {
    id: "interesse",
    label: "Interés + condiciones",
    subject: "Re: Klar x {{name}}",
    body: `Hola {{name}},

me alegra mucho que te interese. Estos son los puntos clave:

- Premium de por vida gratis para ti, sin compromisos
- Tu enlace de afiliado personal con un 50% de participación en los ingresos de cada suscripción premium que genere, durante 24 meses, con seguimiento automático
- Pagos mensuales (Wise, PayPal o SEPA)
- Total libertad creativa, sin guiones ni ciclos de aprobación

Si te encaja, dímelo y te activo la configuración para que recibas tu enlace.

Un saludo,
Alain, Klar Studio`,
  },
  {
    id: "infos",
    label: "Más info / ofrecer Loom",
    subject: "Re: Klar x {{name}}",
    body: `Hola {{name}},

claro, encantado de darte más detalles. Puedo enviarte un Loom corto (3-4 min) mostrando la app, además de dos o tres ideas de gancho en tu estilo.

Dime qué es lo que más te interesa y me centro en ello.

Un saludo,
Alain, Klar Studio`,
  },
  {
    id: "rueckfrage",
    label: "Responder una pregunta",
    subject: "Re: Klar x {{name}}",
    body: `Hola {{name}},

gracias por tu mensaje. [Tu respuesta a su pregunta aquí.]

Avísame si queda algo pendiente.

Un saludo,
Alain, Klar Studio`,
  },
  {
    id: "ablehnen",
    label: "Rechazo amable",
    subject: "Re: Klar x {{name}}",
    body: `Hola {{name}},

gracias por responder y por tu sinceridad. Creo que por ahora no es del todo el momento adecuado para ninguno de los dos, y no pasa nada.

Si eso cambia más adelante, escríbeme cuando quieras. Te deseo mucho éxito con tu contenido.

Un saludo,
Alain, Klar Studio`,
  },
];

const IT: ReplyTemplate[] = [
  {
    id: "interesse",
    label: "Interesse + condizioni",
    subject: "Re: Klar x {{name}}",
    body: `Ciao {{name}},

mi fa molto piacere che ti interessi. Ecco i punti principali:

- Premium a vita gratis per te, senza vincoli
- Il tuo link affiliato personale con il 50% di quota sui ricavi di ogni abbonamento premium che porta, per 24 mesi, tracciato automaticamente
- Pagamenti mensili (Wise, PayPal o SEPA)
- Totale libertà creativa, niente copioni né cicli di approvazione

Se ti va bene, fammi sapere e ti attivo il setup così ricevi il tuo link.

A presto,
Alain, Klar Studio`,
  },
  {
    id: "infos",
    label: "Più info / proporre Loom",
    subject: "Re: Klar x {{name}}",
    body: `Ciao {{name}},

certo, volentieri qualche dettaglio in più. Posso mandarti un breve Loom (3-4 min) che mostra l'app, più due o tre idee di hook nel tuo stile.

Dimmi solo cosa ti interessa di più e mi concentro su quello.

A presto,
Alain, Klar Studio`,
  },
  {
    id: "rueckfrage",
    label: "Rispondere a una domanda",
    subject: "Re: Klar x {{name}}",
    body: `Ciao {{name}},

grazie per il tuo messaggio. [Qui la tua risposta alla sua domanda.]

Fammi sapere se è rimasto qualcosa in sospeso.

A presto,
Alain, Klar Studio`,
  },
  {
    id: "ablehnen",
    label: "Rifiuto cortese",
    subject: "Re: Klar x {{name}}",
    body: `Ciao {{name}},

grazie per la risposta e per la tua sincerità. Credo che per ora non sia proprio il momento giusto per entrambi, e va benissimo così.

Se in futuro cambia qualcosa, scrivimi quando vuoi. Ti auguro buon proseguimento con i tuoi contenuti.

A presto,
Alain, Klar Studio`,
  },
];

const FR: ReplyTemplate[] = [
  {
    id: "interesse",
    label: "Intérêt + conditions",
    subject: "Re: Klar x {{name}}",
    body: `Salut {{name}},

ravi que ça te tente. Voici les points clés :

- Premium à vie offert pour toi, sans condition
- Ton lien d'affilié personnel avec 50% de partage des revenus sur chaque abonnement premium qu'il génère, pendant 24 mois, suivi automatiquement
- Paiements mensuels (Wise, PayPal ou SEPA)
- Liberté créative totale, sans script ni cycle de validation

Si ça te convient, dis-le moi et j'active ta configuration pour que tu reçoives ton lien.

À bientôt,
Alain, Klar Studio`,
  },
  {
    id: "infos",
    label: "Plus d'infos / proposer Loom",
    subject: "Re: Klar x {{name}}",
    body: `Salut {{name}},

avec plaisir pour plus de détails. Je peux t'envoyer un court Loom (3-4 min) qui présente l'app, plus deux ou trois idées d'accroche dans ton style.

Dis-moi simplement ce qui t'intéresse le plus et je me concentre là-dessus.

À bientôt,
Alain, Klar Studio`,
  },
  {
    id: "rueckfrage",
    label: "Répondre à une question",
    subject: "Re: Klar x {{name}}",
    body: `Salut {{name}},

merci pour ton message. [Ta réponse à sa question ici.]

Dis-moi s'il reste quoi que ce soit en suspens.

À bientôt,
Alain, Klar Studio`,
  },
  {
    id: "ablehnen",
    label: "Refus poli",
    subject: "Re: Klar x {{name}}",
    body: `Salut {{name}},

merci d'avoir répondu et pour ta franchise. Je pense que pour l'instant ce n'est pas tout à fait le bon moment pour nous deux, et c'est tout à fait ok.

Si ça change plus tard, écris-moi quand tu veux. Je te souhaite plein de succès avec ton contenu.

À bientôt,
Alain, Klar Studio`,
  },
];

export const REPLY_TEMPLATES: Record<ReplyLang, ReplyTemplate[]> = {
  de: DE,
  en: EN,
  es: ES,
  it: IT,
  fr: FR,
};
