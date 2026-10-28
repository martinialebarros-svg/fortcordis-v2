# Spec — tutores-identidade-mesclagem

Data: 2026-10-27
Responsavel: Martiniano + Codex
Status: implemented-local

## Contrato e comportamento

- RF-001: `POST /tutores` sempre cria um novo ID. Nome e `nome_key` sao busca,
  sem unicidade. Nao ha reutilizacao nem reativacao implicita por nome, mesmo
  quando a busca retorna apenas uma pessoa. Nome vazio e rejeitado.
- RF-002: persistir `identificacao_pendente` (booleano, default verdadeiro),
  `origem_cadastro` e `identificacao_observacoes`. Nome completo, CPF, contato e
  clinica nao confirmam automaticamente a identidade. A equipe confirma
  explicitamente. Pendencia nao impede o agendamento em clinica parceira;
  permanecem as exigencias existentes de localizacao para atendimento domiciliar.
- RF-003: cadastros antigos recebem pendencia verdadeira por nao haver evidencia
  armazenada de verificacao. A migracao nao modifica nome, contato ou historico.
- RF-004: cadastro de paciente reutiliza tutor somente por ID explicito ou pelo
  ID que ja pertence ao paciente editado. ID inexistente, inativo ou mesclado
  falha sem fallback por nome e sem alteracao de outra pessoa.
- RF-005: criacao pelo laudo nao seleciona tutor por nome; paciente conhecido
  conserva sua identidade e tutor. Nome digitado nao transfere um paciente
  existente para outra pessoa. Formalizacao publica da reserva cria cadastro
  separado e pendente. Ferramentas administrativas de escrita exigem ID de tutor
  (string `#184` ou `184`); consultas por nome continuam disponiveis.
- RF-006: Agenda e cadastros de pacientes exibem os campos de identificacao.
  `/tutores`, acessivel pelo menu e pela carteira de pacientes, permite buscar,
  criar e complementar pessoas; busca mostra ID, contato, origem, animais e
  pendencia, inclusive quando ha homonimos.
- RF-007: reativacao passa a `POST /tutores/{id}/reativar` com `confirmar=true`.
  O antigo `confirmar_reativacao=true` sem ID nao escolhe um homonimo. Cadastro
  mesclado nao pode ser reativado, atualizado ou reutilizado para novos vinculos.

## Mesclagem assistida

- RF-008: previa, confirmacao e historico exigem `admin` no backend. A matriz
  existente do modulo pacientes continua aplicada. A interface tambem restringe
  os controles de mesclagem e historico aos administradores.
- RF-009: `POST /tutores/mesclagens/previa` recebe `principal_id` e
  `secundario_id` positivos e diferentes, ambos ativos e nao mesclados. Retorna
  dados lado a lado, conflitos, bloqueios, avisos, animais, quantidades dos
  vinculos e `token_previa`. A previa nao faz escrita.
- RF-010: `POST /tutores/mesclagens` recebe os mesmos IDs, `token_previa`,
  `escolhas` (campo -> principal/secundario), `motivo` (5–2000 caracteres) e
  `confirmar=true`. Todo conflito deve ser resolvido explicitamente. Campos
  vazios sao completados com a fonte preenchida se nao houver escolha.
  Endereco e geolocalizacao sao escolhidos como um grupo, sem combinar
  coordenadas de um endereco com o texto de outro. CPFs preenchidos divergentes,
  comparados sem formatacao, bloqueiam a consolidacao.
- RF-011: a confirmacao recalcula a previa; alteracao de cadastro ou de qualquer
  registro relacionado invalida o token e exige nova revisao (409). PostgreSQL
  serializa a operacao com locks transacionais; espera limitada a cinco segundos.
  Conflitos de concorrencia abortam sem gravacao parcial. SQLite reserva a
  escrita antes de revalidar.
- RF-012: atualizar todos os `tutor_id` relacionados, incluindo pacientes,
  agendamentos, atendimentos e movimentos de credito, em uma transacao unica com
  o historico. Nunca fundir pacientes, alterar valores, reescrever documentos
  emitidos ou os textos historicos denormalizados. Animais homonimos permanecem
  separados e aparecem como aviso. Falha de qualquer etapa reverte toda a operacao.
- RF-013: secundario permanece armazenado com `ativo=0` e `mesclado_em_id`.
  `tutores_mesclagens` registra IDs, usuario, data UTC, motivo, dados anteriores,
  resultado, escolhas, avisos e IDs dos vinculos movidos. O historico apresentado
  por `GET /tutores/{id}/mesclagens` inclui mesclagens anteriores da mesma cadeia.
- RF-014: desafios OTP pendentes dos dois tutores sao revogados; tokens e escopos
  de portal nunca sao transferidos. A autorizacao existente do portal continua
  limitada ao paciente e ao seu tutor atual. Historico tem RLS e nenhum grant
  publico/anon/authenticated na Data API; acesso administrativo pela API privada.

## Migracao e seguranca

Migracao `20261027_102`, pelo runner proprio do repositorio: remover somente
unicidade de nome/nome_key, manter outros indices/constraints, adicionar campos
e tabela privada de historico. PostgreSQL remove constraints/indices; SQLite
reconstroi tutores quando a unicidade esta declarada na tabela, preservando
colunas, defaults, PK, dados e indices nao relacionados. Migracao idempotente.

## Aceitacao

- CA-001: dois POSTs com nome igual produzem IDs diferentes sem alterar contato anterior.
- CA-002: pendencia, origem e observacoes persistem e so mudam por decisao explicita.
- CA-003: pacientes, formalizacao, laudo e ferramentas de escrita nao escolhem tutores por nome.
- CA-004: previa apresenta conflitos/vinculos, nao altera dados e exige revisao e confirmacao.
- CA-005: mesclagem transfere vinculos, preserva pacientes separados e historico anterior.
- CA-006: CPFs divergentes, previa desatualizada e usuario nao administrador sao recusados.
- CA-007: falha transacional reverte tudo e escrita concorrente nao reintroduz tutor mesclado.
- CA-008: migracao e contrato exercitados em SQLite e PostgreSQL local real.
- CA-009: interface permite comparar/confirmar/consultar historico; telas responsivas e rotas autenticadas.

## Fora de escopo

Mesclagem automatica ou em massa, fusao de animais, transferencia real de
titularidade, desfazer mesclagem automaticamente, verificacao externa de CPF,
alteracao de regras ou destinatarios de WhatsApp, aplicacao em dados reais e release.

## Publicacao autorizada em 2026-10-27

O usuario solicitou publicar e confirmou o escopo **somente tutores**. A versao
de release parte de main d65b60e2 e recebe apenas a implementacao de tutores.
Painel de Gestao, novas referencias/coerencia eco e otimizacoes de sondas de
configuracao permanecem exclusivos de stage. O snapshot f48220c6 e a branch
codex/tutores-identidade-mesclagem preservam essas entregas para restauracao
apos o PR direto stage -> main. Documentos historicos de baixo peso sao
mantidos somente para integridade documental do guardrail, sem codigo ativo.

## Evolucao de rotina agil — 2026-10-27

A feature `tutores-rotina-agil` substitui a confirmacao por booleano por acao com
metodo/evidencia e mantem cadastros minimos para agendar. Adiciona idempotencia,
contatos/origens alternativos e correcao assistida conservadora; a antiga exclusao
de reversao de escopo nao se aplica a esse novo fluxo explicitamente autorizado.
