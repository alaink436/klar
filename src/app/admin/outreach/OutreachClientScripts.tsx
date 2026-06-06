"use client";

// Outreach wave-form + add-form client behaviour, ported 1:1 from the old inline
// ADD_FORM_JS / WAVE_FORM_JS <script> tags into a useEffect. Why: inline scripts
// injected via dangerouslySetInnerHTML do NOT execute on client-side (SPA) menu
// switches, so once the sidebar became <Link>-based the wave cost-calculator and
// template loader would have been dead after navigating into Outreach. A mount
// effect runs on first load AND after every SPA navigation, and is CSP-safe
// (no eval). The cost arithmetic + selectors are unchanged; submit stays a
// native form POST, and start/route.ts still rejects >= $2 without
// cost_confirmed=1 as the server-side safety net.

import { useEffect } from "react";

type ConfirmOpts = {
  title?: string;
  body?: string;
  variant?: string;
  confirmText?: string;
  cancelText?: string;
  html?: boolean;
};

export default function OutreachClientScripts() {
  useEffect(() => {
    const win = window as Window & {
      __waveCostUsd?: number;
      klarConfirm?: (o: ConfirmOpts) => Promise<boolean>;
    };
    const cleanups: Array<() => void> = [];

    // ── Add-target form: collect checked app boxes into the hidden field ──────
    const addForm = document.getElementById("outreach-add-form") as HTMLFormElement | null;
    if (addForm) {
      const onAddSubmit = () => {
        const picks = Array.from(
          addForm.querySelectorAll<HTMLInputElement>('input[type=checkbox][name^="for_apps_"]:checked'),
        ).map((c) => c.value);
        const hidden = document.getElementById("for-apps-hidden") as HTMLInputElement | null;
        if (hidden) hidden.value = picks.join(",");
      };
      addForm.addEventListener("submit", onAddSubmit);
      cleanups.push(() => addForm.removeEventListener("submit", onAddSubmit));
    }

    // ── Wave-starter form: cost calc + per-app/lang template loader + guard ───
    const f = document.getElementById("wave-form") as HTMLFormElement | null;
    if (f) {
      const display = document.getElementById("wave-cost-display");
      const tplStatus = document.getElementById("wave-template-status");
      const mailDetails = document.getElementById("wave-mail-details") as HTMLDetailsElement | null;
      const mailSummary = document.getElementById("wave-mail-summary");
      const countDisplay = document.getElementById("wave-count-display");
      const subjectInput = f.querySelector<HTMLInputElement>('input[name="mail_subject"]');
      const bodyInput = f.querySelector<HTMLTextAreaElement>('textarea[name="mail_body"]');
      let initialSubject = subjectInput ? subjectInput.value : "";
      let initialBody = bodyInput ? bodyInput.value : "";
      let lastLoadedKey = "";
      let mailDirty = false;

      function calc() {
        if (!f || !display) return;
        const apps = f.querySelectorAll("input.wave-app-chk:checked").length;
        const igChecked = !!f.querySelector('input.wave-plat-chk[value="instagram"]:checked');
        const ttChecked = !!f.querySelector('input.wave-plat-chk[value="tiktok"]:checked');
        const plats = (igChecked ? 1 : 0) + (ttChecked ? 1 : 0);
        const countEl = f.querySelector<HTMLInputElement>('input[name="count_per_app"]');
        const n = parseInt(countEl?.value || "0", 10) || 0;
        const langs = Math.max(1, f.querySelectorAll("input.wave-lang-chk:checked").length);
        if (countDisplay) countDisplay.textContent = String(n);
        const total = apps * langs * plats * n;
        if (total === 0) {
          display.textContent = "— Apps + Plattformen wählen";
          return;
        }
        const buckets = Array.from(
          f.querySelectorAll<HTMLInputElement>("input.wave-size-chk:checked"),
        ).map((c) => c.value);
        const smallBucket = buckets.length > 0 && buckets.every((b) => b === "nano" || b === "micro");
        const scrape = smallBucket ? Math.min(Math.ceil(n * 1.8), 45) : Math.min(Math.ceil(n * 1.2), 30);
        const igUsd = igChecked ? scrape * 0.0023 + Math.ceil(scrape * 0.7) * 0.0023 : 0;
        const ttUsd = ttChecked ? 0.3 : 0;
        const usdPerWave = igUsd + ttUsd;
        const usd = apps * langs * usdPerWave;
        const waves = apps * langs;
        win.__waveCostUsd = usd;
        const smallNote = smallBucket
          ? ' <span class="muted" style="font-size:10px">(scrape ' + scrape + ")</span>"
          : "";
        const langNote = langs > 1
          ? ' <span class="muted" style="font-size:10px">(' + apps + " App × " + langs + " Region)</span>"
          : "";
        display.innerHTML =
          waves + " Wellen · ~" + total.toLocaleString() + " Profile · <strong>≈ $" +
          usd.toFixed(2) + "</strong> Apify" + smallNote + langNote;
      }

      function updateMailSummary() {
        if (!mailSummary || !subjectInput || !bodyInput) return;
        if (mailDirty) mailSummary.textContent = "✎ custom override aktiv";
        else if (mailDetails && mailDetails.open) mailSummary.textContent = "geöffnet — nicht editiert";
        else mailSummary.textContent = "geschlossen = App-Default";
      }

      function loadTemplate() {
        if (!f) return;
        const pickedApps = Array.from(
          f.querySelectorAll<HTMLInputElement>("input.wave-app-chk:checked"),
        ).map((c) => c.value);
        const pickedLangs = Array.from(
          f.querySelectorAll<HTMLInputElement>("input.wave-lang-chk:checked"),
        ).map((c) => c.value);
        if (!subjectInput || !bodyInput) return;
        if (pickedApps.length !== 1 || pickedLangs.length !== 1) {
          if (tplStatus) {
            if (pickedApps.length === 0) tplStatus.textContent = "";
            else if (pickedApps.length > 1 && pickedLangs.length > 1)
              tplStatus.textContent =
                "⚠️ " + pickedApps.length + " App × " + pickedLangs.length + " Region = " +
                pickedApps.length * pickedLangs.length +
                " Wellen, jede zieht ihr eigenes DB-Template (ausser du bearbeitest Subject/Body hier)";
            else if (pickedApps.length > 1)
              tplStatus.textContent =
                "⚠️ Multi-App: jede App nutzt ihr eigenes DB-Template (ausser du bearbeitest Subject/Body hier)";
            else
              tplStatus.textContent =
                "⚠️ Multi-Region: jede Region zieht ihr eigenes DB-Template (ausser du bearbeitest Subject/Body hier)";
          }
          return;
        }
        const app = pickedApps[0];
        const lang = pickedLangs[0];
        const key = app + "|" + lang;
        if (key === lastLoadedKey) return;
        if (tplStatus) tplStatus.textContent = "⏳ lade Template " + app + "/" + lang + "…";
        fetch(
          "/admin/templates/get?app=" + encodeURIComponent(app) + "&language=" + encodeURIComponent(lang),
          { credentials: "same-origin" },
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((tpl) => {
            if (!tpl) {
              if (tplStatus) tplStatus.textContent = "⚠️ Kein Template für " + app + "/" + lang;
              return;
            }
            if (!mailDirty) {
              if (tpl.mail1_subject) {
                subjectInput.value = tpl.mail1_subject;
                initialSubject = tpl.mail1_subject;
              }
              if (tpl.mail1_body) {
                bodyInput.value = tpl.mail1_body;
                initialBody = tpl.mail1_body;
              }
            }
            lastLoadedKey = key;
            if (tplStatus)
              tplStatus.innerHTML =
                "✓ Template <strong>" + app + "/" + lang + "</strong> geladen" +
                (tpl.mail1_subject ? "" : " (Subject leer)");
          })
          .catch((e) => {
            if (tplStatus) tplStatus.textContent = "⚠️ Template-Load fehlgeschlagen: " + e.message;
          });
      }

      function markDirty() {
        if (!subjectInput || !bodyInput) return;
        mailDirty = subjectInput.value !== initialSubject || bodyInput.value !== initialBody;
        updateMailSummary();
      }

      const onChange = (ev: Event) => {
        calc();
        const t = ev.target as HTMLElement | null;
        if (t && t.classList && (t.classList.contains("wave-app-chk") || t.classList.contains("wave-lang-chk")))
          loadTemplate();
      };
      const onInput = () => calc();
      const onSubmit = (ev: Event) => {
        const usd = win.__waveCostUsd || 0;
        let hidden = f.querySelector<HTMLInputElement>('input[name="cost_confirmed"]');
        if (!hidden) {
          hidden = document.createElement("input");
          hidden.type = "hidden";
          hidden.name = "cost_confirmed";
          f.appendChild(hidden);
        }
        if (usd >= 2.0) {
          if (f.dataset.klarConfirmed === "1") {
            f.dataset.klarConfirmed = "";
            hidden.value = "1";
            return; // allow native submit
          }
          ev.preventDefault();
          const proceed = () => {
            hidden!.value = "1";
            f.dataset.klarConfirmed = "1";
            if (f.requestSubmit) f.requestSubmit();
            else f.submit();
          };
          if (win.klarConfirm) {
            win
              .klarConfirm({
                title: "Welle wirklich starten?",
                body: "Geschätzter Apify-Spend: $" + usd.toFixed(2) + ". Wird sofort ausgeführt.",
                variant: "warn",
                confirmText: "Welle starten",
              })
              .then((ok) => {
                if (ok) proceed();
              });
          } else if (window.confirm("Geschätzter Apify-Spend: $" + usd.toFixed(2) + ". Welle starten?")) {
            proceed();
          }
          return;
        }
        hidden.value = "";
      };

      if (subjectInput) subjectInput.addEventListener("input", markDirty);
      if (bodyInput) bodyInput.addEventListener("input", markDirty);
      if (mailDetails) mailDetails.addEventListener("toggle", updateMailSummary);
      f.addEventListener("change", onChange);
      f.addEventListener("input", onInput);
      f.addEventListener("submit", onSubmit);
      calc();
      updateMailSummary();

      cleanups.push(() => {
        if (subjectInput) subjectInput.removeEventListener("input", markDirty);
        if (bodyInput) bodyInput.removeEventListener("input", markDirty);
        if (mailDetails) mailDetails.removeEventListener("toggle", updateMailSummary);
        f.removeEventListener("change", onChange);
        f.removeEventListener("input", onInput);
        f.removeEventListener("submit", onSubmit);
      });
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
