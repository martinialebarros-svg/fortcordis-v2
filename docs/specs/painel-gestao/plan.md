# Plano

1. Reutilizar modelos operacionais e regras de jornada da Agenda; separar agregações financeiras e de capacidade.
2. API `/api/v1/gestao` exclusiva para administrador; consulta sem gravação.
3. Persistir apenas premissas explicitamente salvas, em tabela própria com versão, contexto, autor e auditoria atômica. Conflito concorrente retorna 409.
4. Tela `/gestao`, navegação administrativa, filtros, comparação, fórmulas, registros e lacunas em português.
5. Testes sintéticos de cálculos, datas, exclusões, permissões, revisão concorrente e interface; lint, tipos, build e SDD.

## Migração e reversão

A migração do runner Python existente cria `gestao_premissas` sem semear custos, saldo ou metas. PostgreSQL ativa RLS e revoga acesso direto de PUBLIC, anon e authenticated; somente a API administrativa autorizada usa a tabela. Não há mudanças no contrato de autenticação nem integração nova ao SDK Supabase. Reversão: retirar router/navegação e conservar a tabela para preservar as premissas e sua auditoria; não há necessidade de reverter dados operacionais. Migração ausente produz erro recuperável para salvar/ler premissas, enquanto a simulação permanece independente dessa tabela.
