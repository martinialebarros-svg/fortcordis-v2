# Verify — tutores-rotina-agil

Data: 2026-10-29
Responsavel: Codex
Status: verified-stage

| Criterio | Evidencia | Status |
| --- | --- | --- |
| CA-001 | test_tutores_rotina_agil; NovoAgendamentoModal.tutor-rotina-agil; pacientes/novo/page; formalizacao com nomes minimos | passou |
| CA-002 | TutorExistenteSelector e testes Novo paciente: selecao explicita, resposta antiga ignorada, nova pessoa sem perder pet | passou |
| CA-003 | eventos/versao/bypass e TutorRevisaoCadastro; navegador com API real local | passou |
| CA-004 | filtros/busca/candidatos/descarte, sem consulta automatica ao agendar | passou |
| CA-005 | retry concorrente, resposta perdida, rollback, dois consumos do convite de formalizacao | passou |
| CA-006 | contato/origem e preservacao ao mesclar/reverter | passou |
| CA-007 | test_tutor_mesclagem_reversao e ida/volta no navegador | passou |
| CA-008 | revisao recolhida; contexto de paciente e edicoes locais preservados; resposta de mutacao antiga nao recarrega outra pessoa | passou |
| CA-009 | migracoes 103/104 em SQLite/PostgreSQL descartavel, RLS/grants/idempotencia/fusos | passou |

## Validacao executada

- Suite geral frontend no ciclo: 137 arquivos, 2402 testes; Node: 23 testes.
- Suite geral backend no ciclo: 2479 testes, OK, 138 skips de dependencias/ambientes opcionais.
- Apos ajustes finais, `pytest tests/test_tutores_identidade_mesclagem.py tests/test_tutores_rotina_agil.py tests/test_tutor_mesclagem_reversao.py -q`
  com PostgreSQL descartavel: 96 passaram e 12 subtestes passaram. Nenhum skip.
- Formalizacao: 15 testes SQLite, incluindo duas sessoes consumindo o mesmo
  convite previamente carregado e schema com telefone omitido.
  Os cenarios de concorrencia e nomes minimos tambem passaram em PostgreSQL
  descartavel (2 testes por harness isolado, zero schemas residuais).
- Frontend apos ajustes finais: 24 testes nos tres arquivos
  `TutorRevisaoCadastro`, `AgendaFormalizacaoWorkspace` e `app/tutores/page`.
  Inclui guarda de envio duplicado e resposta atrasada apos troca de tutor.
- ESLint global sem avisos, TypeScript e `next build` aprovados; `git diff --check` limpo.
- Guardrail SDD aprovado sobre arquivos alterados e novos, sem stage/commit;
  features qualificadas: tutores-rotina-agil, tutores-identidade-mesclagem e
  agenda-formalizacao-portal-clinicas.
- Navegador Chrome com frontend real e API local de tutores: cria homonimo so
  com nome, confirma identidade, compara/mescla e reverte com historico. Animais
  retornam aos IDs originais. Desktop 1440 px e celular 390 px, sem overflow
  horizontal nem erros de execucao JavaScript. Formalizacao publica visualizada
  em celular com API simulada, enviando somente nomes e telefone vazio.
- Evidencias locais: `/tmp/fortcordis-tutores-rotina-ui/` (scripts, logs e PNGs),
  `/tmp/tutores-rotina-backend-pg-final.log`, `/tmp/tutores-rotina-frontend-final.log`
  e `/tmp/tutores-rotina-build-final.log`. Os logs da suite geral sao o checkpoint
  anterior aos ajustes finais; as suites focadas validam esses ajustes.

## Limites e publicacao

Reversao e conservadora: novas alteracoes/vinculos depois da mesclagem impedem
desfazer automaticamente; mesclagens antigas sem hash exigem revisao tecnica.
O checkpoint local abaixo antecede as migracoes e a publicacao; os resultados
instalados estao registrados nas secoes posteriores. Os testes visuais locais
nao equivalem a validacao visual autenticada em stage/producao.

Todas as evidencias usam dados sinteticos. Nenhuma migracao em base real,
mesclagem operacional, envio de mensagem, commit, push ou deploy nesta etapa.

## Publicacao autorizada — 2026-10-28

- Escopo confirmado pelo usuario: somente tutores, incluindo cadastro minimo,
  revisao no atendimento e formalizacao da reserva sem contato obrigatorio.
- Arvore isolada: main `9569b111` + feature `53603958`. O codigo de Gestao,
  IA/ingress e comparacao de laudos de stage nao entra em producao.
- Snapshot integral preservado: stage `07317874b7b09eb7e8e1e076e9db4acc1294c90f`,
  a restaurar por PR depois da promocao protegida stage -> main.
- Maior migracao remota apos fetch: 102. Migracoes 103/104 nao colidem e nao
  dependem de 101 (Gestao). Scripts de deploy/producao inalterados.
- Regressao da arvore isolada: 2417 testes backend OK (139 skips opcionais),
  2387 Vitest e 23 Node aprovados; build com lint/tipos aprovado. O primeiro
  comando npm test recebeu um argumento indevido no Node; Node foi executado
  separadamente e passou. Guardrails SDD e promocao aprovados sem excecoes.
- Preservacao revisada: seis arquivos runtime mantidos pelo deploy, SHA
  imutavel, migrations/readiness/canario autenticado/backup-restore drill ativos.

- Backup privado pre-migracao concluido na VPS: schema PostgreSQL completo
  (1.69 MB), dados de tutores/tutores_mesclagens/schema_migrations e sequencias
  (57.5 KB), catalogos validados, arquivos 0600 e diretorio 0700. Escopo protege
  103/104; nao e backup integral contra perda geral do banco. Nenhuma tabela
  nova de 103/104 existia. Rollback preferencial conserva schema aditivo/dados.
- Liberados aproximadamente 800 MB somente de caches Webpack regeneraveis de
  stage/producao; arquivos servidos, imagens, uploads e backups preservados.
- O primeiro gate SDD exigiu manter a estrutura documental da comparacao de
  exames retirada de stage. Documentos preservados com escopo historico claro e
  pendencias originais explicitamente vinculadas ao SHA preservado; nenhum
  codigo clinico ou aprovacao dessa feature acompanha tutores.

## Stage validado e promocao

- PR #520 integrado como `9aa9aab5ccc669c6cc6954027288d7b995ed4cac`. Workflow
  Deploy to Stage `40733663493` concluido com sucesso, assim como Frontend CI,
  Migration CI e Google Maps Cost Control. Preservacao/restauracao dos seis
  arquivos runtime, MIGRATIONS_OK (103/104), canario autenticado e restore drill.
- Contrato instalado: 43 testes e 5 subtestes, sem skips/falhas, em 43 schemas
  sinteticos exclusivos. 283 transacoes com search_path verificado; zero schemas
  remanescentes, nenhuma alteracao operacional.
- Metadados instalados: 103/104 aplicadas, seis tabelas com RLS ativo, unicidade
  historica do secundario removida. Rotas autenticadas /tutores, /pacientes/novo,
  /atendimento e formalizacao publica retornam 200, bundles servidos iguais aos
  instalados (hashes), inclusive chunk dinamico do cadastro no Atendimento.
- Aliases de stage 200; /tutores anonimo 307 para login, API anonima 401. /health
  publico nao existe (404); readiness interno foi aprovado pelo deploy.
- PR protegido #521 stage -> main integrado como
  `9553518d2ebb20bd9b7f6c7d12b039fa677c4df0`, sem excecoes aos gates. Deploy de
  producao `40747385990` concluido com sucesso: 103/104 aplicadas, seis arquivos
  runtime preservados/restaurados e backup-restore drill aprovado.

## Producao verificada — 2026-10-29

- A correcao regional da Agenda foi publicada posteriormente pelas PRs #523/524.
  Producao atual `c65081ae6e31e0c0bd4edf2e70b5d80eec4c076b`, com deploy
  `40807924598`, Frontend CI, Migration CI e Maps concluidos com sucesso.
- Smoke sobre essa versao instalada: quatro dominios institucionais 200;
  /tutores anonimo redireciona ao login e API anonima retorna 401. Rotas de
  tutores, novo paciente, atendimento e formalizacao carregam com 200; todos
  os assets conferem com os arquivos instalados, inclusive a secao dinamica.
- Consulta autenticada vazia aprovada; 103/104 aplicadas, seis tabelas privadas
  com RLS e restricao secundaria de mesclagem removida. Nenhuma escrita em
  cadastro operacional foi usada nessa verificacao.

## Restauracao integral de stage

- Restauracao preserva o codigo e os documentos originais de `07317874`,
  incluindo pendencias reais de homologacao da comparacao de exames, e soma
  tutores. A versao atual de producao `c65081ae` foi integrada normalmente,
  preservando tambem a excecao regional das PRs #523/524.
- Snapshot integrado `c05e4ff6`: 2513 testes backend OK (139 skips opcionais),
  2526 Vitest em 141 arquivos e 23 Node aprovados; build/lint/tipos aprovados.
- Apos integrar `c65081ae`, 20 testes da excecao regional/persistente passaram;
  tutores e formalizacao: 61 testes e 7 subtestes passaram, 50 cenarios PostgreSQL
  opcionais sem configuracao local foram ignorados nesta repeticao. A evidencia
  PostgreSQL instalada anterior permanece registrada acima.
- Deploy de producao e verificacao terminal concluidos. A restauracao segue
  somente para stage pela PR #522, com nova verificacao apos instalacao.
  Nenhuma configuracao/credencial Meta e alterada por este processo.
