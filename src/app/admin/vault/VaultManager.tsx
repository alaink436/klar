"use client";

// Vault management UI built on the real Radix UI primitives:
//   - DropdownMenu  -> per-row actions (copy proxy URL, rotate, delete)
//   - Dialog        -> add a key / rotate a key (forms POST to /admin/vault/save)
//   - AlertDialog   -> destructive delete confirm
// Radix ships unstyled; the CSS below themes it with the admin tokens. Plaintext
// keys are never shown (vault guarantee) — only metadata + actions.

import { useEffect, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import * as AlertDialog from "@radix-ui/react-alert-dialog";

export interface VaultRow {
  id: string;
  label: string;
  provider: string;
  baseUrl: string;
  proxy: string;
  lastUsed: string;
}

const CSS = `
.vm-bar{display:flex;align-items:center;justify-content:flex-end;margin:0 0 14px}
.vm-dots{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);border:1px solid var(--line);background:var(--surface);color:var(--fg-2);cursor:pointer;transition:background .15s,border-color .15s}
.vm-dots:hover{background:var(--surface-2);border-color:var(--line-strong);color:var(--fg)}
.vm-copy-done{color:var(--success)!important}

/* Radix portals render to <body> → these rules are global */
[data-radix-popper-content-wrapper]{z-index:130}
.vm-menu{min-width:190px;background:var(--surface);border:1px solid var(--line-strong);border-radius:var(--radius);box-shadow:var(--shadow-lg);padding:6px;font-family:var(--font-body),sans-serif}
[data-theme="dark"] .vm-menu{background:rgba(20,20,20,.92);backdrop-filter:blur(20px) saturate(120%);-webkit-backdrop-filter:blur(20px) saturate(120%)}
.vm-mi{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:var(--radius-sm);font-size:13px;color:var(--fg-2);cursor:pointer;outline:none;user-select:none}
.vm-mi[data-highlighted]{background:var(--surface-2);color:var(--fg)}
.vm-mi.danger{color:var(--danger)}
.vm-mi.danger[data-highlighted]{background:color-mix(in oklab,var(--danger) 14%,transparent);color:var(--danger)}
.vm-sep{height:1px;background:var(--line);margin:5px 2px}

.vm-overlay{position:fixed;inset:0;background:rgba(6,6,8,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:131}
.vm-dialog{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(560px,94vw);max-height:90vh;overflow:auto;z-index:132;background:var(--surface);border:1px solid var(--line-strong);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);padding:26px 28px 22px;font-family:var(--font-body),sans-serif}
[data-theme="dark"] .vm-dialog{background:rgba(17,17,17,.92);backdrop-filter:blur(28px) saturate(120%);-webkit-backdrop-filter:blur(28px) saturate(120%)}
.vm-dtitle{font-family:var(--font-display),sans-serif;font-weight:700;font-size:20px;letter-spacing:-.015em;color:var(--fg);margin:0 0 6px}
.vm-ddesc{font-size:13.5px;color:var(--fg-3);line-height:1.5;margin:0 0 18px}
.vm-form{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.vm-form .full{grid-column:1/-1}
.vm-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:8px}
.vm-actions.full{grid-column:1/-1}
.vm-actions .btn.danger{background:var(--danger);border-color:var(--danger);color:#fff}
.vm-actions .btn.danger:hover{opacity:.92}
`;

function fields(includeMeta: boolean) {
  return (
    <>
      {includeMeta ? (
        <>
          <div className="login-field"><label className="login-label">Label</label><input className="login-input" name="label" required placeholder="z.B. OpenAI Prod" /></div>
          <div className="login-field"><label className="login-label">Provider</label><input className="login-input" name="provider" placeholder="openai" /></div>
          <div className="login-field full"><label className="login-label">Base-URL</label><input className="login-input" name="base_url" type="url" required placeholder="https://api.openai.com" /></div>
          <div className="login-field"><label className="login-label">Auth-Header</label><input className="login-input" name="auth_header" defaultValue="authorization" /></div>
          <div className="login-field"><label className="login-label">Schema-Prefix</label><input className="login-input" name="auth_scheme" defaultValue="Bearer " /></div>
        </>
      ) : null}
      <div className="login-field full">
        <label className="login-label">API-Key (wird verschlüsselt, danach nicht mehr lesbar)</label>
        <input className="login-input" name="secret" type="password" required autoComplete="new-password" placeholder="sk-…" style={{ fontFamily: "var(--font-mono)" }} />
      </div>
    </>
  );
}

function CopyItem({ text }: { text: string }) {
  return (
    <DropdownMenu.Item
      className="vm-mi"
      onSelect={(e) => {
        e.preventDefault();
        navigator.clipboard.writeText(text).catch(() => {});
      }}
    >
      Proxy-URL kopieren
    </DropdownMenu.Item>
  );
}

export default function VaultManager({ rows }: { rows: VaultRow[] }) {
  const [rotateRow, setRotateRow] = useState<VaultRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<VaultRow | null>(null);
  const [revealRow, setRevealRow] = useState<VaultRow | null>(null);
  const [reveal, setReveal] = useState<{ loading: boolean; key: string | null; error: string | null }>({
    loading: false,
    key: null,
    error: null,
  });
  const [revealCopied, setRevealCopied] = useState(false);

  // Fetch the plaintext only while the reveal dialog is open; clear it the
  // moment it closes so it doesn't linger in memory.
  useEffect(() => {
    if (!revealRow) {
      setReveal({ loading: false, key: null, error: null });
      setRevealCopied(false);
      return;
    }
    let cancelled = false;
    setReveal({ loading: true, key: null, error: null });
    const fd = new FormData();
    fd.set("id", revealRow.id);
    fetch("/admin/vault/reveal", { method: "POST", body: fd })
      .then(async (r) => {
        const data = (await r.json().catch(() => ({}))) as { key?: string; error?: string };
        if (cancelled) return;
        if (!r.ok || typeof data.key !== "string") {
          setReveal({ loading: false, key: null, error: data.error || `Fehler ${r.status}` });
        } else {
          setReveal({ loading: false, key: data.key, error: null });
        }
      })
      .catch(() => {
        if (!cancelled) setReveal({ loading: false, key: null, error: "Netzwerkfehler" });
      });
    return () => {
      cancelled = true;
    };
  }, [revealRow]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Add key */}
      <div className="vm-bar">
        <Dialog.Root>
          <Dialog.Trigger asChild>
            <button className="btn pop" type="button">+ Key hinzufügen</button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="vm-overlay" />
            <Dialog.Content className="vm-dialog" aria-describedby={undefined}>
              <Dialog.Title className="vm-dtitle">API-Key hinzufügen</Dialog.Title>
              <Dialog.Description className="vm-ddesc">
                Wird server-seitig AES-256-GCM verschlüsselt. Nur über den Proxy nutzbar, der Klartext ist danach nicht mehr abrufbar.
              </Dialog.Description>
              <form method="POST" action="/admin/vault/save" autoComplete="off" className="vm-form">
                <input type="hidden" name="action" value="add" />
                {fields(true)}
                <div className="vm-actions full">
                  <Dialog.Close asChild><button type="button" className="btn ghost">Abbrechen</button></Dialog.Close>
                  <button type="submit" className="btn">Verschlüsselt speichern</button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          <div className="empty-title">Noch keine Keys im Vault</div>
          <div className="empty-sub">Über „+ Key hinzufügen" einen API-Key ablegen. Er wird verschlüsselt und ist danach nur über den Proxy nutzbar.</div>
        </div>
      ) : (
        <table className="card-table">
          <thead>
            <tr><th>Key</th><th>Proxy-URL</th><th className="r">Zuletzt</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <div style={{ fontWeight: 600, color: "var(--fg)" }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: "var(--fg-4)", fontFamily: "var(--font-mono)" }}>{r.provider} · {r.baseUrl}</div>
                </td>
                <td><code style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", wordBreak: "break-all" }}>{r.proxy}…</code></td>
                <td className="r" style={{ fontVariantNumeric: "tabular-nums", color: "var(--fg-3)" }}>{r.lastUsed}</td>
                <td className="r">
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button className="vm-dots" aria-label="Aktionen">⋯</button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content className="vm-menu" align="end" sideOffset={6}>
                        <CopyItem text={r.proxy} />
                        <DropdownMenu.Item className="vm-mi" onSelect={() => setRevealRow(r)}>Key anzeigen</DropdownMenu.Item>
                        <DropdownMenu.Item className="vm-mi" onSelect={() => setRotateRow(r)}>Key rotieren</DropdownMenu.Item>
                        <DropdownMenu.Separator className="vm-sep" />
                        <DropdownMenu.Item className="vm-mi danger" onSelect={() => setDeleteRow(r)}>Löschen</DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Rotate */}
      <Dialog.Root open={rotateRow !== null} onOpenChange={(o) => !o && setRotateRow(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="vm-overlay" />
          <Dialog.Content className="vm-dialog" aria-describedby={undefined}>
            <Dialog.Title className="vm-dtitle">Key rotieren</Dialog.Title>
            <Dialog.Description className="vm-ddesc">
              Neuer Key für „{rotateRow?.label}". Der alte wird ersetzt; die Proxy-URL bleibt gleich.
            </Dialog.Description>
            <form method="POST" action="/admin/vault/save" autoComplete="off" className="vm-form">
              <input type="hidden" name="action" value="rotate" />
              <input type="hidden" name="id" value={rotateRow?.id ?? ""} />
              {fields(false)}
              <div className="vm-actions full">
                <Dialog.Close asChild><button type="button" className="btn ghost">Abbrechen</button></Dialog.Close>
                <button type="submit" className="btn">Rotieren</button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Reveal (read the plaintext back — admin only) */}
      <Dialog.Root open={revealRow !== null} onOpenChange={(o) => !o && setRevealRow(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="vm-overlay" />
          <Dialog.Content className="vm-dialog" aria-describedby={undefined}>
            <Dialog.Title className="vm-dtitle">Key anzeigen — {revealRow?.label}</Dialog.Title>
            <Dialog.Description className="vm-ddesc">
              Klartext, nur für dich (Admin). Kopier ihn und schließe das Fenster wieder.
            </Dialog.Description>
            {reveal.loading ? (
              <p style={{ color: "var(--fg-3)", fontSize: 14 }}>Entschlüssele…</p>
            ) : reveal.error ? (
              <p style={{ color: "var(--danger)", fontSize: 14 }}>{reveal.error}</p>
            ) : (
              <>
                <code
                  style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 13, background: "var(--surface-2)", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", padding: "14px 16px", color: "var(--fg)", wordBreak: "break-all", lineHeight: 1.5 }}
                >
                  {reveal.key}
                </code>
                <div className="vm-actions" style={{ marginTop: 16 }}>
                  <Dialog.Close asChild><button type="button" className="btn ghost">Schließen</button></Dialog.Close>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      if (reveal.key) {
                        navigator.clipboard.writeText(reveal.key).then(
                          () => { setRevealCopied(true); setTimeout(() => setRevealCopied(false), 1400); },
                          () => {},
                        );
                      }
                    }}
                  >
                    {revealCopied ? "✓ Kopiert" : "Key kopieren"}
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete confirm */}
      <AlertDialog.Root open={deleteRow !== null} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="vm-overlay" />
          <AlertDialog.Content className="vm-dialog">
            <AlertDialog.Title className="vm-dtitle">Vault-Key löschen?</AlertDialog.Title>
            <AlertDialog.Description className="vm-ddesc">
              „{deleteRow?.label}" wird endgültig gelöscht. Agents mit dieser Proxy-URL verlieren den Zugriff. Das lässt sich nicht rückgängig machen.
            </AlertDialog.Description>
            <form method="POST" action="/admin/vault/save" className="vm-actions">
              <input type="hidden" name="action" value="delete" />
              <input type="hidden" name="id" value={deleteRow?.id ?? ""} />
              <AlertDialog.Cancel asChild><button type="button" className="btn ghost">Abbrechen</button></AlertDialog.Cancel>
              <AlertDialog.Action asChild><button type="submit" className="btn danger">Endgültig löschen</button></AlertDialog.Action>
            </form>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
