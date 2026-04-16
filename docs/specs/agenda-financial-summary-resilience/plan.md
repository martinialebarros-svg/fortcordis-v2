# Plan - agenda-financial-summary-resilience

Data: 2026-04-16  
Responsavel: Codex  
Status: done

## 1) Sequencia de fases

- Fase 1 (diagnostico): reproduzir o fluxo do resumo financeiro e identificar onde o valor cai para zero.
- Fase 2 (backend): endurecer o calculo da previsao e o fallback de precificacao.
- Fase 3 (frontend): explicitar indisponibilidade do resumo sem fingir faturamento zero.
- Fase 4 (validacao): cobrir com teste automatizado e validar guardrail SDD.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Inspecionar o card da agenda no frontend e a rota `/agenda/resumo-financeiro`.
- [x] T1.2 Reproduzir localmente o resumo do dia para confirmar o valor esperado.
- Criterio de conclusao: fluxo de falha identificado com clareza.
- Risco: diferenca entre ambiente local e deploy real.
- Rollback: nao aplicavel.

### Fase 2

- [x] T2.1 Tratar excecoes nao-HTTP no calculo da previsao por agendamento.
- [x] T2.2 Usar conversao segura de valores monetarios no resumo.
- [x] T2.3 Fazer fallback para preco base quando schema de precificacao customizada estiver ausente ou incompleto.
- Criterio de conclusao: o endpoint continua respondendo mesmo com registros problematicos.
- Risco: esconder problema de dados sem observabilidade.
- Rollback: reverter apenas os ajustes de resiliencia.

### Fase 3

- [x] T3.1 Adicionar estado de erro dedicado para o resumo financeiro no frontend.
- [x] T3.2 Exibir mensagem de indisponibilidade em vez de `R$ 0,00` quando a API falhar.
- Criterio de conclusao: UI nao comunica zero falso em falha de carregamento.
- Risco: usuarios precisarem acostumar com novo texto de erro.
- Rollback: voltar ao fallback anterior para zero.

### Fase 4

- [x] T4.1 Adicionar teste automatizado para falha pontual no calculo de preco.
- [x] T4.2 Adicionar teste automatizado para fallback sem tabela/coluna customizada.
- [x] T4.3 Validar `py_compile`, teste unitario, `eslint` e guardrail SDD.
- Criterio de conclusao: diff validado e pronto para `stage`.
- Risco: guardrail falhar por falta de artefato SDD no mesmo diff.
- Rollback: manter apenas a documentacao se a implementacao precisar ser retirada.

## 3) Plano de testes

- Testes unitarios: `python backend/tests/test_agenda_resumo_financeiro.py`.
- Testes estaticos backend: `python -m py_compile backend/app/api/v1/endpoints/agenda.py backend/app/services/precos_service.py backend/tests/test_agenda_resumo_financeiro.py`.
- Testes estaticos frontend: `npx eslint app/agenda/page.tsx`.
- Testes de processo: `python scripts/ci/check_sdd_guardrail.py --base-sha 1aa3ee7 --head-sha HEAD`.

## 4) Dependencias e bloqueios

- Dependencia 1: schema atual de `agendamentos`, `ordens_servico`, `clinicas` e `servicos`.
- Dependencia 2: regra de precificacao vigente em `precos_service.py`.
- Dependencia 3: branch `stage` limpa para publicar a correcao.

## 5) Checklist para iniciar execucao

- [x] `intent.md` preenchido.
- [x] `spec.md` preenchido.
- [x] Backend e frontend impactados identificados.
- [x] Validacoes locais definidas.
