"use client";

// Vertragsauflösung-Bestätigung. Hard-stop: zweite Bestätigung damit ein
// Fehlklick nicht den Account löscht. Submit POSTet an /api/affiliate/
// cancel, das setzt status=cancelled in klar_affiliates + den passenden
// influencers-Rows in jeder App-Supabase.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell, buttonStyle, errorStyle, inputStyle, labelStyle } from "../_shared/auth-shell";

const APP_NAME: Record<string, string> = {
  wavelength: "Wavelength",
  kelva: "Kelva",
  trubel: "Trubel",
  myloo: "MyLoo",
  "yarn-stash": "Yarn-Stash",
  moto: "ThrottleUp",
};

export function CancelForm({ displayName, apps }: { displayName: string | null; apps: string[] }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredPhrase = "AUFLÖSEN";
  const canSubmit = confirmText.trim().toUpperCase() === requiredPhrase && !busy;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/affiliate/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || null }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      router.replace("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Auflösung fehlgeschlagen.");
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Affiliate · Vertrag auflösen"
      title={<>Bist du <i style={{ fontFamily: "var(--font-editorial, serif)" }}>sicher?</i></>}
      intro={
        apps.length === 0
          ? "Wir lösen deinen Affiliate-Account. Bereits verdiente Provisionen werden noch ausgezahlt."
          : `Wir setzen deinen Status in ${apps.length === 1 ? "1 App" : `${apps.length} Apps`} (${apps.map((s) => APP_NAME[s] ?? s).join(", ")}) auf "cancelled". Tracking-Links funktionieren weiter, aber neue Klicks werden nicht mehr provisionsrelevant gezählt.`
      }
      footer={
        <>
          Doch nicht? <Link href="/dashboard" style={{ color: "var(--fg)", fontWeight: 600 }}>Zurück</Link>
        </>
      }
    >
      {displayName && (
        <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: -8, marginBottom: 16 }}>
          Account: <b style={{ color: "var(--fg-2)" }}>{displayName}</b>
        </p>
      )}
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
        <div>
          <label htmlFor="cancel-reason" style={labelStyle}>Grund (optional)</label>
          <input
            id="cancel-reason"
            type="text"
            maxLength={240}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={inputStyle}
            placeholder="z.B. Niche passt nicht mehr"
          />
        </div>
        <div>
          <label htmlFor="cancel-confirm" style={labelStyle}>Tippe AUFLÖSEN zur Bestätigung</label>
          <input
            id="cancel-confirm"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            style={inputStyle}
            autoComplete="off"
          />
        </div>
        {error && <div style={errorStyle}>{error}</div>}
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            ...buttonStyle,
            background: canSubmit ? "#f59e0b" : "color-mix(in oklab, var(--fg), transparent 80%)",
            color: canSubmit ? "#1a1108" : "var(--fg-3)",
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Löse auf…" : "Vertrag auflösen"}
        </button>
      </form>
    </AuthShell>
  );
}
