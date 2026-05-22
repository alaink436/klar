# Klar-Affiliate Email-Templates (Supabase Auth)

Stand: 2026-05-22. Copy-Paste in das anime-vault Supabase-Projekt:
**Authentication → Emails → Templates**.

Variables (Supabase rendert automatisch):
- `{{ .ConfirmationURL }}` → der Action-Link (confirm/magic/reset).
- `{{ .Email }}` → User-Email.
- `{{ .SiteURL }}` → kommt aus URL Configuration (sollte
  `https://getklar.org` sein).

---

## 1. Confirm Signup

**Subject:**
```
Bestätige dein Affiliate-Konto bei Klar
```

**Message (HTML):**
```html
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0a0c;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#141418;border:1px solid #2a2a30;border-radius:14px;padding:36px 32px;">
          <tr>
            <td>
              <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#888;margin-bottom:10px;font-family:ui-monospace,Menlo,monospace;">
                Klar &middot; Affiliate
              </div>
              <h1 style="font-size:32px;line-height:1.1;letter-spacing:-0.6px;margin:0 0 14px;color:#f5f5f7;font-weight:600;">
                Bestätige dein <i style="font-family:Georgia,serif;color:#fff;">Konto</i>.
              </h1>
              <p style="font-size:15px;line-height:1.55;color:#b5b5bd;margin:0 0 24px;">
                Klick den Button unten, dann ist dein Affiliate-Account live. Der Link ist 24 Stunden gültig.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius:10px;background:#f5f5f7;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 28px;color:#0a0a0c;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;">
                      Konto bestätigen
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size:12.5px;line-height:1.55;color:#777;margin:28px 0 0;">
                Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>
                <a href="{{ .ConfirmationURL }}" style="color:#9d9da6;word-break:break-all;">{{ .ConfirmationURL }}</a>
              </p>
              <hr style="border:none;border-top:1px solid #2a2a30;margin:32px 0 16px;">
              <p style="font-size:12px;color:#666;margin:0;line-height:1.6;">
                Du hast dich nicht registriert? Ignoriere diese Mail, dein Konto wird nicht erstellt.<br>
                Fragen? <a href="mailto:alain@getklar.org" style="color:#9d9da6;">alain@getklar.org</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="font-size:11px;color:#555;margin:18px 0 0;">
          Klar &middot; <a href="https://getklar.org" style="color:#777;text-decoration:none;">getklar.org</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 2. Magic Link

**Subject:**
```
Dein Login-Link für das Klar Affiliate-Dashboard
```

**Message (HTML):**
```html
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0a0c;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#141418;border:1px solid #2a2a30;border-radius:14px;padding:36px 32px;">
          <tr>
            <td>
              <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#888;margin-bottom:10px;font-family:ui-monospace,Menlo,monospace;">
                Klar &middot; Affiliate
              </div>
              <h1 style="font-size:32px;line-height:1.1;letter-spacing:-0.6px;margin:0 0 14px;color:#f5f5f7;font-weight:600;">
                Dein <i style="font-family:Georgia,serif;color:#fff;">Magic-Link</i>.
              </h1>
              <p style="font-size:15px;line-height:1.55;color:#b5b5bd;margin:0 0 24px;">
                Klick den Button, du wirst direkt eingeloggt. Der Link ist eine Stunde gültig und nur einmal verwendbar.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius:10px;background:#f5f5f7;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 28px;color:#0a0a0c;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;">
                      Jetzt einloggen
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size:12.5px;line-height:1.55;color:#777;margin:28px 0 0;">
                Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>
                <a href="{{ .ConfirmationURL }}" style="color:#9d9da6;word-break:break-all;">{{ .ConfirmationURL }}</a>
              </p>
              <hr style="border:none;border-top:1px solid #2a2a30;margin:32px 0 16px;">
              <p style="font-size:12px;color:#666;margin:0;line-height:1.6;">
                Hast du den Login nicht angefordert? Dann ignoriere diese Mail.<br>
                Fragen? <a href="mailto:alain@getklar.org" style="color:#9d9da6;">alain@getklar.org</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="font-size:11px;color:#555;margin:18px 0 0;">
          Klar &middot; <a href="https://getklar.org" style="color:#777;text-decoration:none;">getklar.org</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 3. Reset Password (optional, falls später aktiviert)

**Subject:**
```
Passwort zurücksetzen für dein Klar-Affiliate-Konto
```

**Message (HTML):**
```html
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0a0c;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#141418;border:1px solid #2a2a30;border-radius:14px;padding:36px 32px;">
          <tr>
            <td>
              <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#888;margin-bottom:10px;font-family:ui-monospace,Menlo,monospace;">
                Klar &middot; Affiliate
              </div>
              <h1 style="font-size:32px;line-height:1.1;letter-spacing:-0.6px;margin:0 0 14px;color:#f5f5f7;font-weight:600;">
                Passwort <i style="font-family:Georgia,serif;color:#fff;">zurücksetzen</i>.
              </h1>
              <p style="font-size:15px;line-height:1.55;color:#b5b5bd;margin:0 0 24px;">
                Klick den Button, dann kannst du ein neues Passwort setzen. Der Link ist eine Stunde gültig.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius:10px;background:#f5f5f7;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 28px;color:#0a0a0c;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;">
                      Neues Passwort setzen
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size:12.5px;line-height:1.55;color:#777;margin:28px 0 0;">
                Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>
                <a href="{{ .ConfirmationURL }}" style="color:#9d9da6;word-break:break-all;">{{ .ConfirmationURL }}</a>
              </p>
              <hr style="border:none;border-top:1px solid #2a2a30;margin:32px 0 16px;">
              <p style="font-size:12px;color:#666;margin:0;line-height:1.6;">
                Du hast kein neues Passwort angefordert? Dann ignoriere diese Mail.<br>
                Fragen? <a href="mailto:alain@getklar.org" style="color:#9d9da6;">alain@getklar.org</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="font-size:11px;color:#555;margin:18px 0 0;">
          Klar &middot; <a href="https://getklar.org" style="color:#777;text-decoration:none;">getklar.org</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Sender-Identität

Standard-Sender ist `noreply@mail.app.supabase.io`. Für Klar-branded Mails:
- Settings → Authentication → SMTP → "Use custom SMTP server"
- Brevo-Daten eintragen (Server: `smtp-relay.brevo.com`, Port `587`, Login + Master-Key)
- Sender-Name: `Klar`
- Sender-Email: `outreach@getklar.org` (oder eine andere Verifizierte)

Ohne Custom SMTP funktioniert es trotzdem, aber Limit ist niedrig (~4 Mails/h
für Free-Tier) und die Absender-Adresse wirkt nicht professionell.
