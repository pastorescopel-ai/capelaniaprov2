
# Plano de Recuperação de Dados - Crise de Abril 2026

## 1. Diagnóstico da Causa Raiz
O sistema sofreu uma **Ruptura de Integridade Relacional**. 
A importação de abril utilizou uma lista de RH com novos nomes de setores. Como o sistema priorizava o nome textual em alguns pontos, os colaboradores foram desativados ou desvinculados dos seus PGs originais.

## 2. Passo a Passo para Recuperação

### Fase A: Auditoria (Supabase)
1. Acesse o SQL Editor do seu Supabase.
2. Execute o conteúdo do arquivo `src/diagnostics/DIAGNOSTICO_ABRIL_2026.sql`.
3. Observe se há muitos registros no resultado 3 (Matrículas encerradas em abril). Estes são os seus dados perdidos.

### Fase B: Restauração de Vínculos
1. Execute o arquivo `src/diagnostics/RECOVERY_ABRIL_2026.sql` no Supabase.
2. Este script irá:
   - Reativar colaboradores que o sistema "achou" que tinham saído.
   - Restaurar as matrículas de quem "sumiu" dos PGs em abril.
   - Corrigir vínculos de ID de setor baseados no nome (caso o ID tenha sido corrompido).

### Fase C: Verificação no Sistema
1. Após rodar o SQL, vá em **Admin > Ferramentas de Dados**.
2. Clique em **Iniciar Diagnóstico**. O sistema deve mostrar que a integridade foi restaurada.

## 3. Solução Estrutural (Próximos Passos)
Para que isso não ocorra novamente em Maio:
- O sistema passará a considerar o **ID do Setor (Centro de Custo)** como chave única imutável.
- Se o RH mudar o nome do setor na planilha, o sistema atualizará o nome no banco automaticamente, mantendo o ID intacto.
- A importação de colaboradores agora terá um "Auto-Repair" que vincula o setor pelo ID antes de tentar pelo nome.
