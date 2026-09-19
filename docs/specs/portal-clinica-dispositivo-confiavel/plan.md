# Plan - portal-clinica-dispositivo-confiavel

Data: 2026-09-18
Responsavel: Martiniano Barros
Status: in-progress

Pre-requisito: `portal-clinica-link-laudo-whatsapp` (PR #171) em `stage`. A branch
desta implementacao sai de `stage` **depois** daquele merge.

## Fase 1 - verificacao de escopo - ENTREGUE EM SPEC PROPRIA

Virou `docs/specs/portal-escopo-sessao-clinica/` (PR #173, base `stage`), e nao uma
fase interna desta feature. O motivo esta em `plan.md` daquela spec: uma feature
grande entregue por fases deixa criterios `pendente` em `stage` durante todo o
percurso, e o `promotion-verify-guard` le o `verify.md` das features no diff - o que
travaria promocoes de trabalho nao relacionado. Alem disso, mudanca de autorizacao
em endpoint ja em uso e justamente a que mais pode precisar voltar atras as pressas,
e a que menos deveria arrastar tabela, endpoint novo e tela junto.

O que ficou entregue la e usado aqui:

- `_assert_portal_scope(session, permissao)` e as constantes de permissao;
- `clinic:read` exigido em agendamentos (GET e PATCH), financeiro e recibo de OS;
- `exam:read` / `exam:download` exigidos em exames, download-url e anexo;
- `_exigir_sessao_clinica_portal` com parametro `permissao` (default `clinic:read`).

Os criterios CA-001 e CA-003 desta spec passam a ser cobertos por
`portal-escopo-sessao-clinica`; a matriz de `verify.md` daqui referencia aquela
feature em vez de duplicar a evidencia.

**Antes de emitir a primeira sessao reduzida**, reconferir a lista de endpoints do
portal: um endpoint esquecido no levantamento daquela spec nao quebra nada hoje
(toda sessao tem tudo), mas vira furo silencioso no minuto em que o modo laudos
existir. E o risco residual 2 do `verify.md` de la.

## Fase 2 - banco e modelo

- `backend/app/models/portal_clinic_trusted_device.py`.
- Registrar em `app/models/__init__.py`.
- Migracao `20260918_88_portal_clinic_trusted_devices.py`, idempotente, nos dois
  dialetos, no padrao de `20260918_87`.

Criterios: tabela e indices criados em banco limpo e em banco existente.

Atencao: as suites que montam schema SQLite a mao e tocam o caminho de revogacao de
link vao precisar da tabela nova, como aconteceu em `20260918_87` (cinco arquivos).

## Fase 3 - servico de confianca

- `backend/app/services/portal_clinic_device_trust_service.py`:
  - `create_trust(...)` - sorteia token opaco, grava hash, define `expires_at`;
  - `resolve_active_trust(db, raw_token)` - status, prazo, clinica ativa;
  - `rotate_and_renew(db, trust, request)` - rotaciona o hash e empurra o prazo;
  - `revoke_trust` / `revoke_trusts_for_clinica` / `revoke_trusts_for_exam_links`;
  - `expire_trust_if_needed`.
- Flags novas em `config.py`.
- Helpers de cookie (gravar, ler, limpar), espelhando os de
  `portal_clinic_auth_service`.

Criterios: testes de unidade de criacao, rotacao, expiracao e revogacao.

## Fase 4 - endpoints

- `POST /portal/laudo-link/{token}/confiar-dispositivo` - reusa a validacao de link
  ja existente, extraida para helper comum com `abrir_laudo_por_link` para nao
  duplicar a regra de recusa.
- `POST /portal/clinicas/dispositivo/sessao`.
- `POST /portal/clinicas/dispositivo/encerrar`.
- Aviso por e-mail aos gestores na criacao (nao bloqueante).
- Ligar `revoke_links_for_exam` -> `revoke_trusts_for_exam_links` (RF-013).

Criterios: CA-004 a CA-011, CA-013.

## Fase 5 - admin

- `trusted_devices` em `GET /admin/clinicas/{id}/acesso`.
- `POST /admin/clinica-dispositivos/revogar`.

Criterios: CA-012.

## Fase 6 - frontend

- Acao "manter esta unidade conectada" em `PortalExamLinkWorkspace`.
- Login silencioso por cookie em `PortalClinicaPageShell` / `/clinica-parceira`.
- Abas condicionais por escopo e cabecalho do modo laudos em
  `PortalClinicaWorkspace`, mais "Sair deste computador".
- Tipos e funcoes novas em `frontend/lib/portal-api.ts`.
- Testes de componente para a acao nova e para a ocultacao das abas.

Criterios: CA-002, CA-014, CA-015.

## Fase 7 - verificacao

- `pytest` completo; `tsc`, `eslint` e `npm test` no frontend.
- Preencher `verify.md`.
- Verificacao manual em stage, com atencao ao cenario de dois cookies (CB-001) e ao
  navegador sem cookie (CB-002).

## Ordem e dependencias

Fase 1 esta entregue em spec propria. 2 -> 3 -> 4 sao encadeadas. 5 depende de 3. 6
depende de 4. 7 fecha.

## Riscos do plano

- A Fase 4 concentra a decisao de seguranca da feature. A validacao do link nao pode
  ser reimplementada ali: tem que ser a mesma funcao que `abrir_laudo_por_link` usa,
  senao as duas divergem com o tempo e a porta mais fraca vira a efetiva.
- **Nada aqui pode chegar a producao antes de `portal-escopo-sessao-clinica`.** Sem
  a conferencia de escopo no backend, esconder as abas de financeiro e agenda no
  frontend seria seguranca so na tela - e a sessao reduzida valeria tudo.
- O levantamento de endpoints daquela spec precisa ser reconferido na Fase 4, antes
  de existir a primeira sessao reduzida de verdade.
