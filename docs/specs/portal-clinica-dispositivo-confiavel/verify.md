# Verify - portal-clinica-dispositivo-confiavel

Data: 2026-09-18
Responsavel: Martiniano Barros
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | Coberto por `portal-escopo-sessao-clinica` (CA-001 a CA-003 de la), entregue no PR #173 | ok |
| CA-002 | aceitacao | `test_portal_escopo_sessao.py::test_escopo_so_laudos_continua_lendo_exames_liberados` (inclui painel operacional) | ok |
| CA-003 | aceitacao | Coberto por `portal-escopo-sessao-clinica` (CA-004 de la, 4 subtests), entregue no PR #173 | ok |
| CA-004 | aceitacao | `test_portal_clinic_device_trust.py::test_conectar_cria_confianca_com_escopo_so_de_laudos` - escopo do token decodificado, sem `clinic:read` | ok |
| CA-005 | aceitacao | `test_portal_clinic_device_trust.py::test_conectar_com_link_invalido_nao_cria_nada` - mesmo 404 e mesmo `detail` da abertura do laudo | ok |
| CA-006 | aceitacao | `test_portal_clinic_device_trust.py::test_sessao_rotaciona_o_cookie_e_renova_o_prazo` - cookie anterior devolve 401 | ok |
| CA-007 | aceitacao | `test_portal_clinic_device_trust.py::test_confianca_sem_uso_alem_do_prazo_expira` - status vira `expired` | ok |
| CA-008 | aceitacao | `test_portal_clinic_device_trust.py::test_navegador_diferente_encerra_a_confianca` - revoga, nao so recusa | ok |
| CA-009 | aceitacao | `test_portal_clinic_device_trust.py::test_revogar_o_link_de_origem_derruba_a_confianca` | ok |
| CA-010 | aceitacao | `test_portal_clinic_device_trust.py::test_encerrar_revoga_e_e_idempotente` | ok |
| CA-011 | aceitacao | `test_portal_clinic_device_trust.py::test_falha_no_aviso_ao_gestor_nao_impede_a_conexao` | ok |
| CA-012 | aceitacao | `test_portal_clinic_device_trust.py::test_admin_revoga_por_dispositivo_e_por_clinica` (inclui 422 sem alvo) | ok |
| CA-013 | aceitacao | `test_portal_clinic_device_trust.py::test_sessao_de_rotina_nao_gera_auditoria` | ok |
| CA-014 | aceitacao | `PortalClinicaPageShell` tenta `resumePortalDeviceSession` depois do refresh por senha; coberto indiretamente pelos testes de modo laudos e por `tsc`. **Sem teste proprio** - ver risco residual 6 | pendente |
| CA-015 | aceitacao | `PortalClinicaWorkspaceModoLaudos.test.tsx` - 5 casos (abas escondidas, abas presentes com senha, cabecalho, sair do computador) | ok |
| CB-001 | borda | Ordem de bootstrap no shell da a precedencia a sessao com senha; `PortalClinicaWorkspaceModoLaudos.test.tsx` cobre os dois modos em separado. Convivencia real dos dois cookies: **so em stage** | pendente |
| CB-002 | borda | `PortalExamLinkWorkspace.test.tsx::falha ao conectar sem tirar o laudo da tela` | ok |
| CB-005 | borda | `test_portal_clinic_device_trust.py::test_sessao_rotaciona_o_cookie_e_renova_o_prazo` (sessao com a flag desligada) e `test_flag_desligada_impede_conectar` | ok |
| RF-014 | funcional | `test_portal_clinic_device_trust.py::test_clinica_inativa_invalida_a_confianca` | ok |
| NFR-001 | nao funcional | CA-004 (escopo do token) + CA-003 (403 na gestao) + `_resolver_link_laudo` compartilhado entre abrir laudo e conectar | ok |
| NFR-002 | nao funcional | Coberto por `portal-escopo-sessao-clinica` | ok |
| NFR-003 | nao funcional | Cookie proprio `PORTAL_CLINIC_DEVICE_TRUST_COOKIE_NAME`, `httponly=True`, mesmo `samesite`/`secure` do refresh; testes leem o `set-cookie` da resposta | ok |
| NFR-004 | nao funcional | Token opaco `generate_opaque_token` guardado por `hash_secret`; rotacionado a cada uso (CA-006) | ok |
| NFR-005 | nao funcional | CA-013 | ok |
| NFR-006 | nao funcional | Todas as recusas de `dispositivo/sessao` devolvem 401 com o mesmo `detail` e limpam o cookie (CA-006 a CA-009, RF-014) | ok |
| NFR-007 | nao funcional | Modo laudos usa os mesmos endpoints de exame do portal com senha; nenhum dado novo exposto | ok |
| Migracao | banco | `20260918_88` aplicada em banco limpo pela suite; **falta rodar em stage/producao** | pendente |
| Stage | manual | 7 cenarios da secao 3 em `app.stage.fortcordis.com.br` | pendente |

## 2) Testes automatizados executados

Comandos:

```bash
cd backend && python -m pytest tests/ -q
```

```bash
cd frontend && npx tsc --noEmit && npm run lint && npm test
```

```bash
cd whatsapp-stage-backend && npm run build && npm run test:approved-templates && npm run test:inbox-ui
```

Resumo dos resultados:

- Backend: **1397 passaram, 7 pulados, 297 subtests** (54s). Inclui os 12 testes
  novos de `test_portal_clinic_device_trust.py`.
- Frontend: `tsc` limpo, `eslint --max-warnings=0` limpo,
  **49 arquivos / 376 testes** no vitest e 9 no `node --test`.
- whatsapp-stage-backend: `tsc` limpo, catalogo e contratos da caixa de entrada
  passando (nao foi tocado nesta entrega; rodado por garantia).
- `test_portal_clinic_device_trust.py` entrou na lista do `migrations-ci.yml`, ao
  lado de `test_portal_escopo_sessao.py`: os dois cobrem autorizacao e sao o unico
  Python que roda em `pull_request`. Conferido rodando por `unittest` como o CI
  invoca (21 testes, OK).

Regressao corrigida no caminho: sete suites que montam schema SQLite a mao
passaram a depender de `portal_clinic_trusted_devices`, porque revogar a liberacao
do exame agora revoga as confiancas. As sete receberam a tabela na lista.

## 3) Testes manuais

Pendentes em stage, com a flag `PORTAL_CLINIC_DEVICE_TRUST_ENABLED` ligada:

- Cenario 1: abrir um laudo pelo link, marcar "manter esta unidade conectada" e
  conferir que `/clinica-parceira` abre direto na lista de exames.
- Cenario 2: conferir que agenda e financeiro nao aparecem, e que chamada direta a
  `/portal/clinicas/financeiro` com esse token devolve 403.
- Cenario 3 (CB-001): logar com senha no mesmo navegador e conferir que o portal
  completo volta, com os dois cookies convivendo.
- Cenario 4: "Sair deste computador" e confirmar que o acesso acaba.
- Cenario 5: revogar o link de origem e confirmar que a confianca cai junto.
- Cenario 6: revogar pelo admin (`/admin/clinica-dispositivos/revogar`).
- Cenario 7 (CB-002): navegador anonimo com cookies bloqueados - a acao falha com
  mensagem clara e o download do laudo continua funcionando.

## 4) Regressao e riscos residuais

- Risco residual 1: **um link encaminhado permite criar confianca** e, com ela,
  acesso continuado ao acervo de laudos da clinica. Contido por escopo travado em
  `exam:*`, expiracao por inatividade, rotacao de cookie, amarracao ao navegador,
  revogacao e aviso ao gestor - nao eliminado. Aceito em 2026-09-18.
- Risco residual 2: maquina compartilhada na recepcao expoe os laudos da unidade a
  quem sentar nela.
- Risco residual 3: computador trocado ou roubado segue confiavel ate expirar por
  inatividade ou ser revogado.
- Risco residual 4: **30 dias de inatividade** (decidido em 18/09/2026) e uma
  escolha de operacao, nao uma medicao. Clinica que so manda exame a cada dois
  meses vai perder a confianca da maquina entre um envio e outro e precisara
  reconectar pelo link seguinte - o que funciona, mas e um passo a mais. O numero
  continua configuravel por `PORTAL_CLINIC_DEVICE_TRUST_INACTIVITY_DAYS`; vale
  revisitar depois de ver os dados de `last_seen_at` das primeiras unidades.
- Risco residual 5: nao ha limite de dispositivos confiaveis por clinica, nem tela
  para a propria unidade listar os seus (so "sair deste computador" no navegador
  atual). Uma unidade com varias maquinas acumula confiancas que so a Fort Cordis
  enxerga.
- Risco residual 6: **CA-014 e CB-001 nao tem teste automatizado.** A ordem do
  bootstrap (senha antes de dispositivo) esta coberta so por leitura e por `tsc`;
  a convivencia real dos dois cookies no mesmo navegador so se confirma em stage.
- Regressao: suites de backend, frontend e do servico Node verdes.

## 5) Itens fora de escopo entregues

- `migrations-ci.yml` ganhou mais um arquivo de teste (o de confianca de
  dispositivo), seguindo a decisao tomada em `portal-escopo-sessao-clinica`.
- `PortalExamLinkResponse` ganhou `dispositivo_confiavel_disponivel`, para a tela
  nao duplicar a flag do backend. Nao estava na spec; e a alternativa a expor a
  mesma decisao em dois lugares.

## 6) Decisao de release

- [x] Aprovado para stage (com `PORTAL_CLINIC_DEVICE_TRUST_ENABLED=false` no
      primeiro deploy; ligar so depois de conferir que o portal com senha segue
      normal).
- [ ] Aprovado para producao - **bloqueado** ate: (a) `portal-escopo-sessao-clinica`
      estar em producao; (b) os 7 cenarios manuais rodarem em stage; (c) a migracao
      `20260918_88` ser aplicada. O prazo de inatividade ficou decidido em
      **30 dias** (18/09/2026).
- [ ] Nao aprovado.
