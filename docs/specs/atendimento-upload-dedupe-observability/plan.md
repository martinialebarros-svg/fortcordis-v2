# Plan - atendimento-upload-dedupe-observability

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: in-progress

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): criar estrutura de metrica de dedupe.
- Fase 2 (backend/API): instrumentar upload e expor consulta diaria.
- Fase 3 (qualidade): testes automatizados + validação manual curta.
- Fase 4 (operacao): validar em stage/producao e documentar verify.

## 2) Tarefas por fase

### Fase 1

- [ ] T1.1 Criar migracao da tabela `upload_dedupe_metricas`.
- [ ] T1.2 Definir indices por data/clinica para leitura eficiente.
- Criterio de conclusao: schema pronto para escrita/consulta diaria.
- Risco: modelagem excessiva para primeira versao.
- Rollback: simplificar para tabela minima.

### Fase 2

- [ ] T2.1 Instrumentar caminho de upload novo e deduplicado.
- [ ] T2.2 Garantir `try/except` para nao quebrar upload se metrica falhar.
- [ ] T2.3 Criar endpoint de consulta diaria agregada.
- Criterio de conclusao: eventos registrados e consultaveis por dia.
- Risco: ruido de logs sem padrao.
- Rollback: manter apenas logs e desativar persistencia.

### Fase 3

- [ ] T3.1 Adicionar testes de agregacao/registro de metrica.
- [ ] T3.2 Executar suites de upload + novo endpoint.
- [ ] T3.3 Rodar lint frontend (sanidade geral de atendimento).
- Criterio de conclusao: cobertura minima e sem regressao.
- Risco: mocks insuficientes para cenarios de corrida.
- Rollback: segurar promocao ate estabilizar testes.

### Fase 4

- [ ] T4.1 Validar em stage com uploads novos e deduplicados.
- [ ] T4.2 Conferir consulta diaria com numeros esperados.
- [ ] T4.3 Atualizar `verify.md` e decisao de release.
- Criterio de conclusao: CA-001..CA-005 marcados `ok`.
- Risco: discrepancia de contagem entre ambientes.
- Rollback: manter coleta em stage ate calibrar.

## 3) Plano de testes

- Testes unitarios:
- registro de metrica em cada fonte (`novo`, `precheck`, `collision`).
- Testes de integracao:
- endpoint de consulta diaria com filtros.
- Testes manuais:
- disparar uploads controlados e comparar contagem esperada x retornada.

## 4) Dependencias e bloqueios

- Dependencia 1: estabilidade dos fluxos de dedupe ja publicados.
- Dependencia 2: disponibilidade de migracao aplicada em stage/producao.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
