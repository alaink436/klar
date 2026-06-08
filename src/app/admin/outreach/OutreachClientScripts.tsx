"use client";

// Add-target form client behaviour: collect the checked app checkboxes into the
// hidden `for_apps` field right before the native POST. This stays inline JS
// (mount effect, CSP-safe, runs on first load + after every SPA navigation)
// because the add-form is still an HTML string.
//
// The wave-starter form moved to the <OutreachWaveForm> React component, so its
// cost-calc / template-loader / $2-confirm-guard now live there (controlled
// state), not here.

import { useEffect } from "react";

export default function OutreachClientScripts() {
  useEffect(() => {
    const addForm = document.getElementById("outreach-add-form") as HTMLFormElement | null;
    if (!addForm) return;
    const onAddSubmit = () => {
      const picks = Array.from(
        addForm.querySelectorAll<HTMLInputElement>('input[type=checkbox][name^="for_apps_"]:checked'),
      ).map((c) => c.value);
      const hidden = document.getElementById("for-apps-hidden") as HTMLInputElement | null;
      if (hidden) hidden.value = picks.join(",");
    };
    addForm.addEventListener("submit", onAddSubmit);
    return () => addForm.removeEventListener("submit", onAddSubmit);
  }, []);

  return null;
}
