# 04: Affiliate in Klar Control löschen

Status: bereit
Blockiert von: 01 (Sicherungspunkt, Testgerüst und Seiten-Rundgang), 03 (Outreach löschen)
Aufwand: 3 bis 4 h

**Was zu bauen ist:** Affiliate ist aus Klar Control und von getklar.org verschwunden: keine Creator-Gruppe, keine Auszahlungen, keine Einnahmen, keine App-Detailseiten, keine öffentlichen Onboarding-Seiten, kein Creator-Dashboard. Analytics und App-Nutzung zeigen danach genau dieselben Zahlen wie vorher.

- [ ] Vorab geprüft und im Kommentar festgehalten: hat je ein Affiliate einen Vertrag unterschrieben? Nur dann bleiben die Vertragsseiten stehen, sonst werden sie mit gelöscht
- [ ] Creator-Gruppe, Auszahlungen, Einnahmen, App-Detailseiten und alle Admin-Aktionen rund um Influencer, Freigabe, Versand und Abgleich entfernt
- [ ] Öffentliche Onboarding-Seiten, Creator-Dashboard, die Middleware dieser Pfade und die Affiliate-API-Routen entfernt
- [ ] Inbox ohne Affiliate-Chat und ohne Freigeben/Ablehnen; Übersicht ohne „Auszahlungen fällig" und ohne Affiliate-Badges; Settings ohne Schalter für automatische Freigabe und ohne Affiliate-Benachrichtigungen (Geräte-Einladungen bleiben)
- [ ] App-Verzeichnis geteilt: der Teil für App-Nutzung, stille Apps und Metrik-Cron bleibt, der Affiliate-Teil ist weg; aus `KLAR_ADMIN_APPS` werden nur noch Kürzel, Name, Supabase-URL und Secret-Key gelesen
- [ ] Quellen der Wise-Funktionen im klar-Repo entfernt
- [ ] Rundgang grün, gelöschte Pfade 404; Analytics zeigt weiter Userzahlen
- [ ] `tsc`, `next build`, `lint` ohne neue Fehler; gemergt und auf Production deployt
