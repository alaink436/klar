# 03: Outreach löschen

Status: in Arbeit
Session: Klar Dashboard entrümpeln (Sub-Agent 03), seit 2026-10-07 21:12
Blockiert von: 01 (Sicherungspunkt, Testgerüst und Seiten-Rundgang)
Aufwand: 2,5 bis 4 h

**Was zu bauen ist:** Outreach existiert in Klar Control nicht mehr: keine Seite, keine Vorlagen, kein Mailer, keine Wellen, kein Evomi, kein Versand-Cron. Die Inbox zeigt nur noch Collabs, Anfragen und (bis Ticket 04) den Affiliate-Chat, die Übersicht keine Outreach-Zeilen mehr. Collab- und Feedback-Mails kommen über den Brevo-Webhook weiter an. Die zwei n8n-Workflows der Outreach laufen nicht mehr. Die Outreach-Tabellen im Hub bleiben samt Daten.

- [ ] Outreach-Seite, Vorlagen-Seite, Mailer, alte Weiterleitungen, Wellen samt Evomi, Speicher-Module und Mail-Versand entfernt
- [ ] Vercel-Cron für den Outreach-Versand entfernt, der Metrik-Cron bleibt
- [ ] Inbox ohne Outreach-Threads, ohne Mailer-Lade, Vorlagen-Manager ohne Outreach-Reiter
- [ ] Übersicht ohne die zwei Outreach-Zeilen
- [ ] Brevo-Webhook ohne Outreach-Zweig; Feedback und Collab werden weiter in dieser Reihenfolge erkannt
- [ ] n8n-Workflows Wave-Consumer (`ykuQ4ZnKHgL8a2ii`) und Heartbeat (`mYc3IvjBnWMcp3ix`) deaktiviert, nicht gelöscht; geht das nicht per API, steht im Kommentar, was Alain tun muss
- [ ] Rundgang grün, gelöschte Pfade 404
- [ ] `tsc`, `next build`, `lint` ohne neue Fehler; gemergt und auf Production deployt
