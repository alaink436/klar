"use client";
import { useState } from "react";
import FreeKitForm from "./FreeKitForm";

// The bracket over the two free panels. It exists because the triptych does not
// say out loud that two thirds of it cost nothing: the panels carry "Free
// forever" in small type and that is easy to walk past. This spans exactly those
// two and puts one action in the middle.
//
// Closed it is a single line with a label. Open it is the email field, which is
// the whole transaction: one address, one download, no account.
export default function FreeBracket() {
  const [open, setOpen] = useState(false);

  return (
    <div className="freebracket">
      <div className="freebracket-span">
        <span className="freebracket-rule freebracket-rule-l" aria-hidden="true" />
        <div className="freebracket-mid">
          {open ? (
            <div className="freebracket-form">
              <p className="freebracket-title">Two of the three are free. Where should it go?</p>
              <FreeKitForm />
            </div>
          ) : (
            <button
              type="button"
              className="freebracket-btn"
              onClick={() => setOpen(true)}
              aria-expanded={false}
            >
              Try it out for free
            </button>
          )}
        </div>
        <span className="freebracket-rule freebracket-rule-r" aria-hidden="true" />
      </div>
    </div>
  );
}
