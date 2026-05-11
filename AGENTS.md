# Instruções para o Agente - Capelania HAB

## Ponto de Restauração Estável
- A versão **5.1.0-STABLE** (11/05/2026) é o marco de estabilidade atual com Sincronia de Prestadores e Gestão de PGs funcional.
- A versão **4.5.0-PRE-TENANCY-FINAL** (03/05/2026) é a versão final do sistema mono-hospital.
Se houver erros graves nas modificações para multi-tenancy, consulte o arquivo `VERSION.md` e restaure para o estado deste marco.

## Estrutura do Projeto
- **App.tsx**: Componente principal com a lógica de rotas e autenticação.
- **modules/**: Contém as funcionalidades principais (Relatórios, Auditoria, etc.).
- **supabase/**: Configurações do banco de dados.
- **server.ts**: Servidor Express para integração e APIs.
