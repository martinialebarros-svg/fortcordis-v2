# Verify - atendimento-verificar-pdf-real

Data: 2026-08-05
Responsavel: Claude (pareado com Martiniano)
Status: implementado, aguardando deploy

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-1 | aceitacao | `test_attachment_is_verified_pdf.py::test_arquivo_local_com_bytes_magicos_de_pdf_e_verificado`. | ok |
| CA-2 | aceitacao | `test_arquivo_local_sem_bytes_magicos_e_rejeitado`. | ok |
| CA-3 | aceitacao | `test_arquivo_local_inexistente_e_rejeitado`. | ok |
| CA-4 | aceitacao | `test_url_remota_com_conteudo_pdf_e_verificada`. | ok |
| CA-5 | aceitacao | `test_url_remota_com_conteudo_nao_pdf_e_rejeitada` + `test_url_remota_com_redirect_e_rejeitada` + `test_url_remota_com_falha_de_rede_e_rejeitada`. | ok |
| CA-6 | aceitacao | `test_atendimento_portal_exam_release.py::test_liberar_exame_com_conteudo_falso_e_bloqueado` - anexo com mime informado como PDF mas conteudo real diferente bloqueia a liberacao (422). | ok |
| CA-7 | aceitacao | `test_liberar_ecg_importado_normaliza_tipo_e_publica_exame` (ja existente, fixture da outra sessao ja escrevia conteudo `%PDF-` real) - continua passando sem alteracao. | ok |
| CA-8 | aceitacao | `cd backend && ./venv/bin/python -m pytest tests/ -q --no-header` -> **698 passed**. | ok |

## 2) Testes automatizados executados

```bash
cd backend && ./venv/bin/python -m pytest tests/ -q --no-header
# 698 passed, 25 warnings, 29 subtests passed

cd frontend && npm run build
# Compiled successfully (nenhuma mudanca de frontend neste pacote)
```

Testes novos (7 casos, 1 arquivo novo + 1 metodo adicionado):
- `test_attachment_is_verified_pdf.py` (6, novo) - `attachment_is_verified_pdf` isolada (local valido/invalido/inexistente, remoto valido/invalido/redirect/falha de rede).
- `test_atendimento_portal_exam_release.py::test_liberar_exame_com_conteudo_falso_e_bloqueado` (1, novo) - integracao com `liberar_exame_no_portal`.

## 3) Testes manuais

Nao aplicavel - pacote 100% backend, sem mudanca de frontend
(`git diff --stat -- frontend` vazio, confirmado na revisao).

## 4) Revisao adversarial

Escopo pequeno e isolado (uma funcao nova, aditiva, um unico ponto de
integracao) - revisao com 1 agente ceptico em vez do workflow completo de
5 revisores usado nos pacotes maiores anteriores.

**Veredito: correto, nenhum problema real encontrado.** Confirmado por
leitura de codigo:
- Aditividade real: `git diff` so mostra linhas adicionadas em
  `attachment_download_service.py` - nenhuma funcao existente
  (`resolve_attachment_download_source`, `attachment_has_download_source`,
  `_build_remote_headers`) foi modificada.
- Redirect (3xx) de servidor remoto e corretamente rejeitado (dupla
  protecao: `follow_redirects=False` + checagem explicita de
  `is_redirect`/`status_code`).
- Sem vazamento de conexao em nenhum caminho de erro (`client.close()`
  sempre executa via `finally`, mesmo quando `client.send()` lanca antes
  de `response` existir).
- Testes cobrem fielmente os cenarios reais (arquivo local/remoto,
  valido/invalido/inexistente, redirect, falha de rede).

## 5) Regressao e riscos residuais

- Suite completa (698 testes, incluindo todo o trabalho da sessao
  concorrente) sem nenhuma falha.
- Risco residual conhecido, aceito por design (ja documentado no
  `spec.md`): exames liberados no portal ANTES deste pacote nao sao
  revalidados retroativamente - o guard de idempotencia de
  `liberar_exame_no_portal` retorna cedo quando o exame ja esta liberado,
  sem invocar `attachment_is_verified_pdf` de novo.
- Nenhuma migration nova.

## 6) Nota sobre trabalho concorrente

Este pacote foi criado apos identificar que outra sessao do Claude Code
trabalhou em paralelo no mesmo backlog de auditoria
(`docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md`, encontrado ainda nao
commitado na working tree principal) e ja corrigiu a maior parte dos
achados restantes, incluindo uma versao mais simples deste mesmo achado
(#20). Este pacote foi deliberadamente reduzido, apos descartar um pacote
maior e conflitante, para contribuir apenas a melhoria que ainda faltava
(verificacao de conteudo real, nao so existencia) sem sobrescrever a
decisao de design da outra sessao para o achado #25 (bloquear edicao de
exame liberado, em vez de permitir+auditar).

## 7) Decisao de release

- [x] Aprovado para stage - `634789ba`, deploy-stage concluido com sucesso
  (sdd-guardrail + quality-gate + deploy-stage), sem drift com origin/stage.
- [ ] Aprovado para producao.
