# Verify - agenda-wizard-guiado-for50

Data: 2026-05-19  
Responsavel: Martiniano + Codex  
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | bloqueio de submit com `bloquearSalvarNovo` no modal | ok |
| CA-002 | aceitacao | acao `confirmarAceiteSugestaoAtual` muda estado para `aceito` e habilita salvar | ok |
| CA-003 | aceitacao | estado `sem_opcao` exige `motivoSemOpcao` antes de habilitar salvar | ok |
| CA-004 | aceitacao | condicao `!isEditando` para obrigatoriedade do wizard | ok |
| CA-005 | aceitacao | banner de `itensIgnoradosJanela` no card do assistente | ok |
| CA-006 | aceitacao | `buscarSugestoesHorario` prioriza `politica_oferta.datas_preferenciais` quando proximidade vier fora da politica | ok |
| CA-007 | aceitacao | `dataContatoAssistente` fixada no open do modal e enviada como `data_contato` em `buscarSugestaoProximidade` | ok |
| CA-008 | aceitacao | bloqueio de `input[type=date|time]` no modo novo enquanto decisao != `sem_opcao` | ok |
| NFR-002 | nao funcional | decisao anexada em `observacoesFinal` no submit | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd frontend && npx eslint app/agenda/NovoAgendamentoModal.tsx
cd frontend && npx tsc --noEmit
```

Resumo dos resultados:
- ESLint: ok.
- TypeScript: ok.

## 3) Testes manuais sugeridos (stage)

- Cenario 1: abrir `Novo Agendamento`, preencher clinica/servico/data e validar que salvar permanece bloqueado ate decidir no assistente.
- Cenario 2: gerar oferta, clicar `Cliente aceitou este horario` e validar habilitacao do botao `Salvar Agendamento`.
- Cenario 3: recusar todas as ofertas, validar exigencia de motivo e depois salvamento manual.
- Cenario 4: abrir `Editar Agendamento` e validar que fluxo antigo segue intacto.
- Cenario 5: clinica distante/baixa frequencia sem ancora em D+2 deve abrir oferta em D+3/D+4 (data preferencial), sem ancorar automaticamente em D+2 fora da politica.
- Cenario 6: abrir `Novo Agendamento`, aguardar alguns minutos e gerar sugestoes; validar que o comportamento de D+N permanece referenciado na data de abertura (sem drift de `data_contato`).
- Cenario 7: com assistente em estado pendente/aceito, confirmar bloqueio de data/hora manual; apos `sem_opcao`, confirmar liberacao para fallback manual.

## 4) Regressao e riscos residuais

- Risco residual 1: adesao operacional das secretarias depende de treinamento do novo fluxo.
- Risco residual 2: justificativas textuais ainda nao possuem taxonomia estruturada para analytics.

## 5) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado.
