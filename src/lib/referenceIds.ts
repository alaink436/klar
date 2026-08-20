// ERZEUGT von AI-Brain/Projects/_gen_referenzen.py. Nicht von Hand bearbeiten.
//
// Die Kennungen der Referenzvideos aus dem Vault-Manifest
// (AI-Brain/Projects/00-Referenzen.md). Das Posting-Board laesst je Kanal
// eine Referenz benennen; ohne stabile Kennung koennte es auf nichts zeigen.
//
// Die Videodateien selbst liegen lokal und auf Drive, nie in einem Repo. Was
// hier steht, ist nur der Zeiger — und die Liste ist absichtlich kurz, weil
// eine Referenz etwas ist, das jemand abgemessen hat.
//
// Neu erzeugen: python Projects/_gen_referenzen.py im AI-Brain.

export interface ReferenceId {
  /** Stabile Kennung, Form `<projekt>/<id>`. */
  id: string;
  /** Woher sie stammt und was an ihr die Lehre ist. */
  note: string;
}

export const REFERENCE_IDS: readonly ReferenceId[] = [
  { id: "basalt/avow-gym-fyp", note: "Vorlage der ganzen Gym-Serie. 720×1280, 10,17 s, ein Schnitt bei 4,83 s. Bogen mit 102 Frames bei 10 fps. Abgemessen in gym6/SHOTS.md" },
  { id: "basalt/glowup-hiver", note: "Sprechkopf plus Glow-up-Montage, neun Schnitte. Das Vorher steckt im Gesicht. Abgemessen in gym9/REFERENZ.md" },
  { id: "basalt/pollinkerzz-carousel", note: "Kein Video, Foto-Carousel. Muster für die Slideshow-Posts, 60,4K Likes. Siehe ads/README.md" },
  { id: "klar-content-pipeline/01-laugh-manhwa-translator", note: "Format A, Lachanfall. Webtoon-Übersetzer. 1080×1920, Gesicht-Beat 0,0–2,2 s. README" },
  { id: "klar-content-pipeline/02-shock-travel-app", note: "Format A, Schock. Reiseplaner. Pose wird 2,5 s gehalten, es bewegt sich die Kamera" },
  { id: "klar-content-pipeline/03-cry-mise-mealplanner", note: "Format A, Heulen. Bezahlte AD. 720×1280 und trotzdem der stärkste der drei" },
  { id: "klar-content-pipeline/04-pov-lockedin-lovora", note: "Format B, POV am Schreibtisch. Paar-Widget. Nachbau abgemessen in 07-pov-lockedin-lovora-nachbau.md" },
  { id: "klar-content-pipeline/05-pov-fakeargument-lovora", note: "Format B, POV im Bett" },
  { id: "klar-content-pipeline/06-pov-gaming-lovora", note: "Format B, POV beim Gaming" },
  { id: "klar-content-pipeline/07-pov-lockedin-lovora-2", note: "Zweite Fassung von 04, vollständig abgemessen in 07-pov-lockedin-lovora-nachbau.md. Datei liegt nicht im Vault" },
  { id: "trubel/drunktok-heavy-drinkers", note: "Vorlage der Scene-Pack-Schnitte. 1080×1920, 17,2 s, 15 harte Schnitte, Bildinhalt 1:1 mittig auf schwarzem Canvas. Bogen mit 172 Frames bei 10 fps. Abgemessen i" },
  { id: "trubel/stacked-hooks-adriamatz", note: "Vorlage für Hook-vorne-Demo-hinten. Abgemessen an Alains Bildschirmaufnahme vom 2026-08-13, Datei nicht im Vault. hooks/README.md" },
] as const;
