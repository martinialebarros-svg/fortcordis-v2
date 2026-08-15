# Plan - portal-clinica-recibo-os

Data: 2026-08-08
Status: concluido (implementado; aguardando QA manual do usuario em stage)

## Tarefas

- [x] Extrair `_montar_recibos_os` e `_carregar_dados_emissor_recibo_empresa` de
      `gerar_recibos_os_pdf` em `ordens_servico.py` (refatoracao pura).
- [x] Atualizar `gerar_recibos_os_pdf` para usar as funcoes extraidas, preservando comportamento.
- [x] Novo endpoint `GET /clinicas/ordens-servico/{id}/recibo` em `portal.py`, reaproveitando as
      funcoes extraidas + `_gerar_pdf_recibos_ordens`.
- [x] Testes automatizados em `backend/tests/test_portal_clinica_recibo.py`: download bem-sucedido
      da propria clinica, bloqueio para OS de outra clinica (404), bloqueio para OS pendente (404).
- [x] `downloadPortalClinicOSRecibo` em `frontend/lib/portal-api.ts`.
- [x] Botao "Recibo" por linha na lista de "Pagas" em `PortalClinicaWorkspace.tsx`.

Criterio de conclusao: testes automatizados verdes + suite completa do backend sem regressao
(inclui a rota interna de recibo, que so foi refatorada, nao reescrita); tsc/eslint limpos; boot
do dev server sem erro em `/clinica-parceira` e em `/financeiro` (tela interna que usa a mesma
logica refatorada).

Rollback: reverter os commits de backend/frontend. A refatoracao em `ordens_servico.py` e um
`git revert` seguro (extracao pura, sem migracao envolvida).

## Plano de testes

- Automatizado (backend): `python -m unittest discover -s backend/tests -p "test_*.py"` — 685
  testes, 0 falhas, 1 skip (mesmo skip pre-existente).
- Automatizado (frontend): `tsc --noEmit`, `eslint`, boot do `next dev` em `/clinica-parceira` e
  `/financeiro` — ambos 200, sem erro.
- Manual: pendente — usuario vai liberar para stage.
