# Verify - PERF-09 Atendimento: bibliotecas secundarias sob demanda

## Evidencia local

- [x] `frontend/lib/atendimento-library-loading.test.ts`: URLs de pacientes, medicamentos e frases mantem limites paginados e mesclam paginas sem duplicacao.
- [x] `backend/tests/test_clinical_phrase_service.py`: `skip`, `limit` e `total` preservam a ordenacao e separam paginas.
- [x] `cd frontend && npm test`
- [x] `cd frontend && npm run lint`
- [x] `cd frontend && npm run build`
- [x] `python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD`

## Aceite em stage

- [x] A abertura autenticada de `/atendimento` concluiu sem spinner ou erro, com a orientacao de busca minima de paciente visivel.
- [x] A busca de paciente fica condicionada a pelo menos dois caracteres; a resposta e limitada pelo frontend a oito sugestoes.
- [x] Prescricao abriu em stage com a busca de medicamento disponivel e sem erro de biblioteca.
- [x] O editor e as frases clinicas abriram sem bloquear o Atendimento; o bundle servido contem o marcador da nova carga sob demanda.
- [x] Bibliotecas de frases e medicamentos abriram sem erro. Os catalogos atuais tem menos de 100 itens, portanto nao havia proxima pagina para exibir no smoke.

Evidencias: stage `b5f632fb`, [Deploy to Stage](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/33353795332) concluido com sucesso; app stage `200`; endpoint de frases sem sessao `401`; bundle `app/atendimento/page-5fd67b28ea45b348.js` contem o marcador da funcionalidade.

## Publicacao

- [x] PR para `stage` aprovado e workflow terminal verde.
- [x] Smoke autenticado em stage aprovado.
- [ ] Promocao para producao autorizada separadamente.

## Regressao de pool da biblioteca de frases — 2026-10-22

- [x] Antes da correcao: dois cenarios novos reproduzem `QueuePool TimeoutError` com pool de tres conexoes e overflow zero (pool ocupado e GETs simultaneos).
- [x] Depois da correcao: seis testes em `test_clinical_phrase*.py` passam, incluindo seed, filtros, paginacao, preservacao de trabalho pendente e tres GETs simultaneos com exatamente tres checkouts; zero DML durante as leituras com fixtures ja semeadas.
- [x] Regressao ampliada: 14 testes `*pool*.py`, lint e TypeScript do frontend passam.
- [x] Canario instalado em `ab1696852acf2cf0b4d6239dad7f6f519348e25a`: duas verificacoes funcionais e cinco rodadas de tres GETs, 15/15 HTTP 200, exatamente tres checkouts por rodada, zero DML nas leituras e zero schemas restantes.
- [x] [Deploy de stage](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/39876285706) terminal verde; API/worker/frontend reiniciados e snapshot instalado confirmado.
- [x] Seis arquivos de runtime e banco de frases preservados (33 frases stage, 35 producao); configuracao Maps preservada; zero chamadas a provedor. Producao permanece no snapshot anterior, sem alteracoes deste ciclo.
- [x] Resultado apresentado ao usuario em 22/10 antes de qualquer producao. A retirada de expiracao da matriz solicitada depois segue seu proprio ciclo de stage.

Reproducao local: `cd backend && <venv>/bin/python -m unittest discover -s tests -p 'test_clinical_phrase*.py' -v`. A identidade da prova HTTP e sintetica; a autenticacao apenas simula a ocupacao previa da conexao usando a mesma sessao do handler real. Os testes nao acessam o banco operacional.
