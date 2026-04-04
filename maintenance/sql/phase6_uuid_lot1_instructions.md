# Instruções para Execução do Lote 1 (Migração para UUID)

1. Vá até o SQL Editor no Supabase.
2. Execute o conteúdo do arquivo `maintenance/sql/phase6_uuid_lot1.sql`. Este script fará a migração das tabelas `pro_sectors` e `pro_staff` para UUID, preservando a matrícula em `registration_id`.
3. Em seguida, execute o conteúdo do arquivo `maintenance/sql/phase6_uuid_lot1_rpcs.sql`. Este script atualizará as funções RPC (Data Healer) para suportarem os novos UUIDs.
4. Após executar os scripts, recarregue a aplicação e teste a criação de um novo Colaborador e um novo Setor.
