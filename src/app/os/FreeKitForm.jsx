"use client";
import { useState } from "react";

export default function FreeKitForm() {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState(null);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/os/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const j = await res.json();
    if (res.ok) setLink(j.url);
    else setErr(j.error || "Something broke. Try again in a minute; the download needs no account either way.");
  }

  return link ? (
    <p style={{ marginTop: "var(--space-4)", marginBottom: 0 }}>
      <a className="btn" href={link} download>Download the kit (zip)</a>
      <span className="fine" style={{ display: "block", marginTop: "var(--space-2)" }}>
        Unzip, double-click SETUP.html. See you inside.
      </span>
    </p>
  ) : (
    <form onSubmit={submit} style={{ marginTop: "var(--space-4)", display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
      <input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="field"
        style={{ flex: "1 1 200px" }}
      />
      <button className="btn" type="submit">Get it</button>
      {err ? <span className="fine" style={{ flexBasis: "100%" }}>{err}</span> : null}
    </form>
  );
}
