# Intent - portal-escopo-sessao-clinica

Data: 2026-09-18
Responsavel: Martiniano Barros
Status: in-progress

## 1) Problema atual

O portal grava um campo `scope` em todo token de sessao desde
`portal-secure-access-foundation` - `["clinic:read", "exam:read", "exam:download"]`
para clinica, `["pet:read", ...]` para tutor, `["partner:read", ...]` para parceiro.
`PortalSessionContext` carrega esse campo, o frontend o recebe na resposta de login.

**Nenhum endpoint le esse campo.** O controle de acesso do portal e feito so por
`actor_type` mais as funcoes `_assert_tutor_scope`, `_assert_clinica_scope_for_exam`
e `_assert_partner_scope_for_exam` - que, apesar do nome, conferem **posse** do
recurso (este exame e desta clinica?), nunca **permissao** (esta sessao pode ver
financeiro?).

Na pratica: toda sessao vale tudo dentro do seu `actor_type`. Nao existe como emitir
uma sessao de clinica com menos poder que outra. O campo `scope` e decorativo, e um
leitor do codigo razoavelmente assume que ele significa alguma coisa - o que e pior
do que nao existir.

Isso vira bloqueio concreto em `docs/specs/portal-clinica-dispositivo-confiavel/`,
que precisa de uma sessao "so laudos" para o computador da recepcao: sem conferencia
no backend, esconder financeiro e agenda seria seguranca so na tela.

## 2) Objetivo

Fazer `scope` valer de verdade: um guard que confere permissao, aplicado aos
endpoints do portal, separando o que e gestao da unidade (agenda, financeiro,
recibo) do que e leitura de exame liberado.

## 3) Nao objetivos

- Nao criar nenhum tipo novo de sessao, nem alterar o que os fluxos de autenticacao
  emitem hoje. Esta entrega so **confere** o que ja e gravado.
- Nao implementar o dispositivo confiavel da recepcao - e a spec seguinte, que
  depende desta.
- Nao mexer no espelho interno `/clinicas/portal/espelho`, que autentica por usuario
  interno e nao por sessao de portal.
- Nao tocar no frontend: nenhuma sessao existente muda de comportamento, entao nao
  ha nada a esconder ou revelar na tela.

## 4) Contexto e restricoes

- Ha exatamente tres pontos que emitem token de sessao do portal:
  `portal.py::_emitir_token_desafio` (desafio de tutor e o fluxo legado de codigo da
  clinica), `portal_clinic_auth_service.py::build_clinic_session_result` e
  `portal_partner_auth_service.py::build_partner_session_result`. Os tres gravam o
  escopo cheio do respectivo ator.
- Os quatro endpoints de gestao da clinica ja passam por um helper comum,
  `_exigir_sessao_clinica_portal` - ponto unico de insercao. `GET /clinicas/exames`
  **nao** usa esse helper, o que e conveniente: e justamente o que precisa continuar
  aberto para sessao de menos poder.
- `GET /portal/anexos/{id}/arquivo` tem dois caminhos de autenticacao: token de
  download (`PortalDownloadContext`, que **nao** tem campo `scope`) e sessao de
  portal. A conferencia so cabe no segundo.
- `GET /portal/pets/{id}/exames` atende tutor, clinica e parceiro - a permissao
  exigida ali tem que ser a comum aos tres (`exam:read`), nao a especifica de cada um.
- `PORTAL_SESSION_TOKEN_EXPIRE_MINUTES = 30`: qualquer token vivo no momento do
  deploy tem no maximo 30 minutos, e todos foram emitidos com escopo cheio.
- Nenhum workflow de `pull_request` roda a suite Python completa; so o
  `migrations-ci.yml` roda cinco arquivos nomeados.

## 5) Impacto esperado

- Usuarios impactados: nenhum, se a analise estiver certa - e esse e exatamente o
  ponto que precisa de teste, nao de confianca.
- Modulos impactados: `backend/app/api/v1/endpoints/portal.py` e o workflow de CI.
- Risco de regressao: **medio** - e mudanca de autorizacao em endpoints usados por
  clinicas reais. Baixa em magnitude (toda sessao atual passa), alta em consequencia
  se a analise estiver errada (clinica perde acesso ao financeiro sem aviso).

## 6) Riscos iniciais

- Risco 1: algum caminho de emissao de token gravar escopo incompleto sem que o
  levantamento tenha visto - a clinica perderia acesso na hora do deploy.
- Risco 2: endpoint esquecido no levantamento continua sem conferencia nenhuma - a
  feature seguinte nasceria com um furo silencioso.
- Risco 3: colocar a conferencia dentro do helper compartilhado faz um endpoint
  futuro herdar `clinic:read` sem que o autor perceba.
- Risco 4: sendo mudanca de autorizacao sem cobertura no CI de PR, uma regressao
  futura so apareceria depois do merge.

## 7) Perguntas abertas

- Vale estender a conferencia aos endpoints administrativos do portal
  (`/admin/clinicas/...`)? Eles autenticam por usuario interno com matriz de
  permissao propria, entao ficaram de fora - mas sao a unica parte do portal que
  segue sem conferencia de escopo depois desta entrega.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.

## 9) Sugestoes de novos recursos (para validar e priorizar, nao e compromisso)

- Levar a suite Python inteira para um gate de `pull_request` em `scripts/ci/`: hoje
  ela so roda no deploy, depois do merge, e mudancas de autorizacao como esta
  merecem barreira antes.
- Depois de `portal-clinica-dispositivo-confiavel`, considerar escopo por permissao
  tambem no portal do veterinario parceiro individual, que tem o mesmo desenho.
