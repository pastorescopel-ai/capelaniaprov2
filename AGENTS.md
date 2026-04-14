# Instruções para o Agente - Capelania HAB

## Ponto de Restauração Estável
A versão **5.0.0-PRO-FINAL** (14/04/2026) é considerada a versão final e funcional do sistema.
Se houver erros graves em modificações futuras, consulte o arquivo `VERSION.md` e considere reverter para o estado funcional desta data.

## Estrutura do Projeto
- **App.tsx**: Componente principal com a lógica de rotas e autenticação.
- **modules/**: Contém as funcionalidades principais (Relatórios, Auditoria, etc.).
- **supabase/**: Configurações do banco de dados.
- **server.ts**: Servidor Express para integração e APIs.
