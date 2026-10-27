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

Entrega local; instalacao em stage e producao nao solicitada. Migracao 102 deve
preceder o codigo novo. Cadastros antigos passam a identificacao pendente e
continuam podendo ser agendados conforme as regras operacionais existentes.
