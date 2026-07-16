-- Corrige 9 classes bíblicas gravadas como unit='HAB' quando todos os colaboradores
-- reais que participaram delas são, sem exceção, cadastrados como HABA no RH
-- (pro_staff.unit). Causa: toggle de unidade no formulário não descartava o registro
-- em andamento ao trocar de unidade (corrigido no front-end nos hooks use*Form.ts).
-- A cascata do gatilho trg_cascade_class_unit_to_attendees já existente corrige
-- automaticamente as presenças (bible_class_attendees) dessas classes.
UPDATE bible_classes
SET unit = 'HABA', sector_id = 287, sector = 'HIGIENIZACAO E LIMPEZA', updated_at = now()
WHERE id IN ('90154d60-9df8-4f29-9896-782fdef08bca','f4c65806-683a-43e7-9c0e-4d96ff34ba2d','8a5808bf-bbbd-42c8-b9ab-1df8e0a64f7c');

UPDATE bible_classes
SET unit = 'HABA', sector_id = 187, sector = 'ENDOSCOPIA/COLONOSCOPIA', updated_at = now()
WHERE id IN ('8ca65eba-8220-4b2d-babc-834bf4cf0607','cc8ef590-14ce-44cb-b0a1-76691fa51e6b','4243c2bc-c709-412c-8223-aa0771b22966',
'871c82cf-1b3a-4cb2-9941-9bc76f3cdd3c','1584d75c-f34b-4104-a0d6-7bf208f3ea64','3de79e8a-84f9-4c0f-acab-74449025ae90');
