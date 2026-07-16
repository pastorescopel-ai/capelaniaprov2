-- Correção pontual (backfill): sincroniza as 31 linhas de bible_class_attendees que
-- estavam com unit desatualizado em relação à classe pai (3 classes afetadas, entre
-- abril e junho/2026). Ver migração irmã 20260716_keep_bible_class_attendees_unit_synced.sql
-- para os gatilhos que impedem essa dessincronização de voltar a acontecer.
UPDATE bible_class_attendees a
SET unit = c.unit,
    updated_at = now()
FROM bible_classes c
WHERE a.class_id = c.id
  AND a.unit IS DISTINCT FROM c.unit;
