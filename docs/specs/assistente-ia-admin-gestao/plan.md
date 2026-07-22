# Plan - assistente-ia-admin-gestao

Data: 2026-07-21
Responsavel: Martiniano + Codex
Status: completed

## Fase 1 - Fundacao persistente

1. Expandir mensagens com tokens, latencia, status e identificador do provedor.
2. Criar memoria, documentos internos, feedback, rascunhos clinicos e bloqueios de agenda.
3. Entregar migration `20260721_53` idempotente em SQLite e PostgreSQL.

Rollback: desabilitar a Mente; as tabelas novas sao isoladas. Bloqueios podem ser desativados sem remover registros.

## Fase 2 - Inteligencia e operacao governada

1. Adicionar resumo executivo, conhecimento, memoria e contexto clinico como ferramentas estritas.
2. Adicionar remarcacao, cancelamento, bloqueio/liberacao e WhatsApps como acoes pendentes.
3. Revalidar snapshots e chamar fluxos oficiais de agenda e clinicas na aprovacao.
4. Fazer bloqueios participarem da validacao de slot e do motor de sugestoes.

Rollback: retirar as novas definicoes de ferramentas; as funcoes existentes continuam independentes.

## Fase 3 - Experiencia administrativa

1. Organizar `/assistente-ia` em conversa, resumo, aprovacoes, memoria, conhecimento e rascunhos.
2. Carregar resumo e indicadores ao abrir a pagina.
3. Adicionar avaliacao util/nao util e correcao esperada em cada resposta.
4. Manter cartoes antes/depois para qualquer escrita operacional.

Rollback: manter apenas a aba de conversa, sem afetar os endpoints.

## Fase 4 - Qualidade

1. Cobrir autorizacao, memoria aprovada, busca interna, bloqueios, feedback e migrations.
2. Versionar casos de avaliacao de intencao e fronteiras clinicas.
3. Executar testes focais, suite completa, migration CI, lint, TypeScript e build.
4. Atualizar `verify.md` com evidencias reais antes de qualquer publicacao.
5. Preservar os testes da versao inicial para consultas, criacao/reserva, exclusao e funcionamento excepcional.
6. Manter o item de menu somente para admin, os estados da conversa e os cartoes antes/depois de todas as acoes pendentes.
7. Sincronizar segredos separados de stage e producao nos respectivos `.env` e exigir o status autenticado no canario pos-deploy.

Rollback: desabilitar as novas ferramentas e abas, mantendo a conversa e as operacoes ja publicadas sem alterar dados persistidos.

## Fase 5 - Verificacao e publicacao

1. Executar testes focais de ferramentas, autorizacao, memoria, conhecimento, fronteiras clinicas e ciclo de aprovacao.
2. Executar migrations em SQLite, suite completa com `TZ=UTC`, `py_compile` e `pip check`.
3. Executar ESLint, TypeScript e build do frontend.
4. Executar os casos versionados de avaliacao e smokes reais da OpenAI sem expor a chave.
5. Publicar em stage, validar o canario autenticado, as rotas protegidas e os pacotes servidos.
6. Promover o SHA exato para producao e repetir migrations, guardrail SDD, canario e smokes.
