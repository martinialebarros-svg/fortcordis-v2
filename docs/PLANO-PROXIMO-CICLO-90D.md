# Plano Proximo Ciclo 90D

Documento operacional para priorizar a divida remanescente apos os entregaveis concluidos ate `FOR-44`.

## 1) Objetivo do ciclo

Fechar lacunas de confiabilidade e seguranca ainda abertas, mantendo velocidade de entrega sem regressao nas areas ja estabilizadas.

## 2) Baseline atual (snapshot)

Com base no backlog atual do projeto `Fort Cordis v2 - Stabilization 90D`:

- frentes de risco imediato abertas:
  - `FOR-42` (regressao de seguranca completa)
  - `FOR-41` (teste de carga focado)
- frentes estruturais abertas:
  - backend modularizacao: `FOR-37`, `FOR-38`
  - frontend modularizacao: `FOR-39`, `FOR-40`
- epics ainda sem fechamento formal:
  - `FOR-5`, `FOR-6`, `FOR-7`, `FOR-8`, `FOR-9`, `FOR-11`, `FOR-12`

## 3) KPIs do proximo ciclo

KPIs de saida (nao de atividade):

1. Seguranca:
   - checklist de regressao (`FOR-42`) com 100% dos itens criticos aprovados.
2. Performance:
   - relatorio de carga (`FOR-41`) com baseline/p95/p99 dos endpoints prioritarios e lista de gargalos residuais.
3. Arquitetura:
   - reducao de complexidade em modulos alvo (backend e frontend) sem regressao funcional.
4. Operacao:
   - padronizacao de evidencias de deploy/smoke anexadas nos cards executados.

## 4) Priorizacao recomendada (ordem de execucao)

### Onda 1 - Confiabilidade imediata (semana 1)

1. `FOR-42` REL-02 Regressao de seguranca completa
2. `FOR-41` REL-01 Teste de carga focado

Motivo:
- reduz risco de incidente em producao antes de refactors maiores.

### Onda 2 - Arquitetura backend (semanas 2-3)

1. `FOR-37` ARCH-BE-01 Modularizar `atendimento.py`
2. `FOR-38` ARCH-BE-02 Modularizar `relatorios.py`

Motivo:
- maior impacto em manutencao e estabilidade de dominio core.

### Onda 3 - Arquitetura frontend (semanas 3-4)

1. `FOR-39` ARCH-FE-01 Modularizar `atendimento/page.tsx`
2. `FOR-40` ARCH-FE-02 Padronizar cliente API e erros frontend

Motivo:
- melhora velocidade de iteracao em UI apos backend mais organizado.

### Onda 4 - Fechamento de epics (fim do ciclo)

Fechar epics quando todos os filhos criticos estiverem `Done` com evidencias:

- `FOR-11`, `FOR-12` (arquitetura)
- `FOR-9` (performance)
- `FOR-5` e `FOR-6` (seguranca), apos validacao de lacunas residuais.

## 5) Regras de execucao por task

Para cada task do ciclo:

1. abrir com `SDD` completo (`intent/spec/plan/verify`);
2. commit limpo por task (`FOR-xx`);
3. deploy `stage` + smoke objetivo;
4. promocao `main` somente apos evidencia de smoke aprovado;
5. atualizar Linear com hash/intervalo de push e resultado.

## 6) Riscos e mitigacoes

- risco: refactor grande sem cobertura suficiente.
  - mitigacao: quebrar em fatias pequenas e usar smoke funcional por modulo.
- risco: degradacao de performance durante modularizacao.
  - mitigacao: rodar comparativo de p95/p99 antes/depois nos endpoints tocados.
- risco: backlog de epics sem criterio objetivo de encerramento.
  - mitigacao: usar checklist de aceite por epic com evidencias em comments.

## 7) Definicao de pronto do ciclo

O ciclo e considerado concluido quando:

1. `FOR-42` e `FOR-41` estiverem concluidos com evidencias de execucao;
2. pelo menos uma frente backend e uma frontend de modularizacao concluida (`FOR-37/38` e `FOR-39/40`);
3. epics impactados tiverem status revisado no Linear com criterio explicito de fechamento ou pendencia.

