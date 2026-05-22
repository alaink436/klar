# Klar Control — Security Setup

Das `/admin` Dashboard ist ab jetzt durch **drei** Faktoren gesichert:

1. **`KLAR_ADMIN_KEY`** — Static admin-key (was schon vorher da war).
2. **`KLAR_TOTP_SECRET`** — TOTP-Secret. Du brauchst eine Authenticator-App
   (Google Authenticator, Authy, 1Password, iOS Passwords, Bitwarden, …),
   die bei jedem Login einen 6-stelligen Code generiert.
3. **`KLAR_DEVICE_SECRET`** — HMAC-Key für ein langlebiges Device-Cookie.
   Nur Browser, die einmal erfolgreich `KLAR_ADMIN_KEY + TOTP` lieferten,
   erhalten dieses Cookie und können danach das Dashboard öffnen.

Ohne alle drei Variablen verweigert die Login-Seite jede Anmeldung.

---

## Einmaliges Setup

### 1) `KLAR_TOTP_SECRET` generieren

Lokal in einer Shell (PowerShell):

```powershell
# 20 zufällige Bytes → Base32 (kein "=", kein Padding) — kompatibel mit allen Authenticator-Apps
$bytes = New-Object byte[] 20
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
$bits = 0; $buf = 0; $out = ""
foreach ($b in $bytes) { $buf = ($buf -shl 8) -bor $b; $bits += 8; while ($bits -ge 5) { $bits -= 5; $out += $alphabet[($buf -shr $bits) -band 0x1F] } }
if ($bits -gt 0) { $out += $alphabet[($buf -shl (5 - $bits)) -band 0x1F] }
Write-Host "KLAR_TOTP_SECRET=$out"
```

Bash/macOS-Alternative:

```bash
openssl rand 20 | base32 | tr -d '=' | tr -d '\n'; echo
```

Ergebnis sieht aus wie `JBSWY3DPEHPK3PXPABCDEFGH234567XY` — das ist dein TOTP-Secret.

### 2) Secret in deine Authenticator-App eintragen

Manueller Setup in der App (kein QR-Code nötig):

- Issuer: `Klar Control`
- Account: `admin`
- Secret: Base32-String aus Schritt 1
- Algorithm: SHA1, 6 digits, 30s period (Default)

Alternativ otpauth-URL bauen und in einen Online-QR-Renderer stecken:

```
otpauth://totp/Klar%20Control:admin?secret=<DEIN_SECRET>&issuer=Klar%20Control&algorithm=SHA1&digits=6&period=30
```

**Wichtig:** Sichere das Secret auch in einem Passwortmanager (1Password,
Bitwarden). Wenn dein Handy weg ist, kommst du sonst nicht mehr rein.

### 3) `KLAR_DEVICE_SECRET` generieren

```powershell
# 32 zufällige Bytes als Hex
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
```

```bash
openssl rand -hex 32
```

Das ist ein Server-Secret, das nie in eine App eingegeben werden muss.

### 4) Beide Secrets in Vercel setzen

Vercel-Dashboard → `klar` Projekt → Settings → Environment Variables:

| Name                  | Value                       | Environments        |
| --------------------- | --------------------------- | ------------------- |
| `KLAR_TOTP_SECRET`    | Base32 aus Schritt 1        | Production, Preview |
| `KLAR_DEVICE_SECRET`  | Hex-String aus Schritt 3    | Production, Preview |

`KLAR_ADMIN_KEY` ist schon gesetzt. Nicht ändern, wenn alles funktioniert.

Vercel neu deployen oder Redeploy.

### 5) PC und Laptop registrieren

Auf deinem PC:

1. `https://getklar.org/admin` öffnen → Redirect zu `/admin/login`
2. Form zeigt: Admin-Key, Gerätename, TOTP-Code
3. Eingaben:
   - **Admin-Key:** dein `KLAR_ADMIN_KEY`
   - **Gerätename:** `PC` (oder was du willst, nur zur Erkennung)
   - **TOTP-Code:** aktueller 6-stelliger Code aus deiner Authenticator-App
4. Klick "Anmelden" → Redirect zu `/admin` ✅

Browser hat jetzt ein langlebiges `klar_device` Cookie (10 Jahre).

Wiederhole das auf deinem Laptop mit Gerätename `Laptop`.

### 6) Folgende Anmeldungen

Auf einem registrierten Gerät erscheint die Login-Form **nur noch mit
TOTP-Feld** (Admin-Key wird nicht mehr gefragt). Session-Cookie läuft
nach 12 Stunden ab, dann wieder TOTP eintippen.

---

## Recovery / Notfall

### Wenn beide Devices weg sind

In Vercel `KLAR_DEVICE_SECRET` rotieren (neuen Hex generieren, ersetzen,
deployen). Alle bestehenden Device-Cookies werden ungültig. Setup ab
Schritt 5 wiederholen mit dem neuen Cookie-Secret.

`KLAR_ADMIN_KEY` und `KLAR_TOTP_SECRET` müssen **nicht** rotiert werden —
ohne gültiges Device-Cookie kommt sowieso niemand rein.

### Wenn dein Handy mit Authenticator weg ist

Hoffentlich hast du das TOTP-Secret im Passwortmanager. Einfach neu in
eine andere Authenticator-App eintragen, Secret-Wert bleibt gleich.

Falls nicht: `KLAR_TOTP_SECRET` neu generieren (Schritt 1+2+4), bestehende
Authenticator-Einträge auf allen Geräten löschen.

### Wenn ein Browser-Cookie gestohlen wurde

Cookie ist HttpOnly + Secure + SameSite=Strict + Path=/admin — sehr schwer
zu klauen, aber falls doch: `KLAR_DEVICE_SECRET` rotieren, alle Geräte
neu registrieren.

---

## Was wenn nichts geht (Server misconfigured)

Wenn eine der drei Env-Variablen fehlt, zeigt `/admin/login` eine
Setup-Hint-Seite, die genau sagt, welche Variable fehlt. Niemand kommt
rein, bevor du das nicht behoben hast.
