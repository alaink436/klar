-- Ein Haken am Account: liegt das Material für die nächsten Posts bereit?
--
-- Das Feld `material` sagt, WO das Zeug liegt; es sagt nicht, OB dort gerade
-- etwas Postbares wartet. Genau daran scheitert der Rhythmus in der Praxis —
-- man öffnet das Board, will abhaken, und merkt erst jetzt, dass nichts
-- geschnitten ist. Der Haken macht das VOR dem geplanten Tag sichtbar.
--
-- Ein boolean und kein Zähler: "wie viele Posts liegen bereit" veraltet mit
-- jedem Post und würde nie gepflegt. Bereit/nicht bereit ist die Auskunft,
-- die man beim Wochenstart einmal setzt und beim Leerposten wieder wegnimmt.
alter table public.klar_account_status
  add column if not exists material_ready boolean not null default false;
