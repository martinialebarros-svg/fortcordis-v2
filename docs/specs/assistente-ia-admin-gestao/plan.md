# Plan - assistente-ia-admin-gestao

Data: 2026-07-21
Responsavel: Martiniano + Codex
Status: completed

## Fase 1 - Persistencia e configuracao

1. Adicionar configuracoes do modulo e dependencia do SDK oficial OpenAI.
2. Criar modelos e migration versionada para conversas, mensagens e acoes pendentes.
3. Registrar os modelos no catalogo central.

Rollback: desabilitar `ASSISTENTE_IA_ENABLED`; as tabelas novas permanecem isoladas e sem impacto nos modulos atuais.

## Fase 2 - Ferramentas e orquestracao

1. Implementar resolucao segura de clinica/servico.
2. Implementar ferramentas financeiras e de agenda com saidas minimizadas.
3. Implementar loop da Responses API com limite, estado e auditoria.
4. Implementar pedido de exclusao como acao pendente, nunca como delete direto.
5. Implementar criacao de reserva/agendamento como acao pendente, reutilizando resolucao de cadastros e validadores oficiais da agenda.
6. Implementar excecao de funcionamento por data como acao pendente, preservando a rotina semanal e revalidando a lista de excecoes antes da escrita.

Rollback: remover o router do modulo; nenhum endpoint atual e substituido.

## Fase 3 - API administrativa

1. Criar rotas de conversas, mensagens, chat e decisao de acoes.
2. Exigir `require_papel("admin")` em todas as rotas.
3. Revalidar snapshot e reutilizar o fluxo oficial da agenda na aprovacao.

Rollback: retirar `include_router`; dados persistidos ficam inertes.

## Fase 4 - Frontend

1. Adicionar item de menu visivel somente para admin.
2. Criar pagina conversacional com estados vazio, carregando, erro e resposta.
3. Exibir ferramentas usadas e cartao de confirmacao para acao pendente.
4. Redirecionar nao-admin e manter a API como barreira de seguranca definitiva.
5. Generalizar o cartao para criacao de horario e, apos a execucao, oferecer copia da mensagem e abertura manual do WhatsApp.
6. Exibir comparacao entre funcionamento atual e funcionamento proposto para uma excecao de data.

Rollback: remover pagina e item de navegacao sem afetar backend.

## Fase 5 - Verificacao

1. Testes focais de ferramentas, autorizacao e ciclo de aprovacao.
2. Teste de migration em SQLite.
3. `py_compile`, pytest focal e suite de migration.
4. ESLint e build do frontend.
5. Smoke real da OpenAI sem expor a chave, se o modelo estiver habilitado na conta.
6. Sincronizar segredos separados de stage e producao nos respectivos `.env` e exigir o status autenticado do assistente no canario pos-deploy.
7. Cobrir preparacao sem escrita, rejeicao, aprovacao e conflito concorrente da excecao de funcionamento.
