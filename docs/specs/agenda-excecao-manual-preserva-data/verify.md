# Verify - agenda-excecao-manual-preserva-data

Data: 2026-09-09  
Responsavel: Martiniano Barros  
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `NovoAgendamentoModal.excecao-manual.test.tsx` - "mantem motivo e horario liberados ao trocar a data depois da excecao concedida" (assert `inputHora.disabled === false` apos trocar a data) | ok |
| CA-002 | aceitacao | mesmo teste: textarea do motivo preserva o texto e "Excecao concedida por admin" segue no DOM | ok |
| CA-003 | aceitacao | mesmo teste: "Oferta 1:" sai do DOM e aparece "Data ajustada sob excecao concedida" | ok |
| CA-004 | aceitacao | `NovoAgendamentoModal.excecao-manual.test.tsx` - "mantem o bloqueio guiado sem excecao..." (data e hora `disabled` com panorama gerado e apos recusar todas) | ok |
| CA-005 | aceitacao | mesmo teste: apos "Revogar excecao", data e hora voltam a `disabled` | ok |
| RF-001..RF-005 | funcional | `agenda-assistente-excecao.test.ts` (8 casos) + testes de componente acima | ok |
| RF-006 | funcional | guarda `if (excecaoManualAtiva) return;` antes do cooldown/popup em `buscarSugestaoProximidade`; revisao de codigo | ok |
| NFR-002 | nao funcional | `excecaoManualEstaLiberada` exige `isAdmin`, `decisaoAssistente === "sem_opcao"` e `excecaoConcedida`; payload de `POST /agenda` inalterado | ok |
| Regressao | teste negativo | com o `handleDataChange` antigo (`if (!isEditando) resetFluxoAssistente()`), o teste de CA-001 falha em `expect(inputHora.disabled).toBe(false)` | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd frontend
npx tsc --noEmit -p tsconfig.json
npm run lint
npx vitest run
```

Resumo dos resultados:
- Backend: nao aplicavel (nenhum arquivo de `backend/` alterado).
- Frontend: `tsc` sem erros; `eslint --max-warnings=0` limpo;
  `vitest run` com 37 arquivos e 249 testes passando (inclui os 8 casos do
  helper e os 2 casos de componente novos).

## 3) Testes manuais

Pendentes de execucao em stage pelo responsavel:

- Cenario 1: novo agendamento em clinica georreferenciada, gerar melhor oferta,
  recusar todas, registrar motivo, conceder excecao, trocar a data e conferir
  que hora continua editavel e o motivo permanece.
- Cenario 2: concluir o salvamento do cenario 1 e conferir nas observacoes do
  agendamento as linhas `[Assistente agenda] sem opcao aderente para o cliente.`,
  o motivo informado e `[Assistente agenda] excecao manual concedida por admin.`
- Cenario 3: usuario nao admin recusando todas as ofertas continua sem liberar
  data/hora e mantendo o caminho de solicitar excecao ao admin.

## 4) Regressao e riscos residuais

- Risco residual 1: apos trocar a data sob excecao, o panorama operacional da
  nova data nao e consultado automaticamente. E o comportamento pretendido da
  excecao (escolha manual), mas o admin deixa de ver ofertas da nova data a
  menos que clique em "Gerar melhor oferta" - o que reinicia o desfecho.
- Risco residual 2: o teste de componente depende da estrutura do DOM do modal
  (label "Clínica", placeholder do motivo, rotulos dos botoes); mudancas de
  texto nesses pontos exigem ajuste no teste.

## 5) Itens fora de escopo entregues

- Supressao do popup de sugestao de proximidade enquanto a excecao esta ativa
  (RF-006). Entrou porque a mesma troca de data disparava o popup "Posso
  aplicar esse horario?" logo depois de o admin ter decidido pelo horario
  manual.

## 6) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
