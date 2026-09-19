# Verify - portal-clinica-link-laudo-whatsapp

Data: 2026-09-18
Responsavel: Martiniano Barros
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `tests/test_laudo_portal_whatsapp_link.py::test_flag_ligada_envia_modelo_com_link` - modelo `portalReportLink`, 4 parametros, 4o com `/laudo/<token>` | ok |
| CA-002 | aceitacao | `tests/test_laudo_portal_whatsapp_link.py::test_flag_desligada_mantem_o_aviso_de_antes` - `portalReportAvailable`, 3 parametros, nenhum link emitido | ok |
| CA-003 | aceitacao | `tests/test_laudo_portal_whatsapp_link.py::test_modelo_com_link_indisponivel_degrada_para_o_aviso_sem_link` - ordem das chamadas e chave de idempotencia distinta na degradacao | ok |
| CA-004 | aceitacao | `tests/test_portal_clinic_exam_link.py::test_link_valido_entrega_o_exame_e_o_download` | ok |
| CA-005 | aceitacao | `tests/test_portal_clinic_exam_link.py::test_token_inexistente_revogado_ou_despublicado_devolve_404` - os tres casos com o mesmo `detail` | ok |
| CA-006 | aceitacao | `tests/test_portal_clinic_exam_link.py::test_download_token_fica_preso_ao_par_exame_anexo` - claims `portal_exame_id` / `portal_anexo_id` | ok |
| CA-007 | aceitacao | `tests/test_portal_clinic_exam_link.py::test_link_valido_entrega_o_exame_e_o_download` - resposta sem `access_token`; `decode_portal_session_token` recusa o token de download | ok |
| CA-008 | aceitacao | `tests/test_portal_clinic_exam_link.py::test_token_inexistente_revogado_ou_despublicado_devolve_404` (exame fora do ar) + suite de revogacao em `test_atendimento_portal_exam_release.py` | ok |
| CA-009 | aceitacao | `tests/test_portal_clinic_exam_link.py::test_reenvio_reaproveita_o_link_ativo` - mesma linha, mesmo token | ok |
| CA-010 | aceitacao | `tests/test_portal_clinic_exam_link.py::test_abertura_conta_acessos` | ok |
| CA-011 | aceitacao | `frontend/components/portal/PortalExamLinkWorkspace.test.tsx` - 3 casos (laudo, link invalido, sem arquivo) | ok |
| CA-012 | aceitacao | `npm run test:inbox-ui` no `whatsapp-stage-backend` - catalogo segue com 12 modelos | ok |
| CB-003 | borda | `tests/test_portal_clinic_exam_link.py::test_reemissao_depois_de_revogar_gera_token_diferente` | ok |
| CB-005 | borda | `tests/test_portal_clinic_exam_link.py::test_token_com_formato_impossivel_nao_consulta_o_banco` | ok |
| NFR-001 | nao funcional | CA-007 + `test_link_de_outra_clinica_nao_abre_o_exame` (vinculo exame/clinica reconferido a cada abertura) | ok |
| NFR-002 | nao funcional | `derive_link_token` = HMAC-SHA256(SECRET_KEY, exame + nonce); banco guarda so SHA-256. Coberto por CA-001 (URL leva o token derivado, nao o nonce) e CB-003 | ok |
| NFR-003 | nao funcional | CA-005 - mesmo 404 e mesmo `detail` nos tres casos; teste de frontend confere que a tela nao distingue os motivos | ok |
| NFR-004 | nao funcional | CA-001 - `link_incluido` na auditoria e a URL ausente dos detalhes; `PORTAL_EXAM_LINK_OPENED` registrado em `abrir_laudo_por_link` | ok |
| NFR-005 | nao funcional | CA-002 + suite completa de backend sem regressao | ok |
| NFR-006 | nao funcional | Resposta limitada a clinica, pet, tipo de exame e data (`PortalExamLinkResponse`); sem tutor, CPF ou telefone | ok |
| Migracao | banco | `20260918_87_portal_clinic_exam_links` aplicada em banco limpo pela suite; **falta rodar em stage/producao** | pendente |
| Meta | dependencia externa | Modelo `laudo_disponivel_portal_link` com `metaId: PENDING_META_APPROVAL` - **aguardando aprovacao no Business Manager** | pendente |
| Stage | manual | Verificacao ponta a ponta em `app.stage.fortcordis.com.br` com a flag ligada | pendente |

## 2) Testes automatizados executados

Comandos:

```bash
cd backend && python -m pytest tests/ -q
```

```bash
cd frontend && npx tsc --noEmit && npm run lint && npm test
```

```bash
cd whatsapp-stage-backend && npm run build && npm run test:approved-templates && npm run test:document-templates && npm run test:inbox-ui
```

Resumo dos resultados:

- Backend: **1376 passaram, 7 pulados, 290 subtests** (53s). Inclui os 11 testes novos
  (`test_portal_clinic_exam_link.py` com 8 e `test_laudo_portal_whatsapp_link.py` com 3).
- Frontend: `tsc --noEmit` sem erro; `eslint --max-warnings=0` limpo;
  **48 arquivos / 368 testes** no vitest e **9** no `node --test`.
- whatsapp-stage-backend: `tsc` limpo; catalogo de 16 modelos aprovado no
  `test:approved-templates`; `test:document-templates` e `test:inbox-ui` passando
  (este ultimo confirmando os 12 modelos da caixa de entrada).

Regressao corrigida no caminho: cinco suites de `atendimento`/`laudo` montam o
schema SQLite a mao e passaram a depender da tabela nova, porque
`revogar_liberacao_exame_no_portal` agora revoga os links. As cinco receberam
`PortalClinicExamLink.__table__` na lista de tabelas - a alternativa (tolerar
tabela ausente no servico) esconderia erro real em producao.

## 3) Testes manuais

Ainda nao executados. Roteiro para a verificacao em stage:

- Cenario 1: liberar um laudo de clinica com WhatsApp cadastrado, com
  `PORTAL_CLINIC_EXAM_LINK_ENABLED=true`, e conferir que a mensagem chega com link
  clicavel. **Depende da aprovacao do modelo na Meta.**
- Cenario 2: abrir o link no celular, sem sessao nenhuma, e baixar o PDF.
- Cenario 3: abrir o mesmo link de novo dias depois (link nao expira).
- Cenario 4: revogar a liberacao do exame e conferir que o link para de funcionar.
- Cenario 5: reenviar o aviso do mesmo exame e conferir que a URL e a mesma.
- Cenario 6: com a flag desligada, conferir que o aviso sai igual ao de hoje.

## 4) Regressao e riscos residuais

- Risco residual 1: **o link e credencial ao portador num canal compartilhado.**
  Encaminhamento ou print entrega aquele laudo a terceiros. Mitigado por escopo de
  um exame, revogacao, auditoria de cada abertura e morte automatica quando o exame
  sai do ar - nao eliminado. Aceito explicitamente pelo usuario em 2026-09-18.
- Risco residual 2: **link sem expiracao** amplia a janela em relacao a um token
  curto. Foi a escolha deliberada para que a secretaria reabra a mensagem antiga
  sem ligar para a Fort Cordis.
- Risco residual 3: **rotacao da SECRET_KEY invalida todos os links ja enviados.**
  O servico detecta (hash derivado nao bate) e emite link novo no proximo aviso,
  mas os links ja entregues no WhatsApp morrem silenciosamente. Nao ha rotina de
  reemissao em massa.
- Risco residual 4: nao ha limite de tentativas no endpoint publico. O token tem
  256 bits de entropia, o que torna forca bruta inviavel, mas tambem nao ha
  rate limit para abuso de um token valido conhecido.
- Regressao coberta: a suite completa de backend e frontend passa sem falha.

## 5) Itens fora de escopo entregues

- Nenhum. Confianca de dispositivo, reenvio pelo bot, recuperacao de senha por
  WhatsApp e envio do link por e-mail seguem fora, como a spec previu.

## 6) Decisao de release

- [x] Aprovado para stage (com `PORTAL_CLINIC_EXAM_LINK_ENABLED=false` no primeiro
      deploy; ligar so depois de conferir que o aviso continua saindo normalmente).
- [ ] Aprovado para producao - **bloqueado** ate: (a) o modelo
      `laudo_disponivel_portal_link` ser aprovado pela Meta e ter o `metaId` real
      no lugar de `PENDING_META_APPROVAL`; (b) os 6 cenarios manuais rodarem em
      stage; (c) a migracao `20260918_87` ser aplicada.
- [ ] Nao aprovado.
