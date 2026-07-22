# Intent - assistente-ia-admin-gestao

Data: 2026-07-22
Responsavel: Martiniano + Codex
Status: completed

## Objetivo

Evoluir a Mente FortCordis de um chat administrativo com consultas e poucas acoes para um copiloto de gestao completo, ainda exclusivo do admin, capaz de consolidar a operacao, executar mudancas governadas, aprender preferencias aprovadas, consultar conhecimento interno e apoiar o trabalho clinico sem substituir a decisao humana.

## Resultado esperado

- resumo executivo diario carregado automaticamente com agenda, faturamento, vencidos, reservas e aprovacoes;
- caixa unica de aprovacoes para acoes propostas em qualquer conversa;
- remarcacao, cancelamento, bloqueio/liberacao de slots e atualizacao de WhatsApps com confirmacao, snapshot, expiracao e auditoria;
- bloqueios refletidos tanto na validacao de escrita quanto nas sugestoes de disponibilidade;
- memoria supervisionada: sugestoes da IA ficam pendentes e apenas conteudo aprovado orienta novas respostas;
- base de conhecimento interna administravel e pesquisavel por ferramentas delimitadas;
- rascunhos clinicos isolados, comparacao com laudos anteriores e alertas de completude, sem alterar ou finalizar o laudo oficial;
- feedback positivo/negativo, correcao esperada, tokens, latencia e suite versionada de casos de avaliacao;
- backend continua sem SQL livre, shell, credenciais ou escrita generica controlada pelo modelo.
- correcao explicita gera apenas sugestao pendente, revisavel pelo administrador;
- memoria aprovada possui versoes imutaveis, restauracao auditada e contrato de regressao automatico;
- laboratorio verifica roteamento e preservacao das memorias sem executar ferramenta real.

## Nao objetivos

- liberar a Mente para perfis diferentes de `admin`;
- executar alteracoes operacionais sem confirmacao explicita;
- finalizar, assinar, publicar ou diagnosticar automaticamente um laudo;
- ingerir silenciosamente todos os dados ou documentos do sistema;
- enviar WhatsApp automaticamente pela API da Meta;
- habilitar pesquisa aberta na internet.

## Riscos principais

- memoria incorreta passar a orientar respostas sem revisao;
- conflito de agenda entre a preparacao e a aprovacao;
- rascunho clinico ser confundido com documento oficial;
- base interna retornar contexto irrelevante ou excessivo;
- crescimento de custo/latencia sem telemetria e regressao continua.
- correcao isolada ser generalizada de forma indevida para toda a gestao;
- restauracao apagar contexto historico ou deixar contrato de regressao obsoleto.
