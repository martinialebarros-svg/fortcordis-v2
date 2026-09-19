# Spec - portal-escopo-sessao-clinica

Data: 2026-09-18
Responsavel: Martiniano Barros
Status: in-progress

## 1) Escopo funcional

O campo `scope`, gravado em todo token de sessao do portal e ate hoje nunca lido,
passa a ser conferido. Nasce o guard `_assert_portal_scope`, aplicado aos endpoints
do portal separando **gestao da unidade** (`clinic:read`: agenda, financeiro,
recibo) de **leitura de exame liberado** (`exam:read` / `exam:download`).

Nenhuma sessao emitida hoje muda de comportamento: os tres pontos de emissao gravam
o escopo cheio do respectivo ator. A entrega e o mecanismo, nao uma mudanca de
permissao - e a prova disso e requisito, nao observacao.

## 2) Requisitos funcionais (RF)

- RF-001: nasce `_assert_portal_scope(session, permissao)` em `portal.py`, que lanca
  403 com mensagem generica quando a permissao pedida nao esta em `session.scope`.
- RF-002: nascem as constantes `PORTAL_PERMISSION_CLINIC_READ`,
  `PORTAL_PERMISSION_EXAM_READ` e `PORTAL_PERMISSION_EXAM_DOWNLOAD`, para que os
  call sites nao repitam literais.
- RF-003: `_exigir_sessao_clinica_portal` ganha o parametro `permissao`, com default
  `clinic:read`. Os quatro endpoints que ja o usam - `GET /clinicas/agendamentos`,
  `PATCH /clinicas/agendamentos/{id}/cancelar`, `GET /clinicas/financeiro` e
  `GET /clinicas/ordens-servico/{id}/recibo` - passam a exigir `clinic:read` por
  consequencia, sem alteracao em cada um.
- RF-004: `GET /clinicas/exames` exige `exam:read` explicitamente, **sem** passar
  pelo helper - e a leitura que precisa continuar aberta a sessao de menos poder.
- RF-005: `GET /parceiros/exames` exige `exam:read`.
- RF-006: `GET /pets/{paciente_id}/exames` exige `exam:read` - permissao comum aos
  tres atores que usam o endpoint.
- RF-007: `POST /exames/{exame_id}/download-url` exige `exam:download`.
- RF-008: `GET /anexos/{anexo_id}/arquivo` exige `exam:download` **apenas** no
  caminho autenticado por sessao. O caminho por token de download nao confere
  escopo, porque `PortalDownloadContext` nao tem o campo e o token ja nasce preso ao
  par (exame, anexo).
- RF-009: a conferencia de permissao acontece **antes** de qualquer consulta ao
  banco, para que a recusa nao dependa de estado carregado.
- RF-010: `backend/tests/test_portal_escopo_sessao.py` entra na lista de testes do
  `migrations-ci.yml`, que e o unico gate de `pull_request` que executa Python.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (compatibilidade): toda sessao emitida pelos tres pontos existentes -
  `_emitir_token_desafio`, `build_clinic_session_result` e
  `build_partner_session_result` - carrega o escopo cheio do seu ator, entao a
  conferencia nasce sem efeito pratico. Requisito verificado por teste, nao assumido.
- NFR-002 (falha fechada): sessao com `scope` vazio ou ilegivel e recusada em todas
  as permissoes. `_coerce_scope` ja devolve tupla vazia para entrada invalida, e
  tupla vazia nao satisfaz nada.
- NFR-003 (default seguro): o parametro `permissao` de `_exigir_sessao_clinica_portal`
  tem default `clinic:read`, de modo que um endpoint de clinica criado no futuro
  nasce conferido. Quem quiser abrir para sessao de menos poder passa a permissao
  explicitamente, e a escolha fica visivel no call site.
- NFR-004 (mensagem generica): o 403 nao diz qual permissao faltou, para nao
  descrever a matriz de permissao a quem esta sondando.

## 4) Contratos tecnicos

### API

Nenhum contrato novo. Os endpoints abaixo ganham uma condicao de recusa a mais, com
`403 {"detail": "Sessao do portal sem permissao para esta operacao."}`:

| Endpoint | Permissao exigida |
| --- | --- |
| `GET /portal/clinicas/agendamentos` | `clinic:read` |
| `PATCH /portal/clinicas/agendamentos/{id}/cancelar` | `clinic:read` |
| `GET /portal/clinicas/financeiro` | `clinic:read` |
| `GET /portal/clinicas/ordens-servico/{id}/recibo` | `clinic:read` |
| `GET /portal/clinicas/exames` | `exam:read` |
| `GET /portal/parceiros/exames` | `exam:read` |
| `GET /portal/pets/{paciente_id}/exames` | `exam:read` |
| `POST /portal/exames/{id}/download-url` | `exam:download` |
| `GET /portal/anexos/{id}/arquivo` (por sessao) | `exam:download` |

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Migracao necessaria: nao.

### Frontend

- Telas afetadas: nenhuma. Toda sessao emitida hoje continua passando em todos os
  endpoints, entao nao ha nada a esconder ou revelar.

## 5) Compatibilidade e rollout

- Backward compatibility: total, pelo argumento de NFR-001. Tokens vivos no momento
  do deploy duram no maximo 30 minutos
  (`PORTAL_SESSION_TOKEN_EXPIRE_MINUTES`) e todos foram emitidos com escopo cheio.
- Feature flag: **nenhuma**, de proposito. Deixar a conferencia atras de flag criaria
  dois comportamentos de autorizacao para manter e testar, que e pior do que a
  mudanca em si.
- Estrategia de rollback: reverter o commit. Nao ha dado novo, migracao nem estado
  para desfazer.

## 6) Criterios de aceitacao (CA)

- CA-001: sessao com o escopo de clinica emitido hoje passa no guard de clinica e le
  exames normalmente.
- CA-002: os tres escopos emitidos hoje contem `exam:read` e `exam:download`, e o de
  clinica contem `clinic:read`.
- CA-003: os tres servicos de emissao continuam gravando o escopo cheio - teste que
  falha se alguem reduzir um deles sem passar por aqui.
- CA-004: sessao de clinica com escopo `("exam:read", "exam:download")` recebe 403 em
  agendamentos, financeiro, cancelamento e recibo.
- CA-005: a mesma sessao le `GET /clinicas/exames` com o painel operacional junto.
- CA-006: sessao sem `exam:read` recebe 403 em `GET /clinicas/exames`.
- CA-007: sessao sem `exam:download` recebe 403 em `download-url`.
- CA-008: sessao com `scope` vazio e recusada em todas as permissoes.
- CA-009: a recusa por permissao acontece sem tocar o banco - chamada com `db=None`
  ainda devolve 403.
- CA-010: a suite completa de backend passa sem regressao.

## 7) Casos de borda

- CB-001: token antigo emitido antes do deploy - escopo cheio, passa normalmente.
- CB-002: `scope` ausente ou malformado no token - `_coerce_scope` devolve tupla
  vazia e tudo e recusado (CA-008).
- CB-003: download por token (`x-portal-download-token`) continua funcionando sem
  conferencia de escopo, por desenho (RF-008).
- CB-004: sessao de tutor ou parceiro nos endpoints compartilhados de exame - tem
  `exam:read`/`exam:download` e passa.

## 8) Fora de escopo

- Sessao de menos poder de fato (dispositivo confiavel da recepcao) - proxima spec.
- Conferencia de escopo nos endpoints administrativos do portal, que autenticam por
  usuario interno com matriz propria.
- Levar a suite Python inteira para um gate de `pull_request`.
- Qualquer mudanca de frontend.
