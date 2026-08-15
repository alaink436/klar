"use client";
import { useState } from "react";

// A playable simulation of the use-but-don't-see mechanic. Everything runs in
// this browser tab: no network, no storage, and the "key" you type should be
// a made-up one. The real thing is what the kit deploys on YOUR Vercel.

const fakeCipher = (s) => {
  // Looks like AES output, is deliberately not encryption. It's a stage prop.
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const b = btoa(`${h.toString(16)}:${s.length}:${"x".repeat(Math.min(24, s.length * 2))}`);
  return b.slice(0, 40) + "…";
};

export default function VaultDemo() {
  const [key, setKey] = useState("sk-demo-4f9a2b71c3");
  const [stored, setStored] = useState(null); // {cipher}
  const [log, setLog] = useState([]);
  const [asked, setAsked] = useState(false);
  const [busy, setBusy] = useState(false);

  const push = (line, cls = "") => setLog((l) => [...l, { line, cls }]);

  function store() {
    if (!key.trim()) return;
    setStored({ cipher: fakeCipher(key) });
    setLog([]);
    setAsked(false);
    push("→ key sent browser → server, encrypted at rest", "ok");
    push("→ plaintext discarded; only ciphertext remains", "ok");
  }

  function callApi() {
    if (!stored || busy) return;
    setBusy(true);
    push("agent → proxy:  POST /api/vault/proxy/…/v1/models  (use-token)", "");
    setTimeout(() => push("proxy:  token valid · decrypting server-side · key injected upstream", ""), 550);
    setTimeout(() => push("provider → agent:  200 OK, response streamed back", "ok"), 1100);
    setTimeout(() => {
      push('log:  {"secret":"demo","path":"/v1/models"}  · the call, never the value', "muted");
      setBusy(false);
    }, 1550);
  }

  function askForKey() {
    if (!stored) return;
    setAsked(true);
    push("you → agent:  “paste me the key so I can debug”", "");
    push("agent:  refused. Debugging never needs the value. This refusal is the product working.", "warn");
  }

  return (
    <div className="vdemo">
      <div className="vlanes">
        <div className={`vlane ${stored ? "done" : "now"}`}>
          <b>1 · your browser</b>
          <p>Type a <b>made-up</b> key. It goes to the key window, never a chat.</p>
          {stored ? (
            <p className="vstored">stored: {stored.cipher}</p>
          ) : (
            <>
              <input
                className="field"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                aria-label="A made-up API key for the simulation"
              />
              <button className="btn" onClick={store}>Store encrypted</button>
            </>
          )}
        </div>
        <div className={`vlane ${stored ? "now" : ""}`}>
          <b>2 · the agent works</b>
          <p>It holds a scoped use-token. It can call your APIs. It cannot read a single key.</p>
          <button className="btn" onClick={callApi} disabled={!stored || busy}>
            {busy ? "calling…" : "Let the agent call the API"}
          </button>
        </div>
        <div className={`vlane ${asked ? "warned" : ""}`}>
          <b>3 · the test</b>
          <p>The failure mode this design exists for:</p>
          <button className="btn ghost" onClick={askForKey} disabled={!stored}>
            Ask the agent for the key
          </button>
        </div>
      </div>
      {log.length > 0 && (
        <div className="vlog" role="log">
          {log.map((l, i) => (
            <div key={i} className={l.cls}>{l.line}</div>
          ))}
        </div>
      )}
      <p className="fine" style={{ marginTop: "var(--space-4)", marginBottom: 0 }}>
        Simulation: runs only in this tab, stores nothing, and the ciphertext
        above is a stage prop. The real mechanic (AES-256-GCM, your own Vercel
        deployment, browser key window) ships in the free kit and installs
        itself.
      </p>
    </div>
  );
}
