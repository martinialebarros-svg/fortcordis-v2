# Verify - PERF-09 Atendimento: bibliotecas secundarias sob demanda

## Evidencia local

- [x] `frontend/lib/atendimento-library-loading.test.ts`: URLs de pacientes, medicamentos e frases mantem limites paginados e mesclam paginas sem duplicacao.
- [x] `backend/tests/test_clinical_phrase_service.py`: `skip`, `limit` e `total` preservam a ordenacao e separam paginas.
- [x] `cd frontend && npm test`
- [x] `cd frontend && npm run lint`
- [x] `cd frontend && npm run build`
- [ ] `python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD`

## Aceite em stage

- [ ] A abertura autenticada de `/atendimento` conclui sem requisicoes de catalogo completo de pacientes, medicamentos ou frases.
- [ ] Buscar paciente apos dois caracteres devolve sugestoes limitadas e permite selecionar o registro.
- [ ] Abrir Prescricao carrega medicamentos em pagina limitada; buscar e selecionar medicamento continua funcional.
- [ ] As frases da etapa clinica visivel surgem sem bloquear o editor; mudar de etapa carrega somente as novas secoes necessarias.
- [ ] Bibliotecas permite pesquisar e carregar paginas adicionais de medicamentos e frases.

## Publicacao

- [ ] PR para `stage` aprovado e workflow terminal verde.
- [ ] Smoke autenticado em stage aprovado.
- [ ] Promocao para producao autorizada separadamente.
