# Plan - atendimento-verificar-pdf-real

Data: 2026-08-05
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Sequencia de fases

- Fase 1 (backend): nova funcao `attachment_is_verified_pdf`; integracao
  no gate de `liberar_exame_no_portal`.
- Fase 2 (verificacao): testes, `bash -n`/`pytest`, revisao adversarial
  leve (dado o escopo pequeno e isolado), `verify.md`.

## 2) Tarefas por fase

### Fase 1

- [ ] T1.1 `attachment_download_service.py`: `PDF_MAGIC_BYTES`,
  `_bytes_look_like_pdf`, `attachment_is_verified_pdf`.
- [ ] T1.2 `atendimento.py`: adicionar `attachment_is_verified_pdf(anexo)`
  a condicao do gate em `liberar_exame_no_portal`.
- Criterio de conclusao: testes novos passam, suite completa aprovada.
- Risco: baixo - funcao nova, isolada, chamada em um unico ponto.
- Rollback: reverter o commit.

### Fase 2

- [ ] T2.1 Testes unitarios de `attachment_is_verified_pdf` (local/remoto/
  falha).
- [ ] T2.2 Teste de integracao em `liberar_exame_no_portal` (anexo falso
  bloqueado; PDF genuino continua liberando).
- [ ] T2.3 Revisao por 1 agente ceptico (escopo pequeno nao justifica
  workflow completo de 5 revisores como nos pacotes anteriores).
- [ ] T2.4 `verify.md`.
- Criterio de conclusao: suite verde, revisao sem achados bloqueantes.

## 3) Plano de testes

- Backend: novo arquivo de teste dedicado a `attachment_is_verified_pdf` +
  extensao do teste de integracao de `liberar_exame_no_portal` ja
  existente (criado pela outra sessao) com um caso de anexo falso.

## 4) Dependencias e bloqueios

- Depende do estado atual de `origin/stage` (inclui o trabalho da outra
  sessao para os achados #17, #19, #20 parcial, #21, #22/#23, race
  conditions). Nenhum bloqueio adicional.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
