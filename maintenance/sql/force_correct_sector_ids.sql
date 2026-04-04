-- Script para forçar os IDs corretos dos setores baseados na planilha fornecida
-- Este script é seguro contra colisões de IDs e garante que os vínculos sejam mantidos.

BEGIN;

-- 1. Criar tabela temporária com o mapeamento correto
CREATE TEMP TABLE sector_mapping (
    correct_id BIGINT,
    sector_name TEXT,
    unit TEXT
);

INSERT INTO sector_mapping (correct_id, sector_name, unit) VALUES
(1, 'DIRETORIA', 'HAB'),
(2, 'TESOURARIA', 'HAB'),
(3, 'SAC - SERV ATEND AO CLIENTE', 'HAB'),
(4, 'ASSESSORIA JURIDICA', 'HAB'),
(5, 'ASSESSORIA DE COMUNICAÇÃO', 'HAB'),
(6, 'CONTABILIDADE', 'HAB'),
(8, 'CAIXA CENTRAL', 'HAB'),
(9, 'FATURAMENTO', 'HAB'),
(10, 'AUDITORIA DE CONTAS', 'HAB'),
(11, 'GESTAO DE PESSOAS', 'HAB'),
(12, 'DEPARTAMENTO PESSOAL', 'HAB'),
(13, 'T&D - TREINAMENTO E DESENVOLVIMENTO', 'HAB'),
(14, 'SESMT - SERV SEG MED TRABALHO', 'HAB'),
(15, 'TI INFRAESTRUTURA', 'HAB'),
(16, 'TELEFONIA', 'HAB'),
(18, 'TRANSPORTE', 'HAB'),
(19, 'COMPRAS', 'HAB'),
(20, 'CENTRAL DE OPME', 'HAB'),
(22, 'CAPELANIA', 'HAB'),
(24, 'SAME - SERV ARQ MED EST', 'HAB'),
(29, 'GESTAO DE ENFERMAGEM ', 'HAB'),
(30, 'INTERNAMENTO', 'HAB'),
(31, 'HOTELARIA', 'HAB'),
(32, 'CALL CENTER', 'HAB'),
(33, 'RECEPCAO CONSULTORIOS', 'HAB'),
(34, 'RECEPCAO LABORATORIO', 'HAB'),
(35, 'RECEPCAO DIAGNOSTICO', 'HAB'),
(36, 'RECEPCAO PRONTO ATENDIMENTO', 'HAB'),
(37, 'SERVICO SOCIAL', 'HAB'),
(39, 'UNIDADE DE INTERNACAO 8', 'HAB'),
(40, 'UNIDADE DE INTERNACAO 7', 'HAB'),
(41, 'UNIDADE DE INTERNACAO 6', 'HAB'),
(42, 'UNIDADE DE INTERNACAO 5', 'HAB'),
(43, 'UNIDADE DE INTERNACAO 4', 'HAB'),
(44, 'UNIDADE DE INTERNACAO 2', 'HAB'),
(45, 'UCI - UNID DE CUIDADOS INTENS 1', 'HAB'),
(46, 'CETIN/UTI PEDIATRICO', 'HAB'),
(47, 'CENTRO CIRURGICO', 'HAB'),
(48, 'CONSULTORIOS', 'HAB'),
(49, 'PRONTO ATENDIMENTO ADULTO', 'HAB'),
(50, 'PRONTO ATENDIMENTO INFANTIL', 'HAB'),
(51, 'LABORATORIO ANALISES CLINICAS', 'HAB'),
(54, 'ELETROCARDIOGRAMA', 'HAB'),
(55, 'TESTE ERGOMETRICO', 'HAB'),
(56, 'DENSITOMETRIA', 'HAB'),
(57, 'ELETROENCEFALOGRAMA', 'HAB'),
(58, 'ENDOSCOPIA E COLONOSCOPIA', 'HAB'),
(59, 'RADIOLOGIA', 'HAB'),
(60, 'TOMOGRAFIA', 'HAB'),
(61, 'ULTRASSONOGRAFIA', 'HAB'),
(64, 'RESSONANCIA MAGNETICA', 'HAB'),
(65, 'ONCOLOGIA', 'HAB'),
(66, 'HEMODIALISE', 'HAB'),
(68, 'SAD - SERV ATEND DOMICILIAR', 'HAB'),
(71, 'ALMOXARIFADO', 'HAB'),
(72, 'FARMACIA CENTRAL', 'HAB'),
(74, 'SND - SERV NUTRICAO E DIETETIC', 'HAB'),
(75, 'HIGIENIZACAO E LIMPEZA', 'HAB'),
(77, 'CME - CENT MAT ESTERELIZ', 'HAB'),
(78, 'LAVANDERIA', 'HAB'),
(79, 'COSTURARIA', 'HAB'),
(93, 'CONSTRUCAO', 'HAB'),
(96, 'FAZENDA DA ESTRADA DE MOSQUEIRO', 'HAB'),
(102, 'ESTACIONAMENTO', 'HAB'),
(103, 'AMBULATORIO', 'HAB'),
(104, 'CAF - CENT ABAST FARM', 'HAB'),
(105, 'MANUTENCAO', 'HAB'),
(106, 'TI SISTEMAS', 'HAB'),
(107, 'UNIDADE DE INTERNACAO 3', 'HAB'),
(108, 'LABORATORIO ANATOMO PATOLOGICO', 'HAB'),
(109, 'UCI - UNID DE CUIDADOS INTENS 2', 'HAB'),
(111, 'UCI - UNID DE CUIDADOS INTENS 3', 'HAB'),
(112, 'GQCIH - GEST QUALI INFEC HOSP', 'HAB'),
(114, 'UNIDADE DE INTERNACAO 1', 'HAB'),
(118, 'RECURSOS DE GLOSAS', 'HAB'),
(120, 'FARMACIA SATELITE PRONTO ATEND', 'HAB'),
(121, 'FARMACIA SATELITE C CIRURGICO', 'HAB'),
(126, 'LACTARIO', 'HAB'),
(134, 'MAPA', 'HAB'),
(135, 'ECOCARDIOGRAMA', 'HAB'),
(137, 'FARMACIA SATELITE CTI', 'HAB'),
(140, 'FISIOTERAPIA HOSPITALAR', 'HAB'),
(148, 'EMT - EQUIPE MULT TERAP NUTRI', 'HAB'),
(149, 'Agendamento Cirurgico', 'HAB'),
(150, 'GESTAO DE CONTRATOS', 'HAB'),
(151, 'CONTROLE DE ACESSO', 'HAB'),
(171, 'DIRETORIA', 'HABA'),
(172, 'PRONTO ATENDIMENTO', 'HABA'),
(173, 'PRONTO ATENDIMENTO INFANTIL', 'HABA'),
(174, 'RECEPÇÃO PA', 'HABA'),
(176, 'LAB ANALISES CLINICAS', 'HABA'),
(177, 'RECEPCAO LABORATORIO', 'HABA'),
(179, 'FARMACIA SATELITE PA', 'HABA'),
(186, 'ELETROENCEFALOGRAMA', 'HABA'),
(187, 'ENDOSCOPIA E COLONOSCOPIA', 'HABA'),
(192, 'RESSONANCIA MAGNETICA', 'HABA'),
(194, 'TOMOGRAFIA', 'HABA'),
(196, 'RECEPCAO CONSULTORIOS', 'HABA'),
(197, 'SND - SERV NUTRICAO E DIETETICA', 'HABA'),
(198, 'FATURAMENTO', 'HABA'),
(200, 'HOTELARIA', 'HABA'),
(201, 'CONTROLE DE ACESSO', 'HABA'),
(202, 'TI INFRAESTRUTURA', 'HABA'),
(203, 'MANUTENCAO', 'HABA'),
(204, 'CALL CENTER', 'HABA'),
(206, 'CAIXA CENTRAL', 'HABA'),
(207, 'SESMT SER SEG MED TRABALHO', 'HABA'),
(209, 'RECEPCAO DIAGNOSTICO', 'HABA'),
(218, 'GARANTIA DE SAUDE - ATENDIMENT', 'HAB'),
(222, 'CMAB - UND INTERNAC 1', 'HABA'),
(245, 'GESTÃO DIAGNOSTICO', 'HAB'),
(250, 'HEMODINAMICA INTERNAÇÃO', 'HAB'),
(274, 'Planejamento Institucional', 'HAB'),
(283, 'ENTREGA DE EXAMES', 'HAB'),
(286, 'CONTAS A RECEBER', 'HAB'),
(287, 'CMAB - HIGIENIZACAO E LIMPEZA', 'HABA'),
(288, 'NUTRIÇÃO CLÍNICA', 'HAB');

-- 2. Adicionar coluna temporária em pro_sectors para guardar o ID correto
ALTER TABLE pro_sectors ADD COLUMN IF NOT EXISTS temp_correct_id BIGINT;

-- 3. Mapear o ID correto comparando o nome (ignorando maiúsculas/minúsculas e espaços extras)
UPDATE pro_sectors ps
SET temp_correct_id = sm.correct_id
FROM sector_mapping sm
WHERE lower(regexp_replace(ps.name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(sm.sector_name, '[^a-zA-Z0-9]', '', 'g'))
  AND ps.unit = sm.unit;

-- 4. Para evitar colisões de ID (ex: um setor antigo tem ID 1, mas o novo ID 1 é outro setor),
-- vamos primeiro mover TODOS os IDs atuais para uma faixa alta (ex: +100000)
-- Isso requer remover as constraints temporariamente.

ALTER TABLE pro_groups DROP CONSTRAINT IF EXISTS pro_groups_sector_id_fkey;
ALTER TABLE pro_staff DROP CONSTRAINT IF EXISTS pro_staff_sector_id_fkey;
ALTER TABLE pro_group_locations DROP CONSTRAINT IF EXISTS pro_group_locations_sector_id_fkey;
ALTER TABLE pro_sectors DROP CONSTRAINT IF EXISTS pro_sectors_pkey CASCADE;

-- Mover IDs atuais para faixa segura (apenas se já não estiverem na faixa segura)
UPDATE pro_sectors SET id = id + 100000 WHERE id < 100000;
UPDATE pro_groups SET sector_id = sector_id + 100000 WHERE sector_id < 100000;
UPDATE pro_staff SET sector_id = sector_id + 100000 WHERE sector_id < 100000;
UPDATE bible_study_sessions SET sector_id = sector_id + 100000 WHERE sector_id < 100000;
UPDATE visit_requests SET sector_id = sector_id + 100000 WHERE sector_id < 100000;
UPDATE pro_group_locations SET sector_id = sector_id + 100000 WHERE sector_id < 100000;
UPDATE ambassadors SET sector_id = sector_id + 100000 WHERE sector_id < 100000;
UPDATE pro_history_records SET sector_id = sector_id + 100000 WHERE sector_id < 100000;

-- 5. Agora aplicar os IDs corretos (temp_correct_id) onde houve match
UPDATE pro_groups SET sector_id = (SELECT temp_correct_id FROM pro_sectors WHERE id = pro_groups.sector_id) WHERE sector_id IN (SELECT id FROM pro_sectors WHERE temp_correct_id IS NOT NULL);
UPDATE pro_staff SET sector_id = (SELECT temp_correct_id FROM pro_sectors WHERE id = pro_staff.sector_id) WHERE sector_id IN (SELECT id FROM pro_sectors WHERE temp_correct_id IS NOT NULL);
UPDATE bible_study_sessions SET sector_id = (SELECT temp_correct_id FROM pro_sectors WHERE id = bible_study_sessions.sector_id) WHERE sector_id IN (SELECT id FROM pro_sectors WHERE temp_correct_id IS NOT NULL);
UPDATE visit_requests SET sector_id = (SELECT temp_correct_id FROM pro_sectors WHERE id = visit_requests.sector_id) WHERE sector_id IN (SELECT id FROM pro_sectors WHERE temp_correct_id IS NOT NULL);
UPDATE pro_group_locations SET sector_id = (SELECT temp_correct_id FROM pro_sectors WHERE id = pro_group_locations.sector_id) WHERE sector_id IN (SELECT id FROM pro_sectors WHERE temp_correct_id IS NOT NULL);
UPDATE ambassadors SET sector_id = (SELECT temp_correct_id FROM pro_sectors WHERE id = ambassadors.sector_id) WHERE sector_id IN (SELECT id FROM pro_sectors WHERE temp_correct_id IS NOT NULL);
UPDATE pro_history_records SET sector_id = (SELECT temp_correct_id FROM pro_sectors WHERE id = pro_history_records.sector_id) WHERE sector_id IN (SELECT id FROM pro_sectors WHERE temp_correct_id IS NOT NULL);

-- Atualizar o ID na tabela pro_sectors
UPDATE pro_sectors SET id = temp_correct_id WHERE temp_correct_id IS NOT NULL;

-- 6. Recriar a Primary Key
ALTER TABLE pro_sectors ADD PRIMARY KEY (id);

-- 7. Recriar as Foreign Keys (agora com ON UPDATE CASCADE para facilitar futuras mudanças)
ALTER TABLE pro_groups ADD CONSTRAINT pro_groups_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES pro_sectors(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE pro_staff ADD CONSTRAINT pro_staff_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES pro_sectors(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE pro_group_locations ADD CONSTRAINT pro_group_locations_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES pro_sectors(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- 8. Limpar coluna temporária
ALTER TABLE pro_sectors DROP COLUMN temp_correct_id;

-- 9. Recriar a View bi_active_memberships
DROP VIEW IF EXISTS bi_active_memberships;
CREATE OR REPLACE VIEW bi_active_memberships AS
SELECT 
    m.id as matricula_id,
    p.name as colaborador,
    s.name as setor,
    s.unit as unidade,
    g.name as nome_pg,
    m.joined_at::date as data_entrada,
    m.left_at::date as data_saida,
    CASE WHEN m.left_at IS NULL THEN 'ATIVO' ELSE 'INATIVO' END as status_atual
FROM pro_group_members m
JOIN pro_staff p ON m.staff_id = p.id
JOIN pro_groups g ON m.group_id = g.id
JOIN pro_sectors s ON g.sector_id = s.id;

COMMIT;
