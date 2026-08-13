-- Das Format gehört an den Account, nicht in die Notiz.
--
-- Bisher stand in der Notiz alles durcheinander: warum ein Account pausiert,
-- was als Nächstes ansteht, und was für Zeug dort überhaupt rausgeht. Das
-- Letzte davon ist die Frage, die vor dem Posten zählt ("was muss ich für den
-- heute produzieren?"), also kriegt es ein eigenes Feld — und kann damit auch
-- in der Tagesliste stehen, wo die Notiz keinen Platz hätte.
--
-- Freitext mit Vorschlägen statt fester Liste: die Formate ändern sich schneller
-- als das Schema, und eine Auswahl, die das gewünschte Format nicht enthält,
-- führt nur dazu, dass jemand "Sonstiges" nimmt.
alter table public.klar_account_status
  add column if not exists format text;

comment on column public.klar_account_status.format is
  'Was auf diesem Account rausgeht (Slideshow, Fast-Cut, Carousel …). Freitext, Vorschläge kommen aus dem, was schon eingetragen ist.';
