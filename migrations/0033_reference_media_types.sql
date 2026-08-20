-- Fotos, die auch wirklich ankommen.
--
-- 0029 hat den Bucket mit fuenf Typen aufgemacht: mp4, mov, webm, jpeg, png.
-- Das reicht nicht fuer den Weg, den ein Bild bei Alain tatsaechlich nimmt.
--
--   HEIC/HEIF   das Standardformat der iPhone-Kamera. Ohne diesen Eintrag
--               weist der Bucket ein Foto direkt vom Handy ab, und zwar mit
--               einer Fehlermeldung, die nach einem Defekt aussieht statt nach
--               einer Einstellung.
--   WebP        was ein Screenshot aus dem Browser oder ein Export aus vielen
--               Werkzeugen liefert.
--   GIF         kommt bei Carousels und kurzen Schleifen vor.
--
-- HEIC hat einen Haken, der bewusst in Kauf genommen wird: **kein Browser zeigt
-- es an**. Chrome und Firefox koennen es nicht dekodieren. Die Oberflaeche
-- stellt deshalb keinen Spieler hin, sondern einen Verweis zum Oeffnen — besser
-- als eine schwarze Flaeche, bei der niemand weiss, ob der Upload schiefging.
-- Die Datei ist da und geht nicht verloren; sie laesst sich nur nicht in der
-- Zeile ansehen. Wer sie ansehen koennen will, exportiert sie als JPEG.

update storage.buckets
   set allowed_mime_types = array[
         'video/mp4', 'video/quicktime', 'video/webm',
         'image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'image/heic', 'image/heif'
       ]
 where id = 'referenzen';
