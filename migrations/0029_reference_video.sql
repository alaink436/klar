-- Das Video an die Referenz hängen, damit man sie ansehen kann.
--
-- Seit 0028 trägt Alain ein, WELCHE Referenzen es gibt. Was fehlte, ist das
-- Video selbst: eine Kennung und ein Satz Notiz sagen nicht, wie der Clip
-- aussieht, und genau darum geht es bei einer Referenz. Bisher hätte man die
-- Datei auf der Platte suchen müssen — und auf einem zweiten Gerät gar nicht.
--
-- Zwei Wege, weil es zwei Fälle gibt:
--
--   video_pfad   Die Datei liegt im Bucket `referenzen`. Das ist der Fall, wenn
--                Alain den Clip hat: hochladen, danach spielt er im Reiter.
--   video_link   Nur eine Adresse (TikTok-Post, Drive-Link). Das ist der Fall
--                bei fremden Videos, die sich nicht herunterladen lassen, und
--                bei `pollinkerzz-carousel`, das gar kein Video ist.
--
-- Beide dürfen gleichzeitig stehen: ein hochgeladener Clip und der Link auf den
-- Originalpost sind nicht dasselbe, und der Link belegt die Herkunft.
--
-- Der Bucket ist PRIVAT. Fremde Videos sind fremdes Material; ein öffentlicher
-- Bucket wäre eine Weiterveröffentlichung, und die Adresse eines öffentlichen
-- Supabase-Objekts ist für immer raus. Das Abspielen läuft deshalb über eine
-- signierte URL, die der Server bei jedem Seitenaufruf frisch zieht.
--
-- 200 MB je Datei: ein Referenzclip ist 10 bis 30 Sekunden. Wer mehr braucht,
-- lädt kein Referenzvideo hoch, sondern hat sich vertan — und ein Limit, das
-- der Bucket setzt, ist verlässlicher als eins in der Oberfläche.

alter table public.klar_reference
  add column if not exists video_pfad text,
  add column if not exists video_link text;

comment on column public.klar_reference.video_pfad is
  'Pfad im privaten Bucket `referenzen`. Gesetzt, wenn die Datei hochgeladen wurde. Abgespielt wird ueber eine signierte URL.';
comment on column public.klar_reference.video_link is
  'Adresse des Originals (TikTok-Post, Drive). Belegt die Herkunft, auch wenn zusaetzlich eine Datei hochgeladen ist.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'referenzen',
  'referenzen',
  false,
  209715200,
  array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

-- Bilder sind mit Absicht erlaubt: `pollinkerzz-carousel` ist ein Foto-Post,
-- und ein Kontaktbogen als JPEG ist fuer eine Referenz oft aussagekraeftiger
-- als der Clip selbst.
