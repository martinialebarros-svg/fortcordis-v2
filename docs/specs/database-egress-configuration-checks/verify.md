# Verificação

## Critérios

- SQL real das leituras de flags/modos não inclui as duas colunas binárias.
- Configuração ausente, valores inválidos, flags desligadas e mudanças entre
  leituras preservam os resultados esperados, sem cache de ativação.
- Verificações de estrutura não enumeram o catálogo completo e funcionam
  com pool de uma conexão já ocupada pela sessão.
- Schema criado/removido e migrações aplicadas são percebidos sem estado de
  prontidão persistido em cache.
- Suítes relacionadas, sintaxe, diff e guardrail SDD passam.
- O deploy Stage termina com sucesso e instala o SHA aprovado; os serviços
  seguem ativos e não há alteração de produção executada por esta entrega.
- A comparação de contadores mantém a mesma janela/reset e registra as
  próprias sondagens, sem atribuir bytes exatos por query.

## Estado da rodada

Validação local em Python 3.12, com dependências fixadas do repositório e banco
SQLite sintético: **89 testes e 165 subtests passaram**. Foram executados os
testes novos de projeções e catálogo e as regressões de gates/piloto/lembretes,
autonomia, observabilidade, migrações de autonomia e migrações adiadas.

A descoberta completa de testes backend também passou: **2.126 testes,
74 skips** (incluindo integrações que exigem PostgreSQL dedicado). Esses skips
não equivalem a uma validação de PostgreSQL; os gates correspondentes de CI
continuam necessários.

Após incorporar o Stage `af36c3ed`, a regressão focada incluindo as novas
oportunidades da Agenda passou: **104 testes e 172 subtests**, sem falhas.
O patch da otimização permaneceu byte a byte idêntico durante o rebase.

Os testes novos registram SQL real. As quatro leituras de configuração emitem
somente uma coluna cada; a verificação com catálogo sintético de 80 tabelas
não lista esse catálogo. O cenário de pool unitário também permanece válido.
As contagens locais SQLite não são estimativas de bytes faturados no Stage.

O teste de opt-in do smoke Stage passou com installer substituído por stub
(padrão `0`, explícito `0` e explícito `1`). Ele integra o teste de isolamento
Meta já executado pelo quality gate. Os 13 testes de SHA imutável e os testes
de isolamento Meta e ativação controlada de lembretes também passaram.
O script comum de deploy, o wrapper de produção e os workflows não mudam.

A publicação é comprovada separadamente após o merge, pelo workflow terminal,
pelo SHA instalado e pelas sondagens de Stage. Os resultados locais acima
não constituem prova de deploy nem de desbloqueio da quota.
