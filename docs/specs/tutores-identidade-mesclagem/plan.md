# Plan — tutores-identidade-mesclagem

Data: 2026-10-27
Responsavel: Codex
Status: implemented-local

1. [x] Isolar trabalho a partir de origin/stage e preservar alteracoes do checkout principal.
2. [x] Mapear criacao de tutores em cadastros, laudos, formalizacao e ferramentas administrativas.
3. [x] Criar migracao idempotente e modelo de identificacao e proveniencia.
4. [x] Remover equivalencia por nome, preservar reutilizacao explicita por ID e recusar IDs mesclados.
5. [x] Implementar previa, resolucao de conflitos, confirmacao e transacao de mesclagem com historico privado.
6. [x] Integrar identificacao nos formularios e criar tela de tutores com comparacao e historico.
7. [x] Verificar contratos, autorizacao, concorrencia, rollback e migracao em SQLite/PostgreSQL temporario.
8. [x] Executar testes frontend, lint, TypeScript e build.
9. [x] Concluir conferencia visual e documentar evidencia final e guardrail SDD.

## Falha segura e recuperacao

A transacao e atomica: falha de transferencia ou historico nao deixa mesclagem
parcial. Previa antiga e conflitos de concorrencia exigem nova revisao. Cadastros
absorvidos e seus snapshots nao sao apagados. Identificacao de pessoas e
preservacao de pacientes sao requisitos de seguranca clinica desta entrega.

Nao ha downgrade automatico: depois que homonimos forem criados, reintroduzir
unicidade exige conciliacao humana. Reverter uma mesclagem ja usada requer
operacao assistida separada, com revisao do historico e alteracoes posteriores;
nao basta restaurar o nome ou reativar o secundario.

Release deve ser solicitado separadamente e aplicar a migracao antes de servir
o codigo novo. Nenhuma migracao ou teste deve apontar para bases reais durante
esta implementacao.
