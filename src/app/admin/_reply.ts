// Shared reply-composer assets for the Outreach view (route.ts) and the Inbox
// route (/admin/inbox). The reply cards (full incoming mail + translate +
// template-backed answer composer) appear in both, so the template lookup, the
// <select> options and the client JS live here once. Client selectors scope to
// .reply-card, so the same script drives outreach and inbox cards alike.

import { REPLY_TEMPLATES, type ReplyLang } from "../../lib/replyTemplates";
import { esc } from "./_shared";

// Template-Lookup für den Client (lang -> id -> {subject, body}), `<` escaped
// damit der JSON-Blob den <script>-Kontext nicht sprengt. Einmal beim
// Modul-Load gebaut (REPLY_TEMPLATES ist konstant).
const REPLY_TEMPLATE_JSON: string = (() => {
  const map: Record<string, Record<string, { subject: string; body: string }>> = {};
  for (const lng of Object.keys(REPLY_TEMPLATES) as ReplyLang[]) {
    map[lng] = {};
    for (const tpl of REPLY_TEMPLATES[lng]) map[lng][tpl.id] = { subject: tpl.subject, body: tpl.body };
  }
  return JSON.stringify(map).replace(/</g, "\\u003c");
})();

// Vorlagen-Dropdown: optgroup pro Sprache, value = "lang:id". Default
// selektiert = Interesse-Vorlage in der Sprache des Targets.
export function replyTemplateSelectOptions(defLang: ReplyLang): string {
  return (Object.keys(REPLY_TEMPLATES) as ReplyLang[])
    .map(
      (lng) =>
        `<optgroup label="${lng.toUpperCase()}">` +
        REPLY_TEMPLATES[lng]
          .map(
            (tpl) =>
              `<option value="${esc(lng + ":" + tpl.id)}"${lng === defLang && tpl.id === "interesse" ? " selected" : ""}>${esc(tpl.label)}</option>`,
          )
          .join("") +
        `</optgroup>`,
    )
    .join("");
}

// Client-JS für die Reply-Karten: Vorlage einsetzen, Übersetzen (ruft
// /admin/outreach/translate), Entwurf kopieren. Selektoren scopen auf
// .reply-card, funktioniert daher in Outreach- wie Inbox-Karten.
export const REPLY_INBOX_JS = `
window.KLAR_REPLY_TEMPLATES = ${REPLY_TEMPLATE_JSON};
function klarReplyFill(sel){
  var card = sel.closest('.reply-card'); if(!card) return;
  var parts = (sel.value||'').split(':'); var set = window.KLAR_REPLY_TEMPLATES[parts[0]];
  var tpl = set ? set[parts[1]] : null; if(!tpl) return;
  var name = card.getAttribute('data-name')||''; var handle = card.getAttribute('data-handle')||'';
  function sub(s){return (s||'').replace(/\\{\\{name\\}\\}/g,name).replace(/\\{\\{handle\\}\\}/g,handle);}
  var s = card.querySelector('.reply-subj'); var b = card.querySelector('.reply-text');
  if(s && tpl.subject) s.value = sub(tpl.subject);
  if(b) b.value = sub(tpl.body);
}
function klarTranslate(btn){
  var card = btn.closest('.reply-card'); if(!card) return;
  var src = card.querySelector('.reply-incoming'); var out = card.querySelector('.reply-trans');
  if(!src||!out) return;
  var text = src.getAttribute('data-raw') || src.textContent || '';
  var srcLang = src.getAttribute('data-src-lang') || '';
  out.textContent = 'Übersetze…';
  fetch('/admin/outreach/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text,target:'DE',source:srcLang})})
    .then(function(r){return r.json();})
    .then(function(d){ out.textContent = (d&&d.ok) ? ('['+(d.source||'?')+' \\u2192 DE'+(d.provider?' · '+d.provider:'')+'] '+d.text) : ('Übersetzung fehlgeschlagen: '+((d&&d.error)||'?')); })
    .catch(function(e){ out.textContent = 'Fehler: '+e; });
}
function klarCopyDraft(btn){
  var card = btn.closest('.reply-card'); if(!card) return;
  var b = card.querySelector('.reply-text'); if(!b) return;
  navigator.clipboard.writeText(b.value).then(function(){ var o=btn.textContent; btn.textContent='\\u2713 kopiert'; setTimeout(function(){btn.textContent=o;},1500); }).catch(function(){ btn.textContent='Copy fehlgeschlagen'; });
}
`;
