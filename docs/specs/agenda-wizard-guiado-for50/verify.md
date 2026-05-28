# Verify - agenda-wizard-guiado-for50

Data: 2026-05-22  
Responsavel: Martiniano + Codex  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | bloqueio de submit com `bloquearSalvarNovo` no modal | ok |
| CA-002 | aceitacao | acao `confirmarAceiteSugestao` muda estado para `aceito` e habilita salvar | ok |
| CA-003 | aceitacao | estado `sem_opcao` exige `motivoSemOpcao` antes de habilitar salvar | ok |
| CA-004 | aceitacao | condicao `!isEditando` para obrigatoriedade do wizard | ok |
| CA-005 | aceitacao | banner de `itensIgnoradosJanela` no card do assistente | ok |
| CA-006 | aceitacao | `orquestrar_ofertas_assistente` prioriza data de proximidade operacional (mesmo fora de `datas_preferenciais`) e usa politica como fallback quando necessario | ok |
| CA-007 | aceitacao | `dataContatoAssistente` fixada no open do modal e enviada como `data_contato` em `buscarSugestaoProximidade` | ok |
| CA-008 | aceitacao | bloqueio de `input[type=date|time]` no modo novo enquanto decisao != `sem_opcao` | ok |
| CA-009 | aceitacao | `buscarSugestoesHorario` nao sobrescreve mais `formData.data` com `dataBaseBusca` | ok |
| CA-010 | aceitacao | `resolverIndiceEtapaWizardNovo` + bloco visual `Etapa atual`/`ETAPAS_WIZARD_NOVO` no card do assistente (3 etapas) | ok |
| CA-011 | aceitacao | render de `Panorama de ofertas` com `sugestoesHorario.map(...)` e aceite por item | ok |
| CA-012 | aceitacao | botao `Nenhuma oferta atende...` condicionado a `ofertasPanoramicasConsultadas` e `decisaoAssistente === "pendente"` | ok |
| CA-013 | aceitacao | `agenda.py` retorna vazio para data passada em `sugestoes-horario` e `sugestao-proximidade` | ok |
| CA-014 | aceitacao | `_classificar_politica_oferta` prioriza D0 para clinica proxima da base sem ancora D+2/D+3, com cobertura de cenarios positivo/negativo | ok |
| CA-015 | aceitacao | `sugerir_horarios_agenda` prioriza slot apos `ancora + 60min` na mesma clinica e frontend respeita ordem backend no fluxo de proximidade | ok |
| CA-016 | aceitacao | `criar_agendamento` forca recalculo de `fim` pela duracao do servico (`force_from_service=True`) no fluxo de criacao | ok |
| CA-017 | aceitacao | `sugerir_horarios_agenda` usa duracao oficial do servico quando `servico_id` existe, ignorando payload divergente | ok |
| CA-018 | aceitacao | `sugerir_agendamento_proximo` passa a usar deslocamento total do slot (`anterior + proximo`) para ranking e mensagem | ok |
| CA-019 | aceitacao | conflito operacional no salvar permite override apenas para admin via `confirmar_conflito_deslocamento`; nao-admin recebe `403` | ok |
| CA-020 | aceitacao | `test_orquestrador_busca_dias_seguintes_quando_panorama_inicial_vazio` valida busca progressiva D+N ate primeira data com oferta | ok |
| NFR-002 | nao funcional | decisao anexada em `observacoesFinal` no submit | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd frontend && npx eslint app/agenda/NovoAgendamentoModal.tsx
python3 -m py_compile backend/app/api/v1/endpoints/agenda.py backend/tests/test_agenda_sugestao_janela_operacional.py backend/tests/test_agenda_duracao_servico_create.py
cd backend && ./venv/bin/python -m pytest -q tests/test_agenda_sugestao_janela_operacional.py tests/test_agenda_duracao_servico_create.py
cd backend && ./venv/bin/python -m pytest -q tests/test_agenda_assistente_orquestrador_metricas.py
# evidencias de CI
gh run view 26316967933 --json jobs --jq '.jobs[] | {name, conclusion}'
```

Resumo dos resultados:
- ESLint: ok.
- PyCompile backend: ok.
- Pytest `test_agenda_sugestao_janela_operacional.py` + `test_agenda_duracao_servico_create.py`: `23 passed`.
- Pytest `test_agenda_assistente_orquestrador_metricas.py`: `6 passed`.
- CI `Deploy to Stage (VPS)` run `26316967933`: `quality-gate=success`, `sdd-guardrail=failure` (falta de docs neste commit), sem falha funcional de codigo.

## 3) Testes manuais sugeridos (stage)

- Cenario 1: abrir `Novo Agendamento`, preencher clinica/servico/data e validar que salvar permanece bloqueado ate decidir no assistente.
- Cenario 2: gerar oferta, clicar `Cliente aceitou este horario` e validar habilitacao do botao `Salvar Agendamento`.
- Cenario 3: recusar todas as ofertas, validar exigencia de motivo e depois salvamento manual.
- Cenario 4: abrir `Editar Agendamento` e validar que fluxo antigo segue intacto.
- Cenario 5: quando o assistente inteligente sugerir data de proximidade operacional fora de `datas_preferenciais`, o guiado deve tentar essa data primeiro; se nao houver slot nela, deve cair para D+3/D+4.
- Cenario 6: abrir `Novo Agendamento`, aguardar alguns minutos e gerar sugestoes; validar que o comportamento de D+N permanece referenciado na data de abertura (sem drift de `data_contato`).
- Cenario 7: com assistente em estado pendente/aceito, confirmar bloqueio de data/hora manual; apos `sem_opcao`, confirmar liberacao para fallback manual.
- Cenario 8: selecionar uma data no formulario, gerar oferta automatica e confirmar que a data exibida no campo nao muda sozinha; mudar somente por aceite explicito de oferta.
- Cenario 9: validar evolucao visual das etapas (1/3 a 3/3) ao preencher dados, gerar oferta panoramica e concluir desfecho.
- Cenario 10: informar data passada (ex.: ontem) e validar ausencia de ofertas com mensagem orientativa para hoje/futuro.
- Cenario 11: clinica proxima da base, sem ancoras em D+2/D+3, com ancora em D0 => prioridade D0.
- Cenario 12: clinica proxima da base, D0 vazio e sem ancoras em D+2/D+3 => prioridade D0.
- Cenario 13: clinica proxima da base com ancora em D+2 ou D+3 => nao priorizar D0.
- Cenario 14: mesma clinica com ancora as 10:00 e slots livres apos esse horario -> primeira oferta operacional em 11:00.
- Cenario 15: servico com duracao de 20min (ex.: ECG), aceite oferta do assistente e salvar -> evento final deve ocupar apenas 20min na agenda.
- Cenario 16: com servico de 20min, forcar frontend a enviar `duracao_minutos=60` na busca de ofertas -> oferta retornada deve permanecer em janela de 20min.
- Cenario 17: na proximidade, validar caso com vizinho anterior e posterior no slot sugerido -> deslocamento exibido deve refletir soma dos dois lados.
- Cenario 18: provocar `CONFLITO_DESLOCAMENTO` no salvar; com perfil admin confirmar excecao no popup e validar persistencia do agendamento.
- Cenario 19: repetir o mesmo conflito com perfil nao-admin e validar ausencia de override (mensagem orientativa + bloqueio).
- Cenario 20: sem slots em D+2/D+3/D+4 (agenda cheia ou fechada), clicar `Gerar melhor oferta` e validar que o assistente avanca automaticamente para D+5, D+6... ate retornar a primeira data com ofertas.

## 4) Regressao e riscos residuais

- Risco residual 1: adesao operacional das secretarias depende de treinamento do novo fluxo.
- Risco residual 2: justificativas textuais ainda nao possuem taxonomia estruturada para analytics.
- Risco residual 3: ambiente local sem `fastapi` nao reproduz toda a suite backend fora do CI.

## 5) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado.
