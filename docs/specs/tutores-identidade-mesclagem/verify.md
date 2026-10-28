# Verify — tutores-identidade-mesclagem

Data: 2026-10-27
Responsavel: Codex
Status: verified-local

## Matriz de rastreabilidade

| ID | Evidencia local | Status |
| --- | --- | --- |
| CA-001 | test_post_cria_homonimos_separados_sem_modificar_contatos_existentes; test_tutor_ativo_com_mesmo_nome_permite_outra_pessoa | ok |
| CA-002 | test_pendente_persiste_e_so_muda_com_decisao_explicita; testes TutorComplementarPersistencia | ok |
| CA-003 | tests de paciente sem ID/ID invalido, laudo conhecido/novo, formalizacao sem reutilizacao e assistente com ID | ok |
| CA-004 | previa imutavel e escolhas/confirmacao obrigatorias; testes de interface de mesclagem | ok |
| CA-005 | transferencia de pets/agendamentos/atendimentos/creditos; mesclagens sucessivas e snapshots | ok |
| CA-006 | CPFs divergentes, previa antiga, 403 nos tres endpoints e controles ocultos para nao-admin | ok |
| CA-007 | falha simulada em commit reverte tudo; teste concorrente em PostgreSQL recusa escrita no ID absorvido | ok |
| CA-008 | migracao idempotente em SQLite com constraint/indice UNIQUE e PostgreSQL real com RLS | ok |
| CA-009 | 52 testes frontend, tipos, lint e build; fluxo real em navegador local sintetico, desktop e celular | ok |

## Validacoes executadas

- 28 testes do contrato de identidade/mesclagem e migracao em SQLite e
  PostgreSQL temporario local, incluindo concorrencia e mesclagens sucessivas.
- 14 testes existentes de dados complementares, busca legada e panorama.
- 24 testes de identidade/reativacao/formalizacao na primeira rodada.
- 42 testes de assistente administrativo, com envios e provedores simulados.
- 50 testes de regressao de pacientes, vinculo ao agendamento, ciclo de
  atendimento, financeiro e persistencia de laudos.
- Rodada integrada de backend: 148 testes passaram, com 59 subtestes, incluindo
  o contrato acima e as regressoes relacionadas. Contagens anteriores se sobrepoem.
- Frontend final: 52 testes da Agenda, pacientes, tela de tutores, shell e
  roteamento autenticado/institucional passaram; ESLint focado passou.
- TypeScript sem emissao e ESLint focado: passaram.
- Build Next.js de producao: passou, incluindo rota /tutores. Aviso preexistente
  de Browserslist desatualizado; nenhuma dependencia foi atualizada.

Todos os testes usam dados sinteticos. O PostgreSQL temporario aceita apenas
socket local em /tmp e a suite dedicada recusa URL sem o nome da base de teste
e sem o diretorio temporario esperado. Nao houve leitura de credenciais, envio
real, migracao em ambiente compartilhado ou alteracao de registros reais.

## Conferencia no navegador

Chrome headless com perfil temporario, frontend dev em 127.0.0.1:3037 e API
sintetica em 127.0.0.1:8127, com SQLite exclusivamente em /tmp. O processo de QA
comparou os dois homonimos, escolheu os campos, comprovou que o botao permanece
desabilitado antes da confirmacao, confirmou a mesclagem e abriu o historico.
Conferencia por API: um tutor ativo com dois animais distintos. Nenhum erro de
JavaScript da pagina. Rotas auxiliares de push/alertas nao implementadas na
fixture retornaram 404; nao fazem parte da verificacao funcional desta entrega.

Capturas inspecionadas localmente em /tmp/fortcordis-tutores-ui:
lista-desktop.png, previa-desktop.png, previa-celular.png e historico-desktop.png.
Celular conferido em 390x844 sem estouro horizontal da pagina; a comparacao tem
rolagem horizontal propria e orientacao visivel. Os servicos de QA e o PostgreSQL
temporario foram encerrados ao concluir.

Guardrail SDD avaliado com todos os arquivos alterados e novos da worktree:
aprovado para as quatro features alinhadas. git diff --check passou.

## Release

Publicacao autorizada pelo usuario em 2026-10-27, exclusivamente para tutores.
Migracao 102 deve preceder o codigo novo. Cadastros antigos passam a identificacao
pendente e continuam podendo ser agendados conforme as regras existentes.

- Base instalada conferida por SSH somente leitura: stage f48220c6; prod d65b60e2.
- Maior migracao de origin/stage conferida apos fetch: 20261025_101; 102 sem colisao.
- PR #503 preserva a integracao completa; substituido por #504 para publicar a
  arvore isolada main + tutores. Producao nao recebe Gestao nem referencias novas.
- Fixture de test_agenda_maps_budget_atomicity atualizada para fornecer ID de
  tutor escolhido explicitamente, sem alterar o bloqueio de custo Maps.
- Frontend completo da versao isolada: 1462 testes Vitest e 23 Node passaram;
  tipos e lint global passaram. Build de release em validacao.
- A primeira rodada backend isolada encontrou apenas restricoes de escrita do
  sandbox em uploads e runtime_backups da worktree; nova rodada autorizada
  executa as mesmas fixtures locais, sem servicos externos.
- Preflight de producao so com metadados: PostgreSQL, sem indices unicos de
  nome/nome_key em tutores, sem constraints de nome em pacientes. Contagens
  agregadas antes: 1455 tutores, 1601 pacientes, 1601 agendamentos, 1383 laudos,
  1280 OS, 1270 transacoes e 5 movimentos de credito.
- Preservacao de runtime revisada em deploy_prod_vps.sh: backup antes do reset,
  restauracao dos JSONs runtime e SQLite, migracao antes do restart e drill.

## Stage publicado — 2026-10-27

- PR #504, SHA 86663a16be13ceba3e5e1c8733228fd485c139e2: workflow
  40528528274 concluiu success (quality-gate, SDD, deploy e todos os canarios).
- Logs confirmaram preservacao/restauracao dos seis arquivos runtime, aplicacao
  da migracao 20261027_102, MIGRATIONS_OK e backup restore drill OK. O sync de
  presets informou nenhuma alteracao necessaria. Meta de stage permaneceu off.
- Metadados reais de stage: quatro colunas novas presentes, historico criado,
  RLS ativo e zero mesclagens operacionais.
- 12 testes do contrato instalado passaram em schemas descartaveis exclusivos
  de QA. A primeira tentativa encontrou a opcao search_path ignorada pelo
  pooler e parou em CREATE TABLE sem inserir dados; 12 schemas vazios removidos.
  A versao corrigida conferiu current_schema antes de operar em cada conexao,
  usou NullPool e limpou todos os schemas ao final. Nenhum dado real modificado.
- Smoke publico: stage.fortcordis.com.br e www.stage.fortcordis.com.br 200;
  /tutores redireciona ao login (307); /api/v1/tutores sem credenciais 401.
  Health interno 8001/health 200. Os nove chunks servidos pelo dominio app
  retornaram 200 e incluem Confirmar mesclagem, /tutores/mesclagens/previa,
  token_previa e identificacao_pendente. Rotulo Unicode escapado foi conferido
  pelo contrato ASCII, sem concluir ausencia a partir da codificacao do bundle.
- Snapshot isolado final: 2299 testes backend sem falhas (104 pulos opcionais),
  1462 Vitest e 23 Node; lint, tipos e build aprovados. A rodada completa da
  restauracao de stage passou 1753 Vitest e 23 Node apos corrigir apenas a espera
  do teste de comparacao, sem codigo clinico alterado.
- Backup privado PostgreSQL de producao concluido e catalogo validado antes da
  promocao, mantido na VPS com permissao 0600; 1611075421 bytes, 1767 entradas.
- PR direto #505 stage -> main, sem excecoes aos gates, merge commit
  375611de58b30d9ecec9fb60273d009bbb7436e9. Deploy de producao em acompanhamento.
- PR #506 prepara a restauracao exclusiva de stage do snapshot f48220c6, com
  tutores preservados e main como ancestral. A outra tarefa de laudos foi
  avisada com autorizacao humana conferida; aguarda liberacao do SHA restaurado.

## Evolucao de rotina agil

O contrato de confirmar identidade agora exige metodo/evidencia/versao. A nova
matriz em `../tutores-rotina-agil/verify.md` cobre cadastro minimo, resposta perdida,
contatos alternativos e reversao conservadora, preservando o contrato original
de homonimos separados, escolha por ID e historico administrativo.
