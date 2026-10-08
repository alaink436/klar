"use client";

// Origin-UI / shadcn OTP field, built on the real `input-otp` package.
// Renders one hidden input (name=totp) plus six visual slots, split 3+3 with
// a hairline separator. Auto-submits the surrounding form once six digits are
// entered. Look: the .klar-otp* classes in the "Login" section of admin.css.

import { OTPInput, type SlotProps } from "input-otp";

function Slot(props: SlotProps) {
  return (
    <div className="klar-otp-feld" data-voll={props.char ? "ja" : undefined} data-aktiv={props.isActive ? "ja" : undefined}>
      {props.char ?? ""}
      {props.hasFakeCaret ? <span className="klar-otp-caret" aria-hidden="true" /> : null}
    </div>
  );
}

export default function OtpField() {
  return (
    <OTPInput
      maxLength={6}
      name="totp"
      autoFocus
      inputMode="numeric"
      pattern="\d*"
      containerClassName="klar-otp"
      onComplete={() => {
        const root = document.getElementById("otp-root");
        const form = root?.closest("form");
        if (form) {
          if (form.requestSubmit) form.requestSubmit();
          else form.submit();
        }
      }}
      render={({ slots }) => (
        <div id="otp-root" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
          <div className="klar-otp-gruppe">
            {slots.slice(0, 3).map((slot, i) => (
              <Slot key={i} {...slot} />
            ))}
          </div>
          <span className="klar-otp-trenner" aria-hidden="true" />
          <div className="klar-otp-gruppe">
            {slots.slice(3, 6).map((slot, i) => (
              <Slot key={i + 3} {...slot} />
            ))}
          </div>
        </div>
      )}
    />
  );
}
